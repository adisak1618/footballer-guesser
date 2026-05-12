import { test, expect } from "@playwright/test"

/**
 * US-024 — Share roundtrip:
 *   landing → tap "Classic Detective var I @ 8p" on the setup list →
 *   land in customize → swap seer for witch → save → reload → same setup.
 *
 * Variation indices: prototype labels variations as Roman numerals (I/II/III),
 * which map to `variationIdx` 0/1/2 in the solver. We pick variation 0 of the
 * `classic-detective` archetype via the data-attributes on <SetupCard>.
 */

test("classic-detective var I @ 8p → swap seer → save → reload restores", async ({ page }) => {
  // Land on /en/, then navigate to /en/setup?p=8 (URL ?p= is canonical).
  await page.goto("/en")
  await page.getByTestId("cta-find-setup").click()
  await expect(page).toHaveURL(/\/en\/setup(\?|$)/)

  // The default playerCount in the store is 8, so the list is for 8 players.
  const cdCard = page
    .locator('[data-testid="setup-card"][data-archetype="classic-detective"][data-variation="0"]')
    .first()
  await expect(cdCard).toBeVisible()
  await cdCard.click()

  // Landed in customize. Capture the seed setup straight from the URL.
  await expect(page).toHaveURL(/\/en\/setup\/customize\?/)
  await expect(page.getByTestId("customize-card").first()).toBeVisible()

  // Confirm a seer card exists (Classic Detective variations all include
  // a seer per archetype.ts village seed). If this archetype ever stops
  // featuring a seer the test must be updated alongside the solver change.
  const seerCard = page
    .locator('[data-testid="customize-card"][data-role-id="seer"]')
    .first()
  await expect(seerCard).toBeVisible()

  // Swap seer → witch via Replace. Scope to the mobile overlay since the
  // 414×896 viewport hides the desktop side-panel copy via media query.
  await seerCard.click()
  const overlay = page.getByTestId("customize-detail-overlay")
  await expect(overlay).toBeVisible()
  await overlay.getByTestId("role-detail-replace").click()
  await expect(page.getByTestId("add-role-sheet")).toBeVisible()
  await page.getByTestId("add-role-tab-power").click()
  await page.getByTestId("add-role-candidate-witch").click()
  await expect(
    page.locator('[data-testid="customize-card"][data-role-id="witch"]').first(),
  ).toBeVisible()
  await expect(
    page.locator('[data-testid="customize-card"][data-role-id="seer"]'),
  ).toHaveCount(0)

  // Save — the URL is the only thing we need to roundtrip.
  await page.getByTestId("customize-save-btn").click()
  await expect(page.getByTestId("customize-save-toast")).toBeVisible()
  const savedUrl = page.url()
  expect(savedUrl).toMatch(/roles=[^&]*witch/)

  // Reload and verify the exact setup re-renders.
  await page.reload()
  await expect(page).toHaveURL(savedUrl)
  await expect(
    page.locator('[data-testid="customize-card"][data-role-id="witch"]').first(),
  ).toBeVisible()
  await expect(
    page.locator('[data-testid="customize-card"][data-role-id="seer"]'),
  ).toHaveCount(0)
})
