import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

/**
 * US-026 — Static 44px tap-target floor.
 *
 * Pass 6 of the design doc requires every primary interactive element to
 * meet the 44×44 px tap-target floor. Most of those floors are declared
 * inline in tsx (covered by the live-DOM Playwright check in
 * `e2e/a11y.spec.ts`), but the language toggle on the landing page is
 * defined in CSS — this test parses the module CSS and asserts the rule
 * is still in place. A regression here would silently shrink the toggle
 * below 44px on small viewports.
 */

const repoRoot = join(__dirname, "..")

function readCss(rel: string): string {
  return readFileSync(join(repoRoot, rel), "utf8")
}

describe("Pass 6 tap-target floor — static CSS assertions", () => {
  it("landing language toggle holds min-height + min-width >= 44px", () => {
    const css = readCss("app/[lang]/landing.module.css")
    // Pull the .langToggle rule block.
    const match = css.match(/\.langToggle\s*\{[^}]*\}/)
    expect(match, "expected a .langToggle rule in landing.module.css").not.toBeNull()
    const rule = match![0]
    // min-height and min-width must both resolve to >= 44px.
    const minH = rule.match(/min-height:\s*(\d+)px/)
    const minW = rule.match(/min-width:\s*(\d+)px/)
    expect(minH, "min-height missing on .langToggle").not.toBeNull()
    expect(minW, "min-width missing on .langToggle").not.toBeNull()
    expect(Number(minH![1])).toBeGreaterThanOrEqual(44)
    expect(Number(minW![1])).toBeGreaterThanOrEqual(44)
  })

  it("landing primary CTA holds min-height >= 44px", () => {
    const css = readCss("app/[lang]/landing.module.css")
    // Find any rule that names "cta" and declares a min-height.
    const ctaRules = css.match(/\.[A-Za-z]*(cta|CTA)[A-Za-z]*\s*\{[^}]*min-height:\s*(\d+)px[^}]*\}/g)
    expect(ctaRules, "expected at least one .cta* rule with min-height").not.toBeNull()
    for (const rule of ctaRules!) {
      const m = rule.match(/min-height:\s*(\d+)px/)
      expect(m).not.toBeNull()
      expect(Number(m![1])).toBeGreaterThanOrEqual(44)
    }
  })

  it("focus-visible ring is 2px blood-red @ 2px offset", () => {
    const css = readCss("app/globals.css")
    const block = css.match(/:focus-visible\s*\{[^}]*\}/)
    expect(block, "expected :focus-visible rule in globals.css").not.toBeNull()
    const rule = block![0]
    expect(rule).toMatch(/outline:\s*2px\s+solid\s+var\(--color-blood\)/)
    expect(rule).toMatch(/outline-offset:\s*2px/)
  })

  it("prefers-reduced-motion zeros every motion token", () => {
    const css = readCss("app/globals.css")
    const block = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\}\s*\}/)
    expect(block, "expected @media (prefers-reduced-motion: reduce) block").not.toBeNull()
    const rule = block![0]
    expect(rule).toMatch(/--motion-fast:\s*0ms/)
    expect(rule).toMatch(/--motion-med:\s*0ms/)
    expect(rule).toMatch(/--motion-slide:\s*0ms/)
    expect(rule).toMatch(/transition-duration:\s*0ms\s*!important/)
  })
})
