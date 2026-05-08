import { test } from "@playwright/test"
import path from "node:path"

// Captures a verification screenshot of the hub home for the US-032 acceptance
// criterion ("Verify in browser using dev-browser skill"). Saved to
// .ralph/screenshots/US-032.png at workspace root. Runs as part of the suite
// but does no assertion beyond the page rendering without error.
test("US-032 visual verification — capture hub home screenshot", async ({ page }) => {
  await page.goto("/")
  await page.waitForLoadState("networkidle")
  // Resolve to workspace root: apps/hub/e2e -> ../../../.ralph/screenshots
  const target = path.resolve(__dirname, "..", "..", "..", ".ralph", "screenshots", "US-032.png")
  await page.screenshot({ path: target, fullPage: true })
})
