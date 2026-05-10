import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// Issue #16 — simplified asking-phase + compact in-game header.
//
// Mirrors the source-text contract pattern from us-080-a11y.test.ts: this
// vitest project runs in a node env without React rendering, so we read each
// asking-phase source file and assert the rubric's acceptance criteria are
// encoded in source. Browser-level visual verification happens via Playwright
// E2E (insider-asking-simplified.spec.ts) and the rubric's manual /browse QA.

const APP_ROOT = join(__dirname, "..", "..")
const ROOM_DIR = join(APP_ROOT, "app", "room", "[code]")

function read(rel: string): string {
  return readFileSync(join(ROOM_DIR, rel), "utf8")
}

describe("Issue #16 — Insider asking phase simplification", () => {
  describe("Master view (asking-master.tsx)", () => {
    const src = read("asking-master.tsx")

    it("renders exactly one primary action: ทายถูกแล้ว", () => {
      expect(src).toMatch(/data-testid="master-mark-correct-cta"/)
      expect(src).toMatch(/ทายถูกแล้ว/)
    })

    it("retains existing ทายถูกแล้ว styling (goal-red bg, min-h-14, font-display 20px)", () => {
      // Mirror of the original lines 313-324 contract from before #16.
      const cta = src.match(
        /data-testid="master-mark-correct-cta"[\s\S]*?<\/button>/,
      )
      expect(cta).not.toBeNull()
      const [block] = cta ?? [""]
      expect(block).toMatch(/min-h-14/)
      expect(block).toMatch(/bg-goal\b/)
      expect(block).toMatch(/active:bg-goal-active/)
      expect(block).toMatch(/font-display text-\[20px\] uppercase tracking-\[1px\]/)
    })

    it("does NOT render Y/N/Unsure buttons", () => {
      expect(src).not.toMatch(/master-respond-yes/)
      expect(src).not.toMatch(/master-respond-no/)
      expect(src).not.toMatch(/master-respond-unsure/)
      expect(src).not.toMatch(/ResponseButton/)
    })

    it("does NOT render the response feed accordion", () => {
      expect(src).not.toMatch(/master-feed-accordion-toggle/)
      expect(src).not.toMatch(/master-feed-trail/)
      expect(src).not.toMatch(/master-feed-list/)
    })

    it("does NOT subscribe to game_insider_responses Realtime", () => {
      expect(src).not.toMatch(/game_insider_responses/)
      expect(src).not.toMatch(/postgres_changes/)
    })

    it("does NOT render respondError UI", () => {
      expect(src).not.toMatch(/respondError/)
      expect(src).not.toMatch(/setRespondError/)
    })

    it("retains the master-asking-secret-reminder element (Master needs the secret)", () => {
      expect(src).toMatch(/data-testid="master-asking-secret-reminder"/)
      expect(src).toMatch(/Secret: \{secret\.toUpperCase\(\)\}/)
    })

    it("renders the shared AskingHeader with role='master'", () => {
      expect(src).toMatch(/import \{ AskingHeader \} from "\.\/asking-header"/)
      expect(src).toMatch(/<AskingHeader[\s\S]*?role="master"/)
    })
  })

  describe("Non-Master view (asking-other.tsx)", () => {
    const src = read("asking-other.tsx")

    it("does NOT render the response feed", () => {
      expect(src).not.toMatch(/asking-other-feed/)
      expect(src).not.toMatch(/ResponseFeedEntry/)
      expect(src).not.toMatch(/game_insider_responses/)
    })

    it("does NOT render the D2 Insider hint", () => {
      expect(src).not.toMatch(/asking-other-insider-hint/)
      expect(src).not.toMatch(/Drop a question/)
      expect(src).not.toMatch(/HINT_SILENCE_THRESHOLD/)
    })

    it("does NOT subscribe to Realtime channels", () => {
      expect(src).not.toMatch(/postgres_changes/)
      expect(src).not.toMatch(/supabase\.channel/)
      expect(src).not.toMatch(/removeChannel/)
    })

    it("renders the shared AskingHeader; passes secret only when role==='insider'", () => {
      expect(src).toMatch(/import \{ AskingHeader \} from "\.\/asking-header"/)
      // Insider receives the secret inline; Common always passes null.
      expect(src).toMatch(
        /insiderSecret=\{role === "insider" \? secret : null\}/,
      )
    })

    it("retains the existing 'ASK OUT LOUD / ถามดัง ๆ' instruction", () => {
      expect(src).toMatch(/ASK OUT LOUD/)
      expect(src).toMatch(/ถามดัง ๆ/)
    })
  })

  describe("Compact in-game header (asking-header.tsx)", () => {
    const src = read("asking-header.tsx")

    it("renders the ASKING phase tag + countdown timer", () => {
      expect(src).toMatch(/data-testid="asking-phase-tag"/)
      expect(src).toMatch(/data-testid="asking-timer"/)
      expect(src).toMatch(/text-error/) // low-time tint
    })

    it("renders a role badge for each of the three roles, reusing the shared RoleBadge", () => {
      expect(src).toMatch(/import \{ RoleBadge \} from "@social-hub\/ui"/)
      expect(src).toMatch(/asking-master-role-badge/)
      expect(src).toMatch(/asking-insider-role-badge/)
      expect(src).toMatch(/asking-common-role-badge/)
    })

    it("renders Thai role-specific how-to-play copy matching the issue spec", () => {
      // Master copy from the issue body.
      expect(src).toMatch(/รู้คำลับ ตอบคำถามด้วยปาก กดปุ่มเมื่อมีคนทายถูก/)
      // Common copy.
      expect(src).toMatch(
        /ไม่รู้คำลับ ถามคำถามให้กลุ่มหาคำให้เจอ และจับ Insider ให้ได้/,
      )
      // Insider copy.
      expect(src).toMatch(
        /รู้คำลับ ช่วยให้กลุ่มทายถูกอย่างเนียน ๆ อย่าให้โดนจับ/,
      )
    })

    it("Insider header shows the secret inline (parity with master-asking-secret-reminder)", () => {
      expect(src).toMatch(/data-testid="asking-insider-secret"/)
      // Same Bebas 32px on-dark-soft contract used by the Master reminder.
      expect(src).toMatch(
        /asking-insider-secret"[\s\S]*?font-hero text-\[32px\][\s\S]*?text-on-dark-soft/,
      )
      // Gated on role==='insider' AND insiderSecret being non-null.
      expect(src).toMatch(/role === "insider" && insiderSecret/)
    })

    it("uses Stadium Energy tokens (Bebas Neue, hairline borders, on-dark text)", () => {
      expect(src).toMatch(/font-hero/) // Bebas Neue
      expect(src).toMatch(/font-display/) // Anton (display)
      expect(src).toMatch(/border-hairline/)
      expect(src).toMatch(/text-on-dark/)
    })
  })

  describe("Asking-phase router (asking-phase.tsx)", () => {
    const src = read("asking-phase.tsx")

    it("fetches the secret for every role; result is gated client-side", () => {
      // Pre-#16 only the Master fetched the secret. Insider now needs it
      // inline in the compact header.
      expect(src).toMatch(/getMyInsiderSecret/)
      // Single load path (no role gate around the RPC call itself — the
      // RPC returns NULL for commons per migration 0021).
      const code = src
        .replace(/\/\/[^\n]*\n/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
      expect(code).not.toMatch(/if \(r === "master"\)[\s\S]*?getMyInsiderSecret/)
    })

    it("passes secret to AskingOther only when otherRole==='insider'", () => {
      expect(src).toMatch(/secret=\{otherRole === "insider" \? secret : null\}/)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Issue #23 — Round counter X/Y on every mid-game Insider screen.
//
// Source-text contract: the in-game header components must render
// "ROUND X / Y" (asking) or "ROUND X / Y RESULT" (reveal), and the round-
// total prop must be plumbed through the asking + voting + reveal stack.
// LobbyView's Start CTA must flip to "Start Round next / total" once at
// least one round has been played, and stay "Start Game" for the initial
// lobby. roundTotal > 1 is the canonical case (default Insider rooms ship
// with max_rounds = 5).
// ─────────────────────────────────────────────────────────────────────────────

describe("Issue #23 — Round counter X/Y mid-game", () => {
  describe("AskingHeader (asking-header.tsx)", () => {
    const src = read("asking-header.tsx")

    it("declares round + roundTotal as numeric props", () => {
      expect(src).toMatch(/round:\s*number/)
      expect(src).toMatch(/roundTotal:\s*number/)
    })

    it("renders the ROUND X / Y counter in the header", () => {
      expect(src).toMatch(/data-testid="asking-round-counter"/)
      // Bound directly to the props — guards against a stale "ROUND 1 / 1"
      // literal slipping in.
      expect(src).toMatch(/ROUND \{round\} \/ \{roundTotal\}/)
    })

    it("uses Stadium Energy tokens for the counter (font-display + tabular-nums)", () => {
      const counter = src.match(
        /asking-round-counter"[\s\S]*?<\/span>/,
      )
      expect(counter).not.toBeNull()
      const [block] = counter ?? [""]
      expect(block).toMatch(/font-display/)
      expect(block).toMatch(/tabular-nums/)
      expect(block).toMatch(/uppercase/)
    })
  })

  describe("Asking router + sub-screens plumb roundTotal", () => {
    it("AskingPhase declares + forwards roundTotal", () => {
      const src = read("asking-phase.tsx")
      expect(src).toMatch(/roundTotal:\s*number/)
      // Forwarded to BOTH the master and the non-master sub-screen.
      expect(src).toMatch(/<AskingMaster[\s\S]*?roundTotal=\{roundTotal\}/)
      expect(src).toMatch(/<AskingOther[\s\S]*?roundTotal=\{roundTotal\}/)
    })

    it("AskingMaster forwards roundTotal to AskingHeader", () => {
      const src = read("asking-master.tsx")
      expect(src).toMatch(/roundTotal:\s*number/)
      expect(src).toMatch(/<AskingHeader[\s\S]*?roundTotal=\{roundTotal\}/)
    })

    it("AskingOther forwards roundTotal to AskingHeader", () => {
      const src = read("asking-other.tsx")
      expect(src).toMatch(/roundTotal:\s*number/)
      expect(src).toMatch(/<AskingHeader[\s\S]*?roundTotal=\{roundTotal\}/)
    })
  })

  describe("Voting plumbs roundTotal", () => {
    const src = read("voting.tsx")

    it("declares roundTotal in VotingProps", () => {
      expect(src).toMatch(/roundTotal:\s*number/)
    })
  })

  describe("Reveal renders ROUND X / Y RESULT in all three variants", () => {
    const src = read("reveal.tsx")

    it("declares roundTotal in RevealProps and destructures it", () => {
      expect(src).toMatch(/roundTotal:\s*number/)
      expect(src).toMatch(/\{[^}]*roundTotal[^}]*\}\s*:\s*RevealProps/)
    })

    it("escaped + caught variants render ROUND X / Y RESULT (binds to props)", () => {
      // Both reveal-round-header occurrences should now be ROUND {round} / {roundTotal} RESULT.
      const matches = src.match(/ROUND \{round\} \/ \{roundTotal\} RESULT/g) ?? []
      // Three variants: time-expired (label), escaped (header), caught (header).
      expect(matches.length).toBeGreaterThanOrEqual(3)
      // Pre-#23 literal must be gone (caught/escaped).
      expect(src).not.toMatch(/>\s*ROUND \{round\} RESULT\s*</)
    })

    it("time-expired variant header includes / Y RESULT", () => {
      // The 8c TIME-UP variant's pre-header label was "ROUND {round}";
      // it now reads "ROUND {round} / {roundTotal} RESULT".
      const block = src.match(
        /reveal-time-expired-round-label"[\s\S]*?<\/p>/,
      )
      expect(block).not.toBeNull()
      const [label] = block ?? [""]
      expect(label).toMatch(/ROUND \{round\} \/ \{roundTotal\} RESULT/)
    })
  })

  describe("Lobby surfaces max_rounds + LobbyView CTA copy", () => {
    const src = read("lobby.tsx")

    it("InsiderRoom selects max_rounds from supabase", () => {
      // Type field …
      expect(src).toMatch(/max_rounds:\s*number\s*\|\s*null/)
      // …and the SELECT list must include max_rounds (otherwise the type
      // is a lie at runtime — Supabase only returns what you ask for).
      expect(src).toMatch(
        /\.select\(\s*"id, code, status, host_player_id, current_round, max_rounds"\s*\)/,
      )
    })

    it("forwards roundTotal (max_rounds fallback) to AskingPhase / Voting / Reveal", () => {
      // Single derivation site near the phase router (room.max_rounds ?? round).
      expect(src).toMatch(/const roundTotal\s*=\s*room\.max_rounds\s*\?\?\s*round/)
      expect(src).toMatch(/<AskingPhase[\s\S]*?roundTotal=\{roundTotal\}/)
      expect(src).toMatch(/<Voting[\s\S]*?roundTotal=\{roundTotal\}/)
      expect(src).toMatch(/<Reveal[\s\S]*?roundTotal=\{roundTotal\}/)
    })

    it("Start CTA flips to Start Round next/total once a round has been played", () => {
      // Initial lobby gate: current_round < 1 keeps "Start Game".
      expect(src).toMatch(/currentRound >= 1/)
      // Next-round number is current_round + 1.
      expect(src).toMatch(/nextRound\s*=\s*currentRound\s*\+\s*1/)
      // Between-rounds copy uses both nextRound and roundTotal.
      expect(src).toMatch(
        /Start Round \$\{nextRound\} \/ \$\{roundTotal\}/,
      )
      // Initial copy still present.
      expect(src).toMatch(/"Start Game →"/)
    })
  })
})
