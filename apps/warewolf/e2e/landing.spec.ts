import { test, expect } from "@playwright/test"

/**
 * US-024 — Landing flow:
 *   - Cold load → lang toggle navigates to the other locale segment.
 *   - URL-segment locale persists across reload (the segment IS the canonical
 *     source per Eng Review decision #5; the persistent store also caches
 *     `lang` in localStorage so apps that boot without a URL segment can
 *     restore it).
 *   - "Find a balanced setup" CTA navigates to `/[lang]/setup`.
 */

test.describe("US-024 — Landing", () => {
  test("cold load on /en/ renders English landing", async ({ page }) => {
    await page.goto("/en")
    await expect(page.getByTestId("cta-find-setup")).toHaveText(/Find a Balanced Setup/i)
  })

  test("language toggle navigates to the other locale and persists across reload", async ({
    page,
  }) => {
    await page.goto("/en")
    // EN page shows the EN label and a link to /th.
    const toggle = page.locator('a[hrefLang="th"]')
    await expect(toggle).toBeVisible()
    await toggle.click()
    await expect(page).toHaveURL(/\/th\/?$/)
    // After navigation the page is in Thai — CTA copy switches.
    await expect(page.getByTestId("cta-find-setup")).toHaveText("หาเซ็ตอัพที่บาลานซ์")

    // Reload on /th must stay on /th and stay in Thai (URL segment is
    // canonical; the persisted lang in localStorage also corroborates).
    await page.reload()
    await expect(page).toHaveURL(/\/th\/?$/)
    await expect(page.getByTestId("cta-find-setup")).toHaveText("หาเซ็ตอัพที่บาลานซ์")
  })

  test("CTA 'Find a Balanced Setup' navigates to /[lang]/setup", async ({ page }) => {
    await page.goto("/en")
    await page.getByTestId("cta-find-setup").click()
    await expect(page).toHaveURL(/\/en\/setup(\?|$)/)
    await expect(page.getByTestId("setup-page-title")).toHaveText(/Find a balanced setup/i)
  })

  test("CTA also routes correctly on the Thai landing", async ({ page }) => {
    await page.goto("/th")
    await page.getByTestId("cta-find-setup").click()
    await expect(page).toHaveURL(/\/th\/setup(\?|$)/)
    await expect(page.getByTestId("setup-page-title")).toHaveText("หาเซ็ตอัพที่บาลานซ์")
  })
})
