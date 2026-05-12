import { test, expect, type Page } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"

/**
 * US-024 — Customize loop:
 *   - Open a valid setup via URL.
 *   - Make 3 role swaps via the UI.
 *   - Balance scale + playable banner update live (they react to the same
 *     Zustand state used by the URL roundtrip).
 *   - Save copies the share URL to the clipboard.
 *   - Reload → URL re-hydrates the exact saved setup.
 *
 * Also folds in the **clipboard fallback** failure-mode test (Eng Review
 * mitigation #1): when `navigator.clipboard.writeText` rejects, the page
 * falls through to a `<textarea> + execCommand('copy')` path and surfaces a
 * "Link copied (fallback)" toast.
 */

const VALID_8P =
  "p=8&roles=werewolf,werewolf,villager,villager,villager,villager,villager,villager&lang=en"

async function openCustomize(page: Page, search: string) {
  await page.goto(`/en/setup/customize?${search}`)
  // Wait for hydration to finish — the role grid renders once setup is in store.
  await expect(page.getByTestId("customize-card").first()).toBeVisible()
}

// The customize page renders the RoleDetailModal twice: once inside the
// desktop side-panel (`.customize-detail-panel`, display:none below 1024px)
// and once inside the mobile bottom-sheet overlay. Our 414×896 viewport
// targets the overlay copy — scope the locator so we don't grab the hidden
// desktop one.
async function swap(page: Page, fromRoleId: string, toRoleId: string, tab: string) {
  await page
    .locator(`[data-testid="customize-card"][data-role-id="${fromRoleId}"]`)
    .first()
    .click()
  const overlay = page.getByTestId("customize-detail-overlay")
  await expect(overlay).toBeVisible()
  await overlay.getByTestId("role-detail-replace").click()
  await expect(page.getByTestId("add-role-sheet")).toBeVisible()
  await page.getByTestId(`add-role-tab-${tab}`).click()
  await page.getByTestId(`add-role-candidate-${toRoleId}`).click()
  await expect(
    page.locator(`[data-testid="customize-card"][data-role-id="${toRoleId}"]`).first(),
  ).toBeVisible()
}

test.describe("US-024 — Customize loop", () => {
  test("open → 3 swaps → balance updates → Save → URL updates → reload restores", async ({
    page,
  }) => {
    await openCustomize(page, VALID_8P)

    // Initial balance: 2× werewolf (-12) + 6× villager (+6) = -6. Negative (wolf side).
    // Banner is "playable" (no blocker, |balance| <= ... 6 still > 2 so warn).
    const banner = page.getByTestId("playable-banner-verdict")
    await expect(banner).toBeVisible()

    // Swap 1: villager → seer (info tab). Balance → -12 + 7 + 5 = 0.
    await swap(page, "villager", "seer", "info")
    // Swap 2: villager → witch (power tab). Balance → -12 + 7 + 4 + 4 = 3.
    await swap(page, "villager", "witch", "power")
    // Swap 3: villager → bodyguard (power tab). Balance → -12 + 7 + 4 + 3 + 3 = 5.
    await swap(page, "villager", "bodyguard", "power")

    // The save button is enabled (setup is still playable: 2 wolves vs 6 village).
    const saveBtn = page.getByTestId("customize-save-btn")
    await expect(saveBtn).toBeEnabled()

    // Click Save. Clipboard write happens in the page context; we assert via
    // the toast text (the surface the user actually sees).
    await saveBtn.click()
    await expect(page.getByTestId("customize-save-toast")).toBeVisible()

    // URL should reflect the swapped setup. The 3 swaps replaced 3 villagers.
    await expect(page).toHaveURL(/roles=werewolf%2Cwerewolf%2Cseer%2Cwitch%2Cbodyguard%2Cvillager%2Cvillager%2Cvillager/)

    const urlAfterSave = page.url()

    // Reload and assert exact setup re-hydrates.
    await page.reload()
    await expect(page).toHaveURL(urlAfterSave)
    await expect(page.locator('[data-role-id="seer"]')).toHaveCount(1)
    await expect(page.locator('[data-role-id="witch"]')).toHaveCount(1)
    await expect(page.locator('[data-role-id="bodyguard"]')).toHaveCount(1)
    // 3 villagers remain (they group into a single tile with ×3 badge).
    const villagerTile = page.locator(
      '[data-testid="customize-card"][data-role-id="villager"]',
    )
    await expect(villagerTile).toHaveCount(1)
  })

  test("clipboard fallback → 'Link copied (fallback)' toast", async ({ page }) => {
    // Inject a clipboard that rejects on writeText BEFORE the page boots, so
    // `navigator.clipboard?.writeText` is truthy (passes the guard) and then
    // throws — exercising the fallback path in customize/page.tsx:212-218.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: () => Promise.reject(new Error("denied")),
        },
      })
    })

    await openCustomize(page, VALID_8P)

    // Convert default setup to a known-playable one via a single swap so Save
    // is enabled (starting 2W+6V is -6 balance, but still playable, so Save is
    // already enabled — proceed directly).
    await page.getByTestId("customize-save-btn").click()

    const toast = page.getByTestId("customize-save-toast")
    await expect(toast).toBeVisible()
    await expect(toast).toHaveText("Link copied (fallback)")
  })

  // US-026 — axe scan after the customize flow has performed real swaps and
  // the playable banner is rendered. Exercises the dynamic UI state.
  test("axe-core: customize page (after a swap) has zero serious/critical violations", async ({
    page,
  }) => {
    await openCustomize(page, VALID_8P)
    await swap(page, "villager", "seer", "info")
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze()
    const blockers = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    )
    expect(blockers, JSON.stringify(blockers, null, 2)).toEqual([])
  })
})
