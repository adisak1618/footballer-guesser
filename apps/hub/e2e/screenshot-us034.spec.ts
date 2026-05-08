import { test } from "@playwright/test"
import path from "node:path"

// Captures a verification screenshot of the hub /join page for the US-034
// acceptance criterion ("Verify in browser using dev-browser skill"). Saved
// to .ralph/screenshots/US-034.png at workspace root. The empty-input state
// is captured so the slot-input + disabled CTA + reserved error band are
// visible side-by-side.
test("US-034 visual verification — capture hub /join screenshot", async ({
  page,
}) => {
  await page.goto("/join")
  await page.waitForLoadState("networkidle")
  const target = path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    ".ralph",
    "screenshots",
    "US-034.png",
  )
  await page.screenshot({ path: target, fullPage: true })
})
