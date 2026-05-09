import { test } from "@playwright/test"
import path from "node:path"
import { deleteRoomByCode, insertRoom } from "./_helpers/admin"

// Captures verification screenshots of the hub /join page for US-036
// (loading + empty + error states). Saved to .ralph/screenshots/US-036-*.png
// at workspace root. Three states are captured side-by-side:
//  - empty:        slot-input visible, CTA disabled, error band reserved
//  - error-notfound: invalid code, banner-error "Room not found"
//  - error-ended:  ENDED-status code, banner-error "This room ended"

const ENDED_CODE = "ENDQAR"

test.describe("US-036 visual verification — /join error states", () => {
  test.beforeAll(async () => {
    await deleteRoomByCode(ENDED_CODE)
    await insertRoom({ code: ENDED_CODE, gameType: "headball", status: "ENDED" })
  })

  test.afterAll(async () => {
    await deleteRoomByCode(ENDED_CODE)
  })

  function shotPath(name: string): string {
    return path.resolve(
      __dirname,
      "..",
      "..",
      "..",
      ".ralph",
      "screenshots",
      `US-036-${name}.png`,
    )
  }

  test("empty state", async ({ page }) => {
    await page.goto("/join")
    await page.waitForLoadState("networkidle")
    await page.screenshot({ path: shotPath("empty"), fullPage: true })
  })

  test("error-notfound state (invalid code)", async ({ page }) => {
    await page.goto("/join")
    await page.locator('[data-slot="slot-input-cell"]').first().focus()
    await page.keyboard.type("ZZZZZZ")
    await page.getByRole("button", { name: /JOIN GAME/i }).click()
    await page.locator('[data-slot="join-error"]').getByText(/Room not found/i).waitFor()
    await page.screenshot({ path: shotPath("error-notfound"), fullPage: true })
  })

  test("error-ended state (ENDED room)", async ({ page }) => {
    await page.goto("/join")
    await page.locator('[data-slot="slot-input-cell"]').first().focus()
    await page.keyboard.type(ENDED_CODE)
    await page.getByRole("button", { name: /JOIN GAME/i }).click()
    await page.locator('[data-slot="join-error"]').getByText(/This room ended/i).waitFor()
    await page.screenshot({ path: shotPath("error-ended"), fullPage: true })
  })
})
