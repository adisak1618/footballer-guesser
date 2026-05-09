import { test, expect } from "@playwright/test"
import { createRoom, joinRoom, startGameAsHost } from "./_helpers/flow"
import {
  adminClient,
  getRoomIdByCode,
  setMaxRounds,
} from "./_helpers/admin"

// Issue #13: when the guesser opens the guess popup
//   1. The hero name on the BIG NAME card is replaced with `???` (no overlay).
//   2. The popup cannot be dismissed by ESC, backdrop click, or browser back.
//   3. The standalone ดูคะแนน button is gone from the in-turn UI.
//   4. After submit, the popup closes and the scoreboard becomes visible
//      while the round continues for other players.

test("guess popup hides hero name, locks dismissal, and scoreboard auto-shows after submit", async ({
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

    // The host is the guesser in this test. Hero name shows the assigned
    // football player before the popup opens.
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
      .select("assigned_name")
      .eq("room_id", roomId)
      .eq("player_id", hostPlayer.player_id)
      .eq("round_number", 1)
      .maybeSingle()
    if (!rs) throw new Error("round_state not found")
    const heroSpan = hostPage.getByTestId("hero-name")
    await expect(heroSpan).toHaveText(rs.assigned_name.toUpperCase(), {
      timeout: 10_000,
    })

    // Open the turn overlay and confirm the standalone ดูคะแนน button
    // is gone (acceptance #3). The TurnOverlay uses a 95%-opacity backdrop,
    // so the hero text bleeds through — it must be hidden the moment the
    // overlay opens, not just when the guess popup opens.
    const tapTarget = hostPage.getByRole("button", {
      name: "แตะเพื่อเปิดตัวเลือก",
    })
    await tapTarget.click()
    const turnOverlay = hostPage.getByRole("dialog", {
      name: "ตัวเลือกของผู้เล่น",
    })
    await expect(turnOverlay).toBeVisible()
    await expect(turnOverlay.getByRole("button", { name: /ดูคะแนน/ })).toHaveCount(0)
    await expect(heroSpan).toHaveText("???")

    // Open the guess popup. The hero name on the underlying screen must
    // swap to ??? (acceptance #1, not blurred / not overlaid).
    await turnOverlay.getByRole("button", { name: /ทายชื่อ/ }).click()
    const guessModal = hostPage.getByRole("dialog", {
      name: "ทายชื่อนักเตะของคุณ",
    })
    await expect(guessModal).toBeVisible()
    await expect(heroSpan).toHaveText("???")

    // The popup is locked: ESC, backdrop click, and browser back must NOT
    // dismiss it (acceptance #2).
    await hostPage.keyboard.press("Escape")
    await expect(guessModal).toBeVisible()
    await expect(heroSpan).toHaveText("???")

    // Backdrop click — the dialog wrapper covers the full viewport; clicking
    // a corner outside the form should be a no-op now that onBackdrop is gone.
    await hostPage.mouse.click(5, 5)
    await expect(guessModal).toBeVisible()
    await expect(heroSpan).toHaveText("???")

    // Browser back — popstate handler re-pushes the sentinel state, so we
    // stay on the popup.
    await hostPage.goBack({ waitUntil: "commit" }).catch(() => {})
    await expect(guessModal).toBeVisible({ timeout: 5_000 })
    await expect(heroSpan).toHaveText("???")

    // Submit a correct guess. The popup closes and the scoreboard appears
    // while the guest is still playing (acceptance #6).
    await guessModal.locator("#guess-input").fill(rs.assigned_name)
    await guessModal.getByRole("button", { name: /ส่งคำตอบ/ }).click()
    await expect(guessModal).toBeHidden({ timeout: 10_000 })

    // After the GuessResult auto-advance (8s) or by tap, the scoreboard's
    // waiting copy shows. Tap-to-skip to keep the test fast.
    const guessResult = hostPage.getByRole("status", { name: "ทายถูก" })
    if (await guessResult.isVisible().catch(() => false)) {
      await guessResult.getByLabel("ข้ามไปสกอร์บอร์ด").click()
    }
    await expect(hostPage.getByText(/รอผู้เล่นคนอื่น/)).toBeVisible({
      timeout: 15_000,
    })
  } finally {
    await hostCtx.close()
    await guestCtx.close()
  }
})
