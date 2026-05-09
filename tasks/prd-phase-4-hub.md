# PRD: Phase 4 — apps/hub (Game Selector + Cross-Subdomain Join Dispatcher)

**Source of truth:** `~/.gstack/projects/board-game/adisakchaiyakul-main-design-20260508-multigame-platform.md`

**Branch:** `feat/multigame-platform`

**Phase goal:** Build the hub app as a minimal game selector + 6-char-code join dispatcher. Identity-free per design (no shared cookies on Vercel preview URLs). Stadium gate metaphor per D5 from design review.

**Honest estimate:** 2 working days.

**Dependencies:** Phase 3 must be COMPLETE (`phase-3-done` tag pushed).

---

## Introduction

The hub is the apex domain (when a domain exists) and currently the `social-hub-hub` Vercel project. Two screens: home (game selector) and join (code entry). When user enters code, hub queries `rooms.game_type`, redirects to the right subdomain.

## Goals

- `apps/hub/app/page.tsx` — game selector with stadium-gate metaphor
- `apps/hub/app/join/page.tsx` — 6-char code entry → cross-subdomain redirect
- `apps/hub/app/actions/lookup-room.ts` — server action that queries `rooms.game_type`
- Stadium Energy tokens applied (uses `@social-hub/ui`)
- All states covered: loading, empty, error
- Cross-subdomain redirect works on Vercel preview URLs

## User Stories

### US-4.1: Add rooms.game_type column to schema
**Description:** As the hub, I need to know which game a room belongs to so I can redirect correctly.

**TDD:** Test-first.

**Acceptance Criteria:**
- [ ] Write failing test in `packages/core/src/__tests__/rooms-game-type.test.ts`: query rooms returns `game_type` column
- [ ] Create migration `0016_rooms_game_type.sql`:
  - `alter table rooms add column game_type text not null default 'headball'`
  - Backfill: existing rows get `'headball'` (the default handles this for new inserts; for existing rows the default already applied)
  - Add check constraint: `check (game_type in ('headball','insider'))`
  - No realtime publication change needed (rooms already in publication, alter add column is propagated)
- [ ] Apply migration to staging
- [ ] Regenerate `packages/types/src/database.types.ts`
- [ ] Test passes

### US-4.2: Build apps/hub home page with stadium-gate metaphor (D5)
**Description:** As a user, I want to see "PICK YOUR GAME" with two large gate-style cards so I can choose Headball or Insider.

**TDD:** Test-first via Playwright e2e.

**Acceptance Criteria:**
- [ ] Write failing e2e in `apps/hub/e2e/home.spec.ts`: visit `/`, assert page contains "GATE A" + "HEADBALL", "GATE B" + "INSIDER", and a "ENTER CODE" CTA
- [ ] Implement `apps/hub/app/page.tsx`:
  - Brand mark: ⚽ HEADBALL SOCIAL GAMES (Anton 32px, goal-red, IBM Plex Thai 14px caption per DESIGN.md)
  - Section header: "PICK YOUR GAME" (Anton 28px display-md)
  - Two game gates (full viewport-width cards): GATE A / HEADBALL on tag-red, GATE B / INSIDER on tag-purple
  - Each gate links to `<game>.<vercel-preview>.vercel.app/` (URL constructed from env var)
  - "ENTER CODE" secondary button → `/join`
  - All copy in Thai + English per DESIGN.md
- [ ] Use `@social-hub/ui` primitives (button) + Stadium Energy tokens
- [ ] e2e test passes
- [ ] Manual: deploy to Vercel preview, click each gate, verify redirect to correct subdomain placeholder

### US-4.3: Build /join page with 6-char slot input
**Description:** As a user, I want to type a 6-char code and be sent to the right game.

**TDD:** Test-first via Playwright.

**Acceptance Criteria:**
- [ ] Write failing e2e in `apps/hub/e2e/join.spec.ts`: visit `/join`, type 6-char valid Headball room code, click "JOIN GAME", assert redirect URL contains `headball.` and `/room/<code>`
- [ ] Implement `apps/hub/app/join/page.tsx`:
  - Anton 56px "JOIN ROOM / เข้าร่วมห้อง" header
  - 6-cell slot input (each cell is Bebas 48px, letter-spacing 8px per DESIGN.md room-code typography)
  - Auto-advance on character entry; backspace deletes prev cell; supports paste of 6-char string
  - "JOIN GAME →" goal-red CTA, disabled until 6 chars entered
  - Error banner space (24px reserved) for "room not found" or "room full"
  - Uses `@social-hub/ui` text-input primitive (or new slot-input variant)
