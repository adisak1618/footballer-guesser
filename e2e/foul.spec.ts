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

// A wrong guess fires the FOUL overlay, marks the player inactive in
// round_state, and zeroes their score_this_round. The atomic decision lives
// inside submit_guess; this spec exercises it from the real UI.

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

    // FOUL overlay flashes for ~600ms after the modal closes. The hb-flash
    // keyframe ends at opacity 0 with `forwards`, so toBeVisible races the
    // animation; toBeAttached just checks the element exists in the DOM, which
    // is sufficient proof the foul UI rendered.
    await expect(hostPage.locator('[aria-label="Foul"]')).toBeAttached({
      timeout: 5_000,
    })

    // Player transitions to the inter-round scoreboard with the waiting copy
    // (guest is still active in round 1).
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
