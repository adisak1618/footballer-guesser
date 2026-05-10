# PRD: Phase 2 — Extract packages/core, packages/ui, packages/types-stable

**Source of truth:** `~/.gstack/projects/board-game/adisakchaiyakul-main-design-20260508-multigame-platform.md`

**Branch:** `feat/multigame-platform`

**Phase goal:** Move shared code from `apps/headball/lib/` and `apps/headball/components/ui/` into reusable packages. Extract ONLY stable primitives. `database.types.ts` STAYS in apps/headball/lib/ during this phase per C3+T-6 (Phase 3 regenerates types after schema changes).

**Honest estimate:** 3 working days.

**Dependencies:** Phase 1 must be COMPLETE (`phase-1-done` tag pushed).

---

## Introduction

This phase introduces the shared platform layer that future games will reuse. Risk: extracting Headball-specific concepts into "core" by accident. After Insider is half-built (Phase 5), expect to refactor packages/core once. Plan for that.

## Goals

- `packages/core` exposes: room codes, supabase clients, realtime hook, dispatch helper with GameRpcError, player ID helpers
- `packages/ui` exposes: shadcn primitives + Tailwind preset + Stadium Energy tokens
- `packages/types` exposes: only cross-game types (Room, Player, GameType) — NO database.types.ts yet
- Headball imports from `@social-hub/core`, `@social-hub/ui`, `@social-hub/types`
- All 21 unit tests + 5 e2e specs still pass

## User Stories

### US-2.1: Extract room-code logic to packages/core
**Description:** As a future game developer, I need room-code generation + retry as a reusable primitive.

**TDD:** Tests already exist in `apps/headball/lib/__tests__/room-code.test.ts` — move them with the source. After move, tests run against the package, not Headball's lib.

**Acceptance Criteria:**
- [ ] Move `lib/room-code.ts` to `packages/core/src/room-code.ts`
- [ ] Move `lib/__tests__/room-code.test.ts` to `packages/core/src/__tests__/room-code.test.ts`
- [ ] Export from `packages/core/src/index.ts`: `generateRoomCode`, `createRoomWithRetry`, `RoomCodeCollisionError`, `ROOM_CODE_ALPHABET`, `ROOM_CODE_LENGTH`
- [ ] Headball imports `from '@social-hub/core'` instead of `from '@/lib/room-code'`
- [ ] `bunx vitest run` from workspace root passes all room-code tests

### US-2.2: Extract supabase clients to packages/core
**Description:** As a future game developer, I need browser + server Supabase clients without re-implementing them.

**TDD:** No existing test; trust integration tests from Headball app.

**Acceptance Criteria:**
- [ ] Move `lib/supabase.ts` (browser client) to `packages/core/src/supabase-browser.ts`
- [ ] Move `lib/supabase-server.ts` to `packages/core/src/supabase-server.ts`
- [ ] Both accept `Database` type as a generic so apps can pass their own
- [ ] Export `createSupabaseBrowserClient<TDB>()` and `createSupabaseServerClient<TDB>()`
- [ ] Headball uses `createSupabaseBrowserClient<Database>()` passing its still-app-local `Database` type
- [ ] Headball still works: `bunx vitest run` + `bunx playwright test` pass

### US-2.3: Build packages/core/dispatch.ts with GameRpcError (C1.B)
**Description:** As a future game developer, I need a typed RPC wrapper with consistent error handling per the C1.B decision.

**TDD:** Test-first. Write `dispatch.test.ts` with: success case, Postgres error code parsing (PGAMExx codes), unknown error, network error. Then implement.

**Acceptance Criteria:**
- [ ] Write failing test in `packages/core/src/__tests__/dispatch.test.ts` covering: happy path returns data, Postgres error with `errcode: 'PGAME01'` throws `GameRpcError` with code `'PGAME01'`, unknown error throws `GameRpcError` with code `'UNKNOWN'`
- [ ] Implement `dispatch<T>(supabase, rpcName, args): Promise<T>` in `packages/core/src/dispatch.ts`
- [ ] Implement `GameRpcError` class with `.code: string`, `.message: string`, `.context: Record<string,unknown>`
- [ ] Implement `parsePgErrCode(error)` helper that extracts the errcode from Supabase error shape
- [ ] Document error code conventions in `packages/core/error-codes.md`: `PGAME01-PGAME09` reserved for cross-game (e.g., 01 = pack not found), `PGAME10-PGAME49` reserved for Insider, `PGAME50-PGAME89` reserved for future games
- [ ] Tests pass

### US-2.4: Extract realtime subscription hook to packages/core
**Description:** As a future game developer, I need the Realtime subscribe-with-reconnect pattern as a hook.

**TDD:** No existing test; refactor without changing behavior, integration covered by e2e.

**Acceptance Criteria:**
- [ ] Identify the realtime subscription block in `apps/headball/app/room/[code]/page.tsx`
- [ ] Extract into `packages/core/src/use-room-realtime.ts` as a generic hook accepting room id, table list, and an `onChange` callback
- [ ] Headball page imports the hook
- [ ] e2e specs (`reconnect.spec.ts`, `race-guess.spec.ts`) still pass
- [ ] `bunx playwright test` shows 5/5 pass

### US-2.5: Extract player-id helpers to packages/core
**Description:** As a future game developer, I need `getOrCreatePlayerId()` for anon player identity.

**TDD:** Test-first. Write tests for: returns existing player_id from localStorage, generates UUID + persists if missing, namespace by game.

