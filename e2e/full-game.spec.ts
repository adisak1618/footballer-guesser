import { test, expect, type Page } from "@playwright/test"
import {
  createRoom,
  joinRoom,
  setRoundsViaUI,
  startGameAsHost,
  submitGuessFromCard,
} from "./_helpers/flow"
import { getAssignedNameForDisplayName } from "./_helpers/admin"

async function waitForRound(page: Page, round: number, max: number) {
  await expect(page.getByText(`Round ${round}/${max}`).first()).toBeVisible({
    timeout: 20_000,
  })
}

test("two players play a full game and see the winner on the results screen", async ({
  browser,
}) => {
  const hostCtx = await browser.newContext()
  const hostPage = await hostCtx.newPage()
  const guestCtx = await browser.newContext()
  const guestPage = await guestCtx.newPage()

  try {
    const code = await createRoom(hostPage, "Host")
    await joinRoom(guestPage, code, "Guest")

    // Both chips visible before start (sanity).
    await expect(hostPage.locator("li", { hasText: "Guest" })).toBeVisible({
      timeout: 15_000,
    })
    await expect(guestPage.locator("li", { hasText: "Host" })).toBeVisible({
      timeout: 15_000,
    })

    // Host shortens the game to 2 rounds via the lobby settings UI.
    // Realtime pushes the new max_rounds to the guest before START.
    await setRoundsViaUI(hostPage, 2)
    await expect(guestPage.locator("#lobby-rounds")).toHaveValue("2", {
      timeout: 10_000,
    })

    // Host kicks off the game.
    await startGameAsHost(hostPage)

    // ---- Round 1 ----
    await waitForRound(hostPage, 1, 2)
    await waitForRound(guestPage, 1, 2)

    const hostName1 = await getAssignedNameForDisplayName(code, "Host", 1)
    const guestName1 = await getAssignedNameForDisplayName(code, "Guest", 1)

    // Host guesses first. With Phase 1 guard active and 2 players, effective
    // score_positions = LEAST(default 3, 2-1) = 1 — only position 1 scores
    // (1 pt) and position 2 gets 0. After submit, host sees the inter-round
    // scoreboard waiting on the remaining player.
    await submitGuessFromCard(hostPage, hostName1)
    await expect(hostPage.getByText(/รอผู้เล่นคนอื่น/)).toBeVisible({
      timeout: 10_000,
    })

    // Guest guesses second (position 2 → 0 pts under Phase 1 guard). Round
    // ends; host auto-fires next_round, both clients transition to round 2.
    await submitGuessFromCard(guestPage, guestName1)

    // ---- Round 2 ----
    await waitForRound(hostPage, 2, 2)
    await waitForRound(guestPage, 2, 2)

    const hostName2 = await getAssignedNameForDisplayName(code, "Host", 2)
    const guestName2 = await getAssignedNameForDisplayName(code, "Guest", 2)

    await submitGuessFromCard(hostPage, hostName2)
    await expect(hostPage.getByText(/รอผู้เล่นคนอื่น/)).toBeVisible({
      timeout: 10_000,
    })

    await submitGuessFromCard(guestPage, guestName2)

    // ---- Results ----
    await expect(hostPage.getByText("Final Score")).toBeVisible({ timeout: 20_000 })
    await expect(guestPage.getByText("Final Score")).toBeVisible({ timeout: 20_000 })

    // Host wins (1+1=2 vs 0+0=0 under Phase 1 guard for 2-player game).
    await expect(hostPage.getByText(/🎉 Host ชนะ!/)).toBeVisible()
    await expect(guestPage.getByText(/🎉 Host ชนะ!/)).toBeVisible()

    // Scoreboard ranks: Host first with 2, Guest second with 0.
    const ranked = hostPage.locator("ol[aria-label='ผลคะแนนรวม'] li")
    await expect(ranked).toHaveCount(2)
    await expect(ranked.nth(0)).toContainText("Host")
    await expect(ranked.nth(0)).toContainText("2")
    await expect(ranked.nth(1)).toContainText("Guest")
    await expect(ranked.nth(1)).toContainText("0")

    // Host sees the rematch CTA; guest sees the wait message.
    await expect(
      hostPage.getByRole("button", { name: /เล่นรอบใหม่/ }),
    ).toBeVisible()
    await expect(guestPage.getByText("รอ host เริ่มเกมใหม่")).toBeVisible()
  } finally {
    await hostCtx.close()
    await guestCtx.close()
  }
})
