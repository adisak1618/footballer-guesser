import { test, expect } from "@playwright/test"
import {
  createRoom,
  joinRoom,
  startGameAsHost,
} from "./_helpers/flow"
import { setMaxRounds } from "./_helpers/admin"

// Chip-interaction spec for the guess modal:
// - chips render only when input length >= 4
// - tapping a chip replaces input text and does NOT auto-submit

test("guess modal chips: render gating + tap-fills-no-submit", async ({
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

    // Open the guess modal via the player tap target → turn overlay.
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
    const input = guessModal.locator("#guess-input")
    const chipList = guessModal.getByRole("list", { name: "คำแนะนำชื่อ" })

    // 3 chars → no chip row (under the 4-char gate).
    await input.fill("ger")
    await expect(chipList).toHaveCount(0)

    // 4 chars → chips appear (Steven Gerrard is in the seed list).
    await input.fill("gerr")
    await expect(chipList).toBeVisible({ timeout: 5_000 })
    const chipButton = chipList.getByRole("button", { name: "Steven Gerrard" })
    await expect(chipButton).toBeVisible()

    // Tap a chip → input value is replaced; modal still open (no auto-submit).
    await chipButton.click()
    await expect(input).toHaveValue("Steven Gerrard")
    await expect(guessModal).toBeVisible()

    // Sanity: drop below threshold → chips hidden again.
    await input.fill("st")
    await expect(chipList).toHaveCount(0)
  } finally {
    await hostCtx.close()
    await guestCtx.close()
  }
})

test("guess modal chips: suppressed under prefers-reduced-motion: reduce", async ({
  browser,
}) => {
  const hostCtx = await browser.newContext({ reducedMotion: "reduce" })
  const hostPage = await hostCtx.newPage()
  const guestCtx = await browser.newContext({ reducedMotion: "reduce" })
  const guestPage = await guestCtx.newPage()

  try {
    const code = await createRoom(hostPage, "Host")
    await joinRoom(guestPage, code, "Guest")
    await setMaxRounds(code, 2)
    await startGameAsHost(hostPage)

    await expect(hostPage.getByText("Round 1/2").first()).toBeVisible({
      timeout: 20_000,
    })

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
    const input = guessModal.locator("#guess-input")
    const chipList = guessModal.getByRole("list", { name: "คำแนะนำชื่อ" })

    // 4+ chars would normally render chips, but prefers-reduced-motion
    // suppresses them entirely.
    await input.fill("steven")
    await expect(chipList).toHaveCount(0)
  } finally {
    await hostCtx.close()
    await guestCtx.close()
  }
})
