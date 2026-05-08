import { test, expect } from "@playwright/test"
import { createRoom, joinRoom } from "./_helpers/flow"

test("host creates room, second player joins, both see each other with tag colors", async ({
  browser,
}) => {
  const hostCtx = await browser.newContext()
  const hostPage = await hostCtx.newPage()
  const guestCtx = await browser.newContext()
  const guestPage = await guestCtx.newPage()

  try {
    const code = await createRoom(hostPage, "Host")

    // Host lands in the lobby and sees their own chip with the room code displayed.
    await expect(hostPage.locator(`text=${code}`).first()).toBeVisible()
    await expect(hostPage.locator("li", { hasText: "Host" })).toBeVisible()

    // Guest joins via the /join form.
    await joinRoom(guestPage, code, "Guest")

    // Both pages show both chips. Realtime takes a moment, so use auto-retrying assertions.
    const hostHostChip = hostPage.locator("li", { hasText: "Host" })
    const hostGuestChip = hostPage.locator("li", { hasText: "Guest" })
    const guestHostChip = guestPage.locator("li", { hasText: "Host" })
    const guestGuestChip = guestPage.locator("li", { hasText: "Guest" })

    await expect(hostHostChip).toBeVisible()
    await expect(hostGuestChip).toBeVisible()
    await expect(guestHostChip).toBeVisible()
    await expect(guestGuestChip).toBeVisible()

    // Tag colors are derived from join_order: 1 → red, 2 → blue.
    await expect(hostHostChip).toHaveClass(/bg-tag-red/)
    await expect(hostGuestChip).toHaveClass(/bg-tag-blue/)
    await expect(guestHostChip).toHaveClass(/bg-tag-red/)
    await expect(guestGuestChip).toHaveClass(/bg-tag-blue/)

    // Player count badge reflects 2 of 8.
    await expect(hostPage.getByText(/Players \(2\/8\)/)).toBeVisible()
    await expect(guestPage.getByText(/Players \(2\/8\)/)).toBeVisible()

    // Host sees the start button; guest sees the wait message.
    await expect(hostPage.getByRole("button", { name: /Start Game/i })).toBeVisible()
    await expect(guestPage.getByText("รอ host เริ่มเกม")).toBeVisible()
  } finally {
    await hostCtx.close()
    await guestCtx.close()
  }
})