- [ ] Add slot-input component to `packages/ui/src/slot-input.tsx`
- [ ] e2e test passes

### US-4.4: Implement lookup-room server action
**Description:** As the hub, I need to query Supabase to find which game a code belongs to.

**TDD:** Test-first via TS integration test.

**Acceptance Criteria:**
- [ ] Write failing test: `lookupRoom('ABCDEF')` returns `{ gameType: 'headball', code: 'ABCDEF' }` if room exists; throws `GameRpcError` with code `'ROOM_NOT_FOUND'` if not
- [ ] Implement `apps/hub/app/actions/lookup-room.ts`:
  - Server action `lookupRoom(code: string)`
  - Validates code format (6 chars, ROOM_CODE_ALPHABET) using `@social-hub/core`
  - Queries `select game_type, status from rooms where code = upper($1)`
  - Returns redirect URL (constructed from env var per game) or throws `GameRpcError`
- [ ] Wire into /join page: on submit, call `lookupRoom`, redirect on success, show banner-error on failure
- [ ] Test passes

### US-4.5: Hub home loading + empty + error states
**Description:** As a user, I need clear feedback during code lookup.

**TDD:** Visual; verify in browser.

**Acceptance Criteria:**
- [ ] Loading state: "JOIN GAME" button shows spinner while server action runs
- [ ] Error state: invalid code → banner-error with "ห้องไม่พบ / Room not found" (uses banner-error from DESIGN.md)
- [ ] Error state: room status is ENDED → banner-error "ห้องนี้จบแล้ว / This room ended"
- [ ] Empty state n/a (no list to be empty)
- [ ] Manual: deploy, test all 3 states in browser

### US-4.6: Phase 4 regression gate
**Description:** As the maintainer, verify hub works AND headball still works.

**TDD:** Full suite + new hub e2e.

**Acceptance Criteria:**
- [ ] `bunx tsc --noEmit` passes
- [ ] `bun run lint` passes
- [ ] All existing tests pass
- [ ] New hub e2e specs pass: `apps/hub/e2e/home.spec.ts` + `apps/hub/e2e/join.spec.ts`
- [ ] Vercel `social-hub-hub` deploys green
- [ ] Vercel `social-hub-headball` still deploys green
- [ ] Cross-subdomain manual test: visit hub preview URL, click GATE A → redirected to headball preview URL home; back to hub, type a real Headball room code → redirected to headball preview URL `/room/<code>`
- [ ] **/qa GATE:** Run `/qa standard` against hub preview URL. Block Phase 5 unless clean.

## Functional Requirements

- FR-4.1: Hub is identity-free. No player_id cookie, no localStorage. Just a dispatcher.
- FR-4.2: Game selection redirects to game's own subdomain home page.
- FR-4.3: Code lookup redirects to `<game-subdomain>/room/<code>`.
- FR-4.4: Stadium Energy tokens applied throughout.
- FR-4.5: All copy bilingual (Thai + English).

## Non-Goals

- Cookie sharing across subdomains (impossible on `*.vercel.app`; deferred to v2 with custom domain).
- Account / login / "your active rooms" features (deferred to v2).
- Game-specific UI (each game owns its own subdomain).
- Hub-side rate limiting on code lookup (low traffic at v1).

## Technical Considerations

- The redirect URL per game is constructed from env vars: `NEXT_PUBLIC_HEADBALL_URL`, `NEXT_PUBLIC_INSIDER_URL`. On Vercel preview these point at the per-PR preview URLs.
- Slot input pattern: track focused cell, auto-advance on character entry, handle paste, handle backspace going to previous cell. ~60 lines of React state.
- Server action runs on Vercel function (Fluid Compute by default in Next.js 16). Should be <100ms.

## Success Metrics

- Hub home renders with stadium-gate metaphor at 375px and 1440px
- Cross-subdomain redirect works (hub → headball preview URL) on Vercel
- /qa hub preview shows clean

## Open Questions

- None for v1.

---

## /qa GATE PROTOCOL

Run /qa standard against hub preview URL. Test home, join with valid code, join with invalid code. Block Phase 5 unless clean.

## Phase Boundary Marker

Phase 4 is COMPLETE when:
- All US-4.x stories show all checkboxes checked
- /qa GATE passes
- Git tag `phase-4-done` pushed

Then read `tasks/prd-phase-5-insider.md`.
