import { test, expect } from "@playwright/test"

/**
 * US-024 — Locale toggle:
 *   - `/en/setup/customize?...` toggled to TH switches strings; setup state
 *     unchanged.
 *   - `/en/setup?lang=th` → middleware 301-redirects to `/th/setup` per
 *     Eng Review decision #5 (segment is canonical; query param disagreeing
 *     with segment loses).
 */

const VALID_8P =
  "p=8&roles=werewolf,werewolf,seer,witch,villager,villager,villager,villager&lang=en"

test("EN customize → toggle to TH → strings switch, setup unchanged", async ({ page }) => {
  await page.goto(`/en/setup/customize?${VALID_8P}`)
  // Sanity: title is in English; wait for grid hydration before reading state.
  await expect(page.getByTestId("customize-title")).toHaveText("Customize")
  await expect(page.locator('[data-testid="customize-card"]')).toHaveCount(4)

  const beforeRoleIds = await page
    .locator('[data-testid="customize-card"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-role-id")))

  // Toggle to TH.
  await page.getByTestId("customize-lang-toggle").click()
  await expect(page).toHaveURL(/\/th\/setup\/customize\?/)
  await expect(page.getByTestId("customize-title")).toHaveText("ปรับแต่ง")
  // Wait for the new page's URL→store hydration to repopulate the grid.
  await expect(page.locator('[data-testid="customize-card"]')).toHaveCount(4)

  const afterRoleIds = await page
    .locator('[data-testid="customize-card"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-role-id")))
  expect(afterRoleIds).toEqual(beforeRoleIds)
})

test("`/en/setup?lang=th` 301-redirects to `/th/setup` (segment wins)", async ({
  page,
}) => {
  const response = await page.request.get("/en/setup?lang=th", {
    maxRedirects: 0,
  })
  expect(response.status()).toBe(301)
  const loc = response.headers()["location"] ?? ""
  // Location is path-relative; assert path + that ?lang= is stripped.
  expect(loc).toMatch(/\/th\/setup(\?|$)/)
  expect(loc).not.toMatch(/lang=/)
})
