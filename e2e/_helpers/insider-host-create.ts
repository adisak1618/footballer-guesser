import type { Page } from "@playwright/test"
import { expect } from "@playwright/test"

// Issue #27 — shared helper for Insider host-create flow. The dedicated /new
// host-setup screen was deleted; the landing now creates a room with default
// category + default max_rounds via a name-only modal and redirects to
// /room/[code]. Specs that need a non-default pack click the pack-chip in
// the lobby (between-rounds-style flow) after landing.
//
// Usage:
//   const code = await createInsiderRoomViaLanding(hostPage, {
//     insiderUrl: INSIDER_URL,
//     name: "Host",
//     packSlug: "football-premier-league", // optional: defaults are fine
//   })

export interface CreateInsiderRoomViaLandingOptions {
  insiderUrl: string
  name: string
  /** Optional: pack to switch to after landing (default keeps server default). */
  packSlug?: string
  /** Optional waitForURL timeout (defaults to 15s). */
  timeout?: number
}

export async function createInsiderRoomViaLanding(
  page: Page,
  opts: CreateInsiderRoomViaLandingOptions,
): Promise<string> {
  const timeout = opts.timeout ?? 15_000
  await page.goto(`${opts.insiderUrl}/`, { waitUntil: "domcontentloaded" })

  await page.getByTestId("insider-create-room-cta").click()
  const dialog = page.getByTestId("insider-create-room-dialog")
  await expect(dialog).toBeVisible({ timeout })
  await page.getByTestId("insider-create-room-name-input").fill(opts.name)
  await page.getByTestId("insider-create-room-submit").click()

  await page.waitForURL(/\/room\/[A-Z0-9]{6}$/, { timeout })
  const code = new URL(page.url()).pathname.split("/").pop() ?? ""

  if (opts.packSlug && opts.packSlug !== "football-premier-league") {
    const chip = page.getByTestId(`pack-chip-${opts.packSlug}`)
    await expect(chip).toBeVisible({ timeout })
    await chip.click()
    await expect(chip).toHaveAttribute("aria-checked", "true", { timeout })
  }

  return code
}
