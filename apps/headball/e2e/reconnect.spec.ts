import { test, expect } from "@playwright/test"
import {
  createRoom,
  joinRoom,
  startGameAsHost,
} from "./_helpers/flow"
import {
  adminClient,
  getAssignedNameForDisplayName,
  getRoomIdByCode,
  setMaxRounds,
} from "./_helpers/admin"

// A mid-round reload must resume from localStorage: same player_id, same
// round_state row (still active), same URL, same assigned name visible on the
// BIG NAME card.

const PLAYER_ID_KEY = "headball_player_id"

test("guest reload mid-round resumes with same player_id and round_state", async ({
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

    // Wait for the guest to enter PLAYING with their BIG NAME card visible.
    await expect(guestPage.getByText("Round 1/2").first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(
      guestPage.getByRole("button", { name: "แตะเพื่อเปิดตัวเลือก" }),
    ).toBeVisible({ timeout: 15_000 })

    // Capture the guest's player_id from localStorage AND the assigned name
    // dealt to them this round.
    const playerIdBefore = await guestPage.evaluate(
      (key) => window.localStorage.getItem(key),
      PLAYER_ID_KEY,
    )
    expect(playerIdBefore, "guest should have a localStorage player_id").toBeTruthy()

    const assignedName = await getAssignedNameForDisplayName(code, "Guest", 1)
    await expect(
      guestPage.getByText(assignedName.toUpperCase(), { exact: false }),
    ).toBeVisible({ timeout: 10_000 })

    // Snapshot the round_state row before the reload to compare after.
    const roomId = await getRoomIdByCode(code)
    const sb = adminClient()
    const { data: rsBefore, error: rsBeforeErr } = await sb
      .from("round_state")
      .select("assigned_name, is_active, score_this_round")
      .eq("room_id", roomId)
      .eq("player_id", playerIdBefore!)
      .eq("round_number", 1)
      .maybeSingle()
    if (rsBeforeErr || !rsBefore) {
      throw new Error(
        `round_state for guest not found: ${rsBeforeErr?.message}`,
      )
    }
    expect(rsBefore.is_active).toBe(true)

    // Reload mid-round.
    await guestPage.reload()

    // URL is still the same room.
    expect(guestPage.url()).toContain(`/room/${code}`)

    // localStorage survived the reload.
    const playerIdAfter = await guestPage.evaluate(
      (key) => window.localStorage.getItem(key),
      PLAYER_ID_KEY,
    )
    expect(playerIdAfter).toBe(playerIdBefore)

    // BIG NAME card re-renders with the same assigned name + Round caption.
    await expect(guestPage.getByText("Round 1/2").first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(
      guestPage.getByRole("button", { name: "แตะเพื่อเปิดตัวเลือก" }),
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      guestPage.getByText(assignedName.toUpperCase(), { exact: false }),
    ).toBeVisible({ timeout: 10_000 })

    // round_state row is unchanged: same name, still active, score 0.
    const { data: rsAfter, error: rsAfterErr } = await sb
      .from("round_state")
      .select("assigned_name, is_active, score_this_round")
      .eq("room_id", roomId)
      .eq("player_id", playerIdBefore!)
      .eq("round_number", 1)
      .maybeSingle()
    if (rsAfterErr || !rsAfter) {
      throw new Error(`round_state read after reload: ${rsAfterErr?.message}`)
    }
    expect(rsAfter.assigned_name).toBe(rsBefore.assigned_name)
    expect(rsAfter.is_active).toBe(rsBefore.is_active)
    expect(rsAfter.score_this_round).toBe(rsBefore.score_this_round)
  } finally {
    await hostCtx.close()
    await guestCtx.close()
  }
})
