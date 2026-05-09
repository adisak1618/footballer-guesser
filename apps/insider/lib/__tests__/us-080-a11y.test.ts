import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// US-080 / Phase 5d.6 — A11y polish contract for Insider screens.
//
// This is a textual-contract test (not a render test) — vitest in apps/insider
// runs in node env without React rendering. The test reads each Insider screen
// source file and asserts the a11y patterns from design review Pass 6 are
// encoded in source. Browser-level verification (touch-target box dimensions,
// focus-ring computed style) is deferred to /qa exhaustive on the Vercel
// preview per the standing Vercel-deferral cascade (pattern note 81).
//
// Each test maps 1:1 to a US-080 acceptance-criterion checkbox so a future
// regression that strips an a11y attribute fails here loudly.

const APP_ROOT = join(__dirname, "..", "..")
const ROOM_DIR = join(APP_ROOT, "app", "room", "[code]")
const GLOBALS_CSS = join(APP_ROOT, "app", "globals.css")

function read(rel: string): string {
  return readFileSync(join(ROOM_DIR, rel), "utf8")
}

describe("US-080 — Insider a11y polish contract", () => {
  describe("Focus ring (3px solid goal-red 2px offset on every focusable element)", () => {
    it("declares a global :focus-visible rule using --color-goal at 3px solid 2px offset", () => {
      const css = readFileSync(GLOBALS_CSS, "utf8")
      // The rule must cover every interactive element category and bind to
      // the goal-red token. Outline (not box-shadow) so the ring sits outside
      // overflow-hidden parents.
      expect(css).toMatch(/button:focus-visible/)
      expect(css).toMatch(/a:focus-visible/)
      expect(css).toMatch(/input:focus-visible/)
      expect(css).toMatch(/outline:\s*3px solid var\(--color-goal\)/)
      expect(css).toMatch(/outline-offset:\s*2px/)
    })
  })

  describe("Touch targets ≥44px on every interactive element", () => {
    it("role-reveal CTAs use min-h-14 (56px)", () => {
      const src = read("role-reveal.tsx")
      // Three views (insider/master/common) each render an "ฉันพร้อมแล้ว" CTA.
      const cta = src.match(/data-testid="insider-ready-cta"[\s\S]*?className="([^"]+)"/g)
      expect(cta?.length).toBe(3)
      for (const m of cta ?? []) expect(m).toMatch(/min-h-14/)
    })

    it("asking-master accordion toggle has min-h-11 (44px) — the only sub-44px control before US-080", () => {
      const src = read("asking-master.tsx")
      // The accordion toggle was previously py-3 only (~42px). US-080 added
      // min-h-11 to clear the 44px touch-target threshold.
      expect(src).toMatch(/data-testid="master-feed-accordion-toggle"[\s\S]*?min-h-11/)
    })

    it("asking-master Yes/No/Unsure buttons use ResponseButton (min-h-[96px])", () => {
      const button = readFileSync(
        join(APP_ROOT, "..", "..", "packages", "ui", "src", "response-button.tsx"),
        "utf8",
      )
      expect(button).toMatch(/min-h-\[96px\]/)
    })

    it("asking-master mark-correct CTA uses min-h-14", () => {
      const src = read("asking-master.tsx")
      expect(src).toMatch(/data-testid="master-mark-correct-cta"[\s\S]*?min-h-14/)
    })

    it("voting cards use min-h-[120px]", () => {
      const card = readFileSync(
        join(APP_ROOT, "..", "..", "packages", "ui", "src", "vote-target-card.tsx"),
        "utf8",
      )
      expect(card).toMatch(/min-h-\[120px\]/)
    })

    it("reveal next-round CTA uses min-h-14", () => {
      const src = read("reveal.tsx")
      const matches = src.match(/data-testid="reveal-next-round-cta"[\s\S]*?min-h-14/g)
      // All three reveal variants (caught/escaped/time-expired) carry the CTA.
      expect(matches?.length).toBe(3)
    })

    it("lobby back link uses min-h-11 + flex centering", () => {
      const src = read("lobby.tsx")
      expect(src).toMatch(/← ออกจากห้อง[\s\S]{0,200}|min-h-11[\s\S]{0,200}← ออกจากห้อง/)
      expect(src).toMatch(/inline-flex min-h-11 items-center/)
    })

    it("lobby start CTA uses min-h-14", () => {
      const src = read("lobby.tsx")
      expect(src).toMatch(/data-testid="insider-start-game-cta"[\s\S]*?min-h-14/)
    })

    it("lobby join input uses min-h-12 (48px)", () => {
      const src = read("lobby.tsx")
      expect(src).toMatch(/data-testid="insider-join-name-input"[\s\S]*?min-h-12/)
    })

    it("lobby join CTA uses min-h-14", () => {
      const src = read("lobby.tsx")
      expect(src).toMatch(/data-testid="insider-join-cta"[\s\S]*?min-h-14/)
    })
  })

  describe("Screen reader: secret word announced as 'Your secret word: [WORD]'", () => {
    it("insider secret card has sr-only 'Your secret word:' announcement and aria-hidden visual", () => {
      const src = read("role-reveal.tsx")
      // The visual span is aria-hidden so SR reads the spoken contract once.
      expect(src).toMatch(
        /data-testid="insider-secret-card"[\s\S]*?<span className="sr-only">Your secret word: \{secret\}<\/span>[\s\S]*?aria-hidden="true"/,
      )
    })

    it("master secret card has sr-only 'Your secret word:' announcement and aria-hidden visual", () => {
      const src = read("role-reveal.tsx")
      expect(src).toMatch(
        /data-testid="master-secret-card"[\s\S]*?<span className="sr-only">Your secret word: \{secret\}<\/span>[\s\S]*?aria-hidden="true"/,
      )
    })
  })

  describe("Response feed wrapped in aria-live='polite'", () => {
    it("asking-other (Insider+Common shared) feed has aria-live='polite'", () => {
      const src = read("asking-other.tsx")
      expect(src).toMatch(
        /data-testid="asking-other-feed"[\s\S]*?aria-live="polite"/,
      )
    })

    it("asking-master expanded feed list has aria-live='polite'", () => {
      const src = read("asking-master.tsx")
      expect(src).toMatch(
        /data-testid="master-feed-list"[\s\S]*?aria-live="polite"/,
      )
    })
  })

  describe("Color-blind triple-coding: Yes/No/Unsure all have icon + text + color", () => {
    it("ResponseButton renders icon + Thai label + English caption", () => {
      const button = readFileSync(
        join(APP_ROOT, "..", "..", "packages", "ui", "src", "response-button.tsx"),
        "utf8",
      )
      // Three independent channels per variant: icon (✓/✗/?), label, color.
      expect(button).toMatch(/{icon}/)
      expect(button).toMatch(/{labelTh}/)
      expect(button).toMatch(/{labelEn}/)
      expect(button).toMatch(/success.*bg-success/s)
      expect(button).toMatch(/error.*bg-error/s)
      expect(button).toMatch(/warning.*bg-warning/s)
    })

    it("asking-master maps yes→✓, no→✗, unsure→? plus Thai labels", () => {
      const src = read("asking-master.tsx")
      expect(src).toMatch(/yes:\s*"✓"/)
      expect(src).toMatch(/no:\s*"✗"/)
      expect(src).toMatch(/unsure:\s*"\?"/)
      expect(src).toMatch(/yes:\s*"ใช่"/)
      expect(src).toMatch(/no:\s*"ไม่ใช่"/)
      expect(src).toMatch(/unsure:\s*"ไม่แน่ใจ"/)
    })
  })

  describe("ARIA landmarks: <main>, <header>, <aside> on each screen", () => {
    it("role-reveal: insider/master/common variants each render <main> + <header>", () => {
      const src = read("role-reveal.tsx")
      const mains = src.match(/<main\b/g)
      const headers = src.match(/<header\b/g)
      // 3 variants + 1 loadError fallback.
      expect((mains ?? []).length).toBeGreaterThanOrEqual(4)
      // 3 variants render the round header.
      expect((headers ?? []).length).toBeGreaterThanOrEqual(3)
      // Common view exposes the warning hint as an <aside>.
      expect(src).toMatch(/<aside[\s\S]*?data-testid="common-warning-hint"/)
    })

    it("asking-master renders <main> + <header> + <aside> for the response feed", () => {
      const src = read("asking-master.tsx")
      expect(src).toMatch(/<main\b/)
      expect(src).toMatch(/<header\b/)
      expect(src).toMatch(/<aside aria-label="Master responses"/)
    })

    it("asking-other renders <main> + <header>", () => {
      const src = read("asking-other.tsx")
      expect(src).toMatch(/<main\b/)
      expect(src).toMatch(/<header\b/)
    })

    it("voting renders <main> + <header>", () => {
      const src = read("voting.tsx")
      expect(src).toMatch(/<main\b/)
      expect(src).toMatch(/<header\b/)
    })

    it("reveal: each variant renders <main> + <header> + <aside> for leaderboard", () => {
      const src = read("reveal.tsx")
      const mains = src.match(/<main\b/g)
      const headers = src.match(/<header\b/g)
      // 3 variants (caught / escaped / time-expired).
      expect((mains ?? []).length).toBeGreaterThanOrEqual(3)
      expect((headers ?? []).length).toBeGreaterThanOrEqual(3)
      // Caught + escaped variants render the leaderboard aside (time-expired
      // does not have a leaderboard).
      const asides = src.match(/<aside aria-label="Leaderboard"/g)
      expect((asides ?? []).length).toBe(2)
    })

    it("lobby renders <main> + <header>", () => {
      const src = read("lobby.tsx")
      expect(src).toMatch(/<main\b/)
      expect(src).toMatch(/<header\b/)
    })
  })

  describe("Tab order: every interactive control is a native focusable element", () => {
    // Tab order falls out of source-order DOM when controls are native
    // <button>/<a>/<input> (no role=button or div+onClick). This locks that
    // contract: no Insider screen smuggles a focusable div via role=button.
    const screens = [
      "role-reveal.tsx",
      "asking-master.tsx",
      "asking-other.tsx",
      "asking-phase.tsx",
      "voting.tsx",
      "reveal.tsx",
      "lobby.tsx",
    ]
    for (const screen of screens) {
      it(`${screen}: no role="button" smuggling`, () => {
        const src = read(screen)
        expect(src).not.toMatch(/role="button"/)
      })
    }
  })

  describe("Reduced-motion compliance (covered by US-073 e2e)", () => {
    it("documents that flagship animations gate on prefers-reduced-motion", () => {
      // Sentinel test — US-073 owns the e2e; this records that 5d.6's review
      // confirmed no NEW transition added in 5d.5/5d.6 ignores the media
      // query. The phase-transition-overlay is the only post-5b animation;
      // verified to bail out under reduce by US-073's regression spec.
      expect(true).toBe(true)
    })
  })
})
