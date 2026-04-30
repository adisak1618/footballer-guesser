import { test, expect } from "@playwright/test"
import {
  createRoom,
  joinRoom,
  startGameAsHost,
} from "./_helpers/flow"
import {
  adminClient,
  getRoomIdByCode,
  setMaxRounds,
} from "./_helpers/admin"

async function overrideAssignedName(
  code: string,
  displayName: string,
  roundNumber: number,
  assignedName: string,
): Promise<void> {
  const sb = adminClient()
  const roomId = await getRoomIdByCode(code)
  const { data: player, error: playerErr } = await sb
    .from("players")
    .select("player_id")
    .eq("room_id", roomId)
    .eq("display_name", displayName)
    .maybeSingle()
  if (playerErr || !player) {
    throw new Error(`player ${displayName} not found: ${playerErr?.message}`)
  }
  const { error } = await sb
    .from("round_state")
    .update({ assigned_name: assignedName })
    .eq("room_id", roomId)
    .eq("player_id", player.player_id)
    .eq("round_number", roundNumber)
  if (error) throw new Error(`overrideAssignedName failed: ${error.message}`)
}

// A wrong guess fires the FOUL overlay, marks the player inactive in
// round_state, and zeroes their score_this_round. The atomic decision lives
// inside submit_guess; this spec exercises it from the real UI.
//
// Issue #3 extension: the new fuzzy match (levenshtein <= 2) must still
// FOUL on a guess that is a different real name far past the threshold.
// "ZZZ_NOT_A_REAL_PLAYER_ZZZ" vs any seed name has distance well above 2,
// AND we additionally exercise "Pele" vs an assigned name like
// "Steven Gerrard" via overrideAssignedName below. Distinct-real-name
// cases must not be silently accepted.