**Acceptance Criteria:**
- [ ] Write failing test in `packages/core/src/__tests__/player-id.test.ts`
- [ ] Implement `getOrCreatePlayerId(namespace: string): string` reading/writing `localStorage[<namespace>_player_id]` (default namespace = "headball" for back-compat)
- [ ] Identify usage of `PLAYER_ID_STORAGE_KEY` in `lib/game-store.ts`; replace with `getOrCreatePlayerId('headball')`
- [ ] Tests pass + Headball still works

### US-2.6: Move shadcn primitives to packages/ui
**Description:** As a future game developer, I need the design system primitives shared so Stadium Energy tokens apply uniformly.

**TDD:** Visual; covered by /qa.

**Acceptance Criteria:**
- [ ] Move `apps/headball/components/ui/button.tsx`, `dialog.tsx`, `input.tsx` to `packages/ui/src/`
- [ ] Move `apps/headball/lib/utils.ts` (cn helper) to `packages/ui/src/utils.ts`
- [ ] Move Tailwind preset (if exists as standalone) or document required Tailwind config in `packages/ui/tailwind-preset.ts`
- [ ] Document Stadium Energy tokens (CSS variables) in `packages/ui/src/tokens.css` — color, typography, spacing, motion
- [ ] Headball imports `from '@social-hub/ui'`
- [ ] Headball still renders identically (visual verification via /qa)

### US-2.7: Create packages/types with cross-game types (NOT database.types.ts yet)
**Description:** As a future game developer, I need shared `Room`, `Player`, `GameType` types — but NOT the auto-generated DB types yet (T-6 says regenerate after Phase 3).

**TDD:** No test; types only.

**Acceptance Criteria:**
- [ ] Create `packages/types/src/index.ts` exporting: `Room` (subset matching the rooms table public columns), `Player` (subset matching players table), `GameType` (string union: `'headball' | 'insider'`), `RoomStatus` enum
- [ ] `database.types.ts` STAYS at `apps/headball/lib/database.types.ts` — do NOT move yet (will regenerate after Phase 3 migrations land)
- [ ] Headball-specific narrow types stay in `apps/headball/lib/types.ts`
- [ ] `bunx tsc --noEmit` passes

### US-2.8: Add CI grep check for Realtime publication discipline (A4)
**Description:** As the maintainer, I need a guard against forgotten `alter publication` lines per A4 from eng review.

**TDD:** Write a script + test it against current migrations (should pass) and a synthetic missing-publication migration (should fail).

**Acceptance Criteria:**
- [ ] Create `scripts/check-realtime-publication.sh` that: greps every `supabase/migrations/*.sql` for `create table` + `alter publication supabase_realtime add table`. For each `create table <name>` (excluding lookup tables tagged with comment `-- no-realtime`), assert a matching publication line exists in any migration up to and including the current one.
- [ ] Wire into `bun run lint` or pre-commit
- [ ] Script passes against current 12 migrations (some tables intentionally not in publication; mark them with `-- no-realtime` comment)
- [ ] Document the convention in `packages/core/README.md`

### US-2.9: Phase 2 regression gate (REG-2 from eng review)
**Description:** As the maintainer, I MUST verify zero regressions before advancing to Phase 3.

**TDD:** Full test suite + manual realtime smoke test.

**Acceptance Criteria:**
- [ ] `bunx tsc --noEmit` from workspace root passes
- [ ] `bun run lint` passes
- [ ] `bunx vitest run` shows 21/21 pass (room-code tests now in packages/core, count holds)
- [ ] `bunx playwright test` shows 5/5 pass
- [ ] Realtime smoke test: 2 browsers, create Headball room, join, play one round, verify state changes propagate via packages/core useRoomRealtime hook
- [ ] Vercel headball preview deploys green
- [ ] **/qa GATE:** Run `/qa standard` against headball preview. Zero new bugs vs Phase 1 baseline.

## Functional Requirements

- FR-2.1: `packages/core` is game-agnostic. No Headball-specific concepts (no `round_state`, no `score_positions`).
- FR-2.2: `packages/ui` is game-agnostic. Components don't reference any specific game.
- FR-2.3: `packages/types` only contains cross-game types.
- FR-2.4: `packages/core/dispatch.ts` is the single typed RPC wrapper for all games.
- FR-2.5: Headball runtime behavior identical to Phase 1.

## Non-Goals

- Moving `database.types.ts` (Phase 3 regenerates after schema changes).
- Adding new schema or RPCs (Phase 3+).
- Building hub or insider UI.
- Refactoring Headball-specific component internals.

## Technical Considerations

- Watch for Headball-specific concepts leaking into `packages/core`. If you catch yourself adding a `Round` type to core, stop and ask whether it really belongs there. Round shape differs per game.
- Tailwind v4 with `@tailwindcss/postcss` v4 has specific monorepo setup. The `packages/ui/tokens.css` file must be imported into each app's `globals.css`.
- shadcn components depend on `cn` helper; ensure cross-package import chain resolves.

## Success Metrics

- 21/21 unit tests pass (some now in packages/core)
- 5/5 e2e specs pass
- 0 visual regressions on /qa
- Headball imports `@social-hub/core`, `@social-hub/ui`, `@social-hub/types` cleanly

## Open Questions

- None.

---

## /qa GATE PROTOCOL

Run /qa standard against headball preview URL. Compare to Phase 1 baseline. Block Phase 3 unless score holds or improves.

## Phase Boundary Marker

Phase 2 is COMPLETE when:
- All US-2.x stories show all checkboxes checked
- /qa GATE passes
- Git tag `phase-2-done` pushed

Then read `tasks/prd-phase-3-content-packs.md`.
