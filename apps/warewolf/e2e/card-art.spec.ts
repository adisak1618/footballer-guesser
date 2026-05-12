import { test, expect } from "@playwright/test"
import path from "node:path"

const ROLE_IDS = [
  "werewolf",
  "wolf-cub",
  "alpha-wolf",
  "minion",
  "sorceress",
  "seer",
  "apprentice-seer",
  "aura-seer",
  "paranormal-investigator",
  "witch",
  "bodyguard",
  "hunter",
  "tough-guy",
  "prince",
  "priest",
  "mayor",
  "drunk",
  "villager",
  "mason",
  "spellcaster",
  "old-hag",
  "tanner",
  "lone-wolf",
  "hoodlum",
  "cult-leader",
] as const

test.describe("US-013 — CardArt asset pipeline", () => {
  test("every V1 card art URL responds 200 with an image", async ({ request }) => {
    for (const id of ROLE_IDS) {
      const res = await request.get(`/cards/${id}.webp`)
      expect(res.status(), `/cards/${id}.webp`).toBe(200)
      const ct = res.headers()["content-type"] ?? ""
      expect(ct, `content-type for ${id}`).toMatch(/image\/(webp|jpe?g|png)/)
    }
  })

  test("missing card art returns 404 (placeholder territory)", async ({ request }) => {
    const res = await request.get("/cards/nonexistent-role.webp")
    expect(res.status()).toBe(404)
  })

  test("contact sheet renders all 25 card images", async ({ page }) => {
    // Build a Storybook-style grid client-side using raw <img> so we don't
    // depend on the not-yet-built customize page. CardArt component itself
    // is unit-tested in components/CardArt.test.tsx.
    const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>CardArt sheet</title>
<style>
  body{margin:0;padding:16px;background:#f5ecd6;font:14px/1.2 serif;color:#1a1612}
  .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
  figure{margin:0}
  img{display:block;width:100%;aspect-ratio:2/3;object-fit:cover;object-position:center top;border:1.5px solid #1a1612;background:#fbf4e0}
  figcaption{font-size:10px;text-align:center;padding-top:2px}
</style></head>
<body><div class="grid">
${ROLE_IDS.map((id) => `<figure><img src="/cards/${id}.webp" alt="${id}"><figcaption>${id}</figcaption></figure>`).join("\n")}
</div></body></html>`
    await page.route("**/__cardsheet", (route) =>
      route.fulfill({ contentType: "text/html", body: html }),
    )
    await page.goto("/__cardsheet")
    await page.waitForLoadState("networkidle")
    const imgs = page.locator("img")
    await expect(imgs).toHaveCount(ROLE_IDS.length)
    // Every image must have natural dimensions > 0 (i.e. loaded successfully).
    const results = await imgs.evaluateAll(
      (els) => (els as HTMLImageElement[]).map((i) => [i.alt, i.naturalWidth, i.naturalHeight]),
    )
    for (const [alt, w, h] of results as [string, number, number][]) {
      expect(w, `${alt} naturalWidth`).toBeGreaterThan(0)
      expect(h, `${alt} naturalHeight`).toBeGreaterThan(0)
    }
    const screenshotPath = path.resolve(__dirname, "../../../.ralph/screenshots/US-013.png")
    await page.screenshot({ path: screenshotPath, fullPage: true })
  })
})
