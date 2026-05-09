// One-off helper to capture .ralph/screenshots/US-053.png — the Insider /new
// host setup screen with a pack chip + time chip selected and the round
// stepper bumped to 6. Used as evidence for US-053 acceptance criterion
// "Verify in browser using dev-browser skill". Run after `bun run dev:insider`
// (or any insider dev server on :3002) is up:
//   bun run scripts/screenshot-us-053.ts

import { chromium } from "@playwright/test"

const URL = process.env.INSIDER_URL ?? "http://localhost:3002/new"
const OUT = ".ralph/screenshots/US-053.png"

async function main() {
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 414, height: 896 },
  })
  const page = await context.newPage()
  await page.goto(URL, { waitUntil: "domcontentloaded" })

  // Form interactions to make the screenshot informative.
  await page.locator('input[type="text"]').first().fill("Pong")
  await page.getByTestId("pack-chip-football-premier-league").click()
  await page.getByTestId("time-chip-300").click()
  await page.getByTestId("round-stepper-inc").click()

  await page.screenshot({ path: OUT, fullPage: true })
  console.log(`saved ${OUT}`)

  await context.close()
  await browser.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
