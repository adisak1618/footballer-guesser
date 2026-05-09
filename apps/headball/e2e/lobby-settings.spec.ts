import { test, expect } from "@playwright/test"
import { createRoom, joinRoom } from "./_helpers/flow"

test("host edits lobby settings and guest sees mirror update via Realtime", async ({
  browser,
}) => {
  const hostCtx = await browser.newContext()
  const hostPage = await hostCtx.newPage()
  const guestCtx = await browser.newContext()
  const guestPage = await guestCtx.newPage()

  try {
    const code = await createRoom(hostPage, "Host")
    await joinRoom(guestPage, code, "Guest")

    // Defaults from create-room: rounds=5, score_positions=3, category=premier-league.
    // 2 players → UI clamps top-N to player_count - 1 = 1.
    await expect(hostPage.locator("#lobby-rounds")).toHaveValue("5", {
      timeout: 15_000,
    })
    await expect(hostPage.locator("#lobby-topn")).toHaveValue("1", {
      timeout: 15_000,
    })

    // Guest sees the read-only mirror with the same values.
    await expect(guestPage.locator("#lobby-rounds")).toHaveValue("5", {
      timeout: 15_000,
    })
    await expect(guestPage.locator("#lobby-topn")).toHaveValue("1", {
      timeout: 15_000,
    })
    await expect(guestPage.locator("#lobby-rounds")).toBeDisabled()
    await expect(guestPage.locator("#lobby-topn")).toBeDisabled()
    await expect(
      guestPage.getByTestId("lobby-settings-save"),
    ).toHaveCount(0)

    // Host edits Rounds 5 → 10, commits.
    await hostPage.locator("#lobby-rounds").fill("10")
    await hostPage.locator("#lobby-rounds").blur()
    const save = hostPage.getByTestId("lobby-settings-save")
    await expect(save).toBeEnabled({ timeout: 5_000 })
    await save.click()
    await expect(save).toContainText(/บันทึกแล้ว/, { timeout: 10_000 })

    // Guest's read-only mirror updates via Realtime.
    await expect(guestPage.locator("#lobby-rounds")).toHaveValue("10", {
      timeout: 15_000,
    })
  } finally {
    await hostCtx.close()
    await guestCtx.close()
  }
})

test("non-host cannot edit settings (UI is disabled)", async ({ browser }) => {
  const hostCtx = await browser.newContext()
  const hostPage = await hostCtx.newPage()
  const guestCtx = await browser.newContext()
  const guestPage = await guestCtx.newPage()

  try {
    const code = await createRoom(hostPage, "Host")
    await joinRoom(guestPage, code, "Guest")

    await expect(guestPage.locator("#lobby-rounds")).toBeDisabled({
      timeout: 15_000,
    })
    await expect(guestPage.locator("#lobby-topn")).toBeDisabled()
    await expect(guestPage.locator("#lobby-category")).toBeDisabled()
    await expect(
      guestPage.getByTestId("lobby-settings-save"),
    ).toHaveCount(0)
  } finally {
    await hostCtx.close()
    await guestCtx.close()
  }
})