test("wrong guess marks player inactive with FOUL overlay and zero score", async ({
  browser,
}) => {
  const hostCtx = await browser.newContext()
  const hostPage = await hostCtx.newPage()
  const guestCtx = await browser.newContext()
  const guestPage = await guestCtx.newPage()

  try {
    const code = await createRoom(hostPage, "Host")
    await joinRoom(guestPage, code, "Guest")
    await setMaxRounds(code, 2)
    await startGameAsHost(hostPage)

    await expect(hostPage.getByText("Round 1/2").first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(guestPage.getByText("Round 1/2").first()).toBeVisible({
      timeout: 20_000,
    })

    // Host fouls by typing a name that cannot match any seeded player.
    const tapTarget = hostPage.getByRole("button", {
      name: "แตะเพื่อเปิดตัวเลือก",
    })
    await expect(tapTarget).toBeVisible({ timeout: 15_000 })
    await tapTarget.click()

    const turnOverlay = hostPage.getByRole("dialog", {
      name: "ตัวเลือกของผู้เล่น",
    })
    await expect(turnOverlay).toBeVisible()
    await turnOverlay.getByRole("button", { name: /ทายชื่อ/ }).click()

    const guessModal = hostPage.getByRole("dialog", {
      name: "ทายชื่อนักเตะของคุณ",
    })
    await expect(guessModal).toBeVisible()
    await guessModal.locator("#guess-input").fill("ZZZ_NOT_A_REAL_PLAYER_ZZZ")
    await guessModal.getByRole("button", { name: /ส่งคำตอบ/ }).click()

    // The persistent GuessResult (foul) screen replaces the BIG NAME card
    // when round_state.is_active flips to false. It reveals the assigned
    // name, shows 0 pts, and exposes a tap-to-skip. (The previous brief
    // FOUL flash overlay in name-card.tsx is no longer the verifying surface
    // — GuessResult is.)
    const foulResult = hostPage.getByRole("status", { name: "ทายผิด" })
    await expect(foulResult).toBeVisible({ timeout: 10_000 })
    await expect(foulResult.getByLabel("คะแนนรอบนี้ 0 pts")).toBeVisible()
    await expect(foulResult.getByText("รอเล่นใหม่ในรอบหน้า")).toBeVisible()

    // The host's assigned-name reveal must also be visible inside the foul
    // result (the round_state row's assigned_name).
    const roomIdForName = await getRoomIdByCode(code)
    const sbForName = adminClient()
    const { data: hostPlayerForName } = await sbForName
      .from("players")
      .select("player_id")
      .eq("room_id", roomIdForName)
      .eq("display_name", "Host")
      .maybeSingle()
    if (!hostPlayerForName) throw new Error("host player not found")
    const { data: rsForName } = await sbForName
      .from("round_state")
      .select("assigned_name")
      .eq("room_id", roomIdForName)
      .eq("player_id", hostPlayerForName.player_id)
      .eq("round_number", 1)
      .maybeSingle()
    if (!rsForName) throw new Error("round_state not found for assigned_name check")
    await expect(foulResult.getByText(rsForName.assigned_name)).toBeVisible()

    // Tap to skip → scoreboard appears with the waiting copy (guest still
    // playing).
    await foulResult.getByLabel("ข้ามไปสกอร์บอร์ด").click()
    await expect(hostPage.getByText(/รอผู้เล่นคนอื่น/)).toBeVisible({
      timeout: 10_000,
    })

    // DB invariants: is_active=false, score_this_round=0 for the foul'd player.
    const roomId = await getRoomIdByCode(code)
    const sb = adminClient()

    const { data: hostPlayer, error: playerErr } = await sb
      .from("players")
      .select("player_id")
      .eq("room_id", roomId)
      .eq("display_name", "Host")
      .maybeSingle()
    if (playerErr || !hostPlayer) {
      throw new Error(`host player not found: ${playerErr?.message}`)
    }

    const { data: rs, error: rsErr } = await sb
      .from("round_state")
      .select("is_active, score_this_round, assigned_name")
      .eq("room_id", roomId)
      .eq("player_id", hostPlayer.player_id)
      .eq("round_number", 1)
      .maybeSingle()
    if (rsErr || !rs) {
      throw new Error(`round_state not found: ${rsErr?.message}`)
    }

    expect(rs.is_active).toBe(false)
    expect(rs.score_this_round).toBe(0)

    // round_events log records the FOUL too.
    const { data: foulEvents, error: eventsErr } = await sb
      .from("round_events")
      .select("type")
      .eq("room_id", roomId)
      .eq("player_id", hostPlayer.player_id)
      .eq("round_number", 1)
      .eq("type", "FOUL")
    if (eventsErr) throw new Error(`round_events read failed: ${eventsErr.message}`)
    expect(foulEvents?.length ?? 0).toBeGreaterThanOrEqual(1)
  } finally {
    await hostCtx.close()
    await guestCtx.close()
  }
})

// Issue #3: distinct real names must still FOUL even with fuzzy match on.
// "Pele" vs assigned "Steven Gerrard" has levenshtein distance well above 2.
test("FOUL still fires when guess is a distinct real name (fuzzy threshold respected)", async ({
  browser,
}) => {
  const hostCtx = await browser.newContext()
  const hostPage = await hostCtx.newPage()
  const guestCtx = await browser.newContext()
  const guestPage = await guestCtx.newPage()

  try {
    const code = await createRoom(hostPage, "Host")
    await joinRoom(guestPage, code, "Guest")
    await setMaxRounds(code, 2)
    await startGameAsHost(hostPage)

    await expect(hostPage.getByText("Round 1/2").first()).toBeVisible({
      timeout: 20_000,
    })

    await overrideAssignedName(code, "Host", 1, "Steven Gerrard")

    const tapTarget = hostPage.getByRole("button", {
      name: "แตะเพื่อเปิดตัวเลือก",
    })
    await expect(tapTarget).toBeVisible({ timeout: 15_000 })
    await tapTarget.click()

    const turnOverlay = hostPage.getByRole("dialog", {
      name: "ตัวเลือกของผู้เล่น",
    })
    await expect(turnOverlay).toBeVisible()
    await turnOverlay.getByRole("button", { name: /ทายชื่อ/ }).click()

    const guessModal = hostPage.getByRole("dialog", {
      name: "ทายชื่อนักเตะของคุณ",
    })
    await expect(guessModal).toBeVisible()
    await guessModal.locator("#guess-input").fill("Pele")
    await guessModal.getByRole("button", { name: /ส่งคำตอบ/ }).click()
    // Modal closes once the RPC resolves. We then assert on DB invariants
    // — the foul overlay flashes briefly and races realtime unmount, so the
    // existing "ZZZ_NOT_A_REAL_PLAYER" test already covers the visual flash;
    // here we rely on round_state + round_events as the deterministic proof.
    await expect(guessModal).toBeHidden({ timeout: 10_000 })

    const sb = adminClient()
    const roomId = await getRoomIdByCode(code)
    const { data: hostPlayer } = await sb
      .from("players")
      .select("player_id")
      .eq("room_id", roomId)
      .eq("display_name", "Host")
      .maybeSingle()
    if (!hostPlayer) throw new Error("host player not found")

    const { data: rs } = await sb
      .from("round_state")
      .select("is_active, score_this_round")
      .eq("room_id", roomId)
      .eq("player_id", hostPlayer.player_id)
      .eq("round_number", 1)
      .maybeSingle()
    expect(rs?.is_active).toBe(false)
    expect(rs?.score_this_round).toBe(0)

    const { data: events } = await sb
      .from("round_events")
      .select("type, guess_text")
      .eq("room_id", roomId)
      .eq("player_id", hostPlayer.player_id)
      .eq("round_number", 1)
    const foulEvents = (events ?? []).filter((e) => e.type === "FOUL")
    expect(foulEvents.length).toBeGreaterThanOrEqual(1)
    expect(foulEvents[0].guess_text).toBe("Pele")
  } finally {
    await hostCtx.close()
    await guestCtx.close()
  }
})
