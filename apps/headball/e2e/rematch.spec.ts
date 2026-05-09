import { test, expect, type Page } from "@playwright/test"
import {
  createRoom,
  joinRoom,
  setRoundsViaUI,
  startGameAsHost,
  submitGuessFromCard,
} from "./_helpers/flow"
import {
  getAssignedNameForDisplayName,
} from "./_helpers/admin"

// Regression coverage for issue #7: rematch must (1) preserve previous-game
// lobby settings (rounds / top-N / category) and (2) advance round 1 → round 2
// in game 2 the same way it does in game 1.

async function waitForRound(page: Page, round: number, max: number) {
  await expect(page.getByText(`Round ${round}/${max}`).first()).toBeVisible({
    timeout: 20_000,
  })
}

async function playRound(
  hostPage: Page,
  guestPage: Page,
  code: string,
  round: number,
  maxRounds: number,
) {
  await waitForRound(hostPage, round, maxRounds)
  await waitForRound(guestPage, round, maxRounds)

  const hostName = await getAssignedNameForDisplayName(code, "Host", round)
  const guestName = await getAssignedNameForDisplayName(code, "Guest", round)

  await submitGuessFromCard(hostPage, hostName)
  // Skip the 8s GuessResult auto-advance for the host so the spec doesn't idle.
  const correctResult = hostPage.getByRole("status", { name: "ทายถูก" })
  await expect(correctResult).toBeVisible({ timeout: 10_000 })
  await hostPage.getByLabel("ข้ามไปสกอร์บอร์ด").click()
  await expect(hostPage.getByText(/รอผู้เล่นคนอื่น/)).toBeVisible({
    timeout: 10_000,
  })

  await submitGuessFromCard(guestPage, guestName)
}

test("rematch preserves lobby settings and advances rounds in game 2", async ({
  browser,
}) => {
  const hostCtx = await browser.newContext()
  const hostPage = await hostCtx.newPage()
  const guestCtx = await browser.newContext()
  const guestPage = await guestCtx.newPage()

  try {
    const code = await createRoom(hostPage, "Host")
    await joinRoom(guestPage, code, "Guest")

    await expect(hostPage.locator("li", { hasText: "Guest" })).toBeVisible({
      timeout: 15_000,
    })

    // Game 1: shorten to 2 rounds. Top-N stays at default (clamped to 1 for 2-player).
    await setRoundsViaUI(hostPage, 2)
    await expect(guestPage.locator("#lobby-rounds")).toHaveValue("2", {
      timeout: 10_000,
    })

    await startGameAsHost(hostPage)

    // Play game 1 to completion.
    await playRound(hostPage, guestPage, code, 1, 2)
    await playRound(hostPage, guestPage, code, 2, 2)

    // Wait for the results screen.
    await expect(hostPage.getByText("Final Score")).toBeVisible({ timeout: 20_000 })
    await expect(guestPage.getByText("Final Score")).toBeVisible({ timeout: 20_000 })

    // Bug #1: Click rematch and verify settings persist in the lobby.
    await hostPage.getByRole("button", { name: /เล่นรอบใหม่/ }).click()

    // Both clients return to the lobby.
    await expect(hostPage.locator("#lobby-rounds")).toBeVisible({
      timeout: 15_000,
    })
    await expect(guestPage.locator("#lobby-rounds")).toBeVisible({
      timeout: 15_000,
    })

    // Settings (rounds = 2 from game 1) must persist on rematch.
    await expect(hostPage.locator("#lobby-rounds")).toHaveValue("2")
    await expect(guestPage.locator("#lobby-rounds")).toHaveValue("2")

    // Category select reflects the previously played value (default
    // 'worldwide-stars' per migration 0012; host did not change it before
    // game 1).
    await expect(hostPage.locator("#lobby-category")).toHaveValue(
      "worldwide-stars",
    )
    // Issue #14: after rematch, the category selector must be enabled again
    // so players can pick a different category for the next game.
    await expect(hostPage.locator("#lobby-category")).toBeEnabled()

    // Bug #2: Start game 2 and verify round 1 → round 2 advance.
    await startGameAsHost(hostPage)

    // Game 2 round 1.
    await playRound(hostPage, guestPage, code, 1, 2)

    // Game 2 round 2 — this is the bug. If broken, both clients hang on the
    // game-2 scoreboard and never see the round-2 NameCard.
    await waitForRound(hostPage, 2, 2)
    await waitForRound(guestPage, 2, 2)

    // Sanity: finish game 2 too.
    const hostName = await getAssignedNameForDisplayName(code, "Host", 2)
    const guestName = await getAssignedNameForDisplayName(code, "Guest", 2)
    await submitGuessFromCard(hostPage, hostName)
    await hostPage.getByLabel("ข้ามไปสกอร์บอร์ด").click()
    await submitGuessFromCard(guestPage, guestName)

    await expect(hostPage.getByText("Final Score")).toBeVisible({
      timeout: 20_000,
    })
  } finally {
    await hostCtx.close()
    await guestCtx.close()
  }
})

// Error state per rubric: a game where the final round ended on a foul (every
// player's is_active flipped via wrong guesses) must still let the host
// rematch with settings intact and round-advance working in game 2.
test("rematch after foul-ended round persists settings and advances rounds", async ({
  browser,
}) => {
  const hostCtx = await browser.newContext()
  const hostPage = await hostCtx.newPage()
  const guestCtx = await browser.newContext()
  const guestPage = await guestCtx.newPage()

  try {
    const code = await createRoom(hostPage, "Host")
    await joinRoom(guestPage, code, "Guest")

    await expect(hostPage.locator("li", { hasText: "Guest" })).toBeVisible({
      timeout: 15_000,
    })

    // Game 1: 1 round so we can foul-end it cleanly.
    await setRoundsViaUI(hostPage, 1)
    await expect(guestPage.locator("#lobby-rounds")).toHaveValue("1", {
      timeout: 10_000,
    })

    await startGameAsHost(hostPage)

    await waitForRound(hostPage, 1, 1)
    await waitForRound(guestPage, 1, 1)

    // Both players foul (zzz... is not a real player name, so submit_guess
    // fails the equality + fuzzy checks → FOUL → is_active=false).
    await submitGuessFromCard(hostPage, "zzznot-a-real-player")
    await submitGuessFromCard(guestPage, "zzznot-a-real-player")

    // Game ends after the foul-only round.
    await expect(hostPage.getByText("Final Score")).toBeVisible({
      timeout: 20_000,
    })

    // Rematch.
    await hostPage.getByRole("button", { name: /เล่นรอบใหม่/ }).click()
    await expect(hostPage.locator("#lobby-rounds")).toHaveValue("1", {
      timeout: 15_000,
    })
    // Issue #14: category selector must be interactive on the post-rematch
    // lobby so the host can pick a different category for game 2.
    await expect(hostPage.locator("#lobby-category")).toBeEnabled()
    await hostPage.locator("#lobby-category").selectOption("premier-league")
    await expect(hostPage.locator("#lobby-category")).toHaveValue(
      "premier-league",
    )
    await hostPage.getByTestId("lobby-settings-save").click()
    await expect(guestPage.locator("#lobby-category")).toHaveValue(
      "premier-league",
      { timeout: 10_000 },
    )

    // Game 2 starts and round 1 reaches NameCard for both players (Bug #2
    // would have stalled this on the post-rematch refetch race).
    await startGameAsHost(hostPage)
    await waitForRound(hostPage, 1, 1)
    await waitForRound(guestPage, 1, 1)
  } finally {
    await hostCtx.close()
    await guestCtx.close()
  }
})
