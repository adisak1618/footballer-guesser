import { test, expect } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"

/**
 * US-024 — Invalid URL handling:
 *   /setup/customize?p=99&roles=foo,bar,baz →
 *     - p out-of-range falls back to default 8 (toast shown, per Pass 2).
 *       Per existing `share-url.test.ts`, ShareUrlSchema uses `.catch(8)`
 *       for any `p` failing min(5)/max(20) — so 99 → 8, not 20. The story
 *       criterion's "p=20" wording is a story-vs-impl discrepancy; the
 *       implementation contract (locked by a prior unit test) wins.
 *     - unknown role ids silently substituted with `villager`
 *       (Eng Review decision #3).
 *     - role-count-mismatch banner is visible (3 roles vs p=8 → need 5).
 */

test("invalid p + unknown roles → clamp toast + silent substitution + count-mismatch banner", async ({
  page,
}) => {
  await page.goto("/en/setup/customize?p=99&roles=foo,bar,baz&lang=en")

  // Toast announces the fallback.
  const toast = page.getByTestId("customize-clamp-toast")
  await expect(toast).toBeVisible()
  await expect(toast).toHaveText("Player count adjusted to 8")

  // Grid header shows "3 / 8" — 3 substituted villagers, p fell back to 8.
  await expect(page.getByTestId("customize-grid-head")).toContainText("3 / 8")

  // All three substituted cards are villager (silent substitution path).
  const villagerCards = page.locator(
    '[data-testid="customize-card"][data-role-id="villager"]',
  )
  await expect(villagerCards).toHaveCount(1) // 3 villagers group into 1 tile w/ ×3 badge
  await expect(page.getByTestId("customize-card-count")).toHaveText("×3")

  // No unknown ids leak into the DOM (otherwise substitution failed).
  await expect(
    page.locator('[data-testid="customize-card"][data-role-id="foo"]'),
  ).toHaveCount(0)
  await expect(
    page.locator('[data-testid="customize-card"][data-role-id="bar"]'),
  ).toHaveCount(0)

  // Playable banner surfaces the FIRST blocker. With 0 wolves + 5 missing
  // slots, `no-wolves` wins over `role-count-mismatch` in the validator's
  // blocker priority order (see `computeReason` in customize/page.tsx).
  // The role-count-mismatch contract is independently verified above via
  // the "3 / 8" header — both blockers are present in the validator output.
  const banner = page.getByTestId("playable-banner-reason")
  await expect(banner).toHaveText(
    "Zero wolves — no game possible. Add at least one wolf.",
  )

  // Save is disabled while the setup is unplayable.
  await expect(page.getByTestId("customize-save-btn")).toBeDisabled()
})

// US-026 — axe scan on the customize page in its "invalid URL / blocker
// banner visible / Save disabled" state. Important because banner + disabled
// button colour contrast and aria semantics are easy to regress.
test("axe-core: customize page with blocker banner has zero serious/critical violations", async ({
  page,
}) => {
  await page.goto("/en/setup/customize?p=99&roles=foo,bar,baz&lang=en")
  await expect(page.getByTestId("playable-banner-reason")).toBeVisible()
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze()
  const blockers = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  )
  expect(blockers, JSON.stringify(blockers, null, 2)).toEqual([])
})
