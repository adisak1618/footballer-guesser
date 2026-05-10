# PRD: Phase 1 — Relocate Headball into apps/headball

**Source of truth:** `~/.gstack/projects/board-game/adisakchaiyakul-main-design-20260508-multigame-platform.md`

**Branch:** `feat/multigame-platform`

**Phase goal:** Move all current Headball code (`app/`, `components/`, `lib/`, `public/`, `e2e/`, `scripts/`) into `apps/headball/` with zero behavior change. All existing tests pass. Vercel deploys headball app from new path. Headball is functionally identical at the end of this phase — just lives in a different folder.

**Honest estimate:** 2 working days.

**Dependencies:** Phase 0 must be COMPLETE (`phase-0-done` tag pushed).

---

## Introduction

This phase is `git mv` plus import-path fixups. Risk: existing Realtime subscriptions, Postgres function calls, and Playwright fixtures are tightly coupled to current paths. The REGRESSION-CRITICAL gate at the end is non-negotiable.

## Goals

- All Headball source files relocated from repo root to `apps/headball/`
- All imports updated to new paths
- All 21 unit tests pass from new location
- All 5 e2e specs pass from new location
- Vercel `social-hub-headball` project deploys green from new rootDirectory
- `supabase/` stays at workspace root (single source for all games)
- `bun run dev --filter=@social-hub/headball` works locally

## User Stories

### US-1.1: Relocate app/, components/, lib/, public/ into apps/headball/
**Description:** As a developer, I need the Next.js source files moved into the apps/headball/ directory.

**TDD:** N/A (mechanical move).

**Acceptance Criteria:**
- [ ] `git mv app apps/headball/app`
- [ ] `git mv components apps/headball/components`
- [ ] `git mv lib apps/headball/lib`
- [ ] `git mv public apps/headball/public`
- [ ] `apps/headball/package.json` updated to include all current deps from root package.json
- [ ] Root `package.json` keeps only workspace + Turbo + tsconfig deps; runtime deps move to apps/headball
- [ ] `bun install` runs cleanly
- [ ] `bunx tsc --noEmit` passes from `apps/headball/`

### US-1.2: Relocate e2e/, scripts/, and test config into apps/headball/
**Description:** As a developer, I need test infrastructure to move with the code so tests can find their fixtures.

**TDD:** Run tests after move.

**Acceptance Criteria:**
- [ ] `git mv e2e apps/headball/e2e`
- [ ] `git mv scripts apps/headball/scripts`
- [ ] `git mv playwright.config.ts apps/headball/`
- [ ] `git mv vitest.config.ts apps/headball/`
- [ ] `git mv next.config.ts apps/headball/`
- [ ] `git mv tailwind.config.* apps/headball/` (if exists; v4 may use postcss config)
- [ ] `git mv tsconfig.json apps/headball/` (extends `../../tsconfig.base.json`)
- [ ] All path references in moved files updated (e.g., `playwright.config.ts` baseURL, vitest aliases)
- [ ] `cd apps/headball && bunx vitest run` passes all 21 tests
- [ ] `cd apps/headball && bunx playwright test` passes all 5 e2e specs (after `bunx supabase start` from workspace root)

### US-1.3: Verify supabase/ stays at workspace root
**Description:** As the maintainer, I need supabase migrations to remain at workspace root since all 3 apps share one DB.

**TDD:** Verify migrations still apply.

**Acceptance Criteria:**
- [ ] `supabase/` directory remains at workspace root (NOT moved into apps/headball)
- [ ] `bunx supabase status` works from workspace root
- [ ] `bunx supabase db reset` from workspace root applies all 12 migrations cleanly
- [ ] Headball app can still connect to local Supabase (URL/anon key in `.env.local`)

### US-1.4: Update CLAUDE.md and README to reflect new dev workflow
**Description:** As future-you, I need docs to say `cd apps/headball && bun run dev` not just `bun run dev`.

**TDD:** N/A (docs).

**Acceptance Criteria:**
- [ ] `CLAUDE.md` updated: dev command, test commands, project structure section
- [ ] `README.md` updated: setup instructions reflect monorepo
- [ ] Workspace-level `bun run dev` script proxies to `turbo run dev --filter=@social-hub/headball` for backward compat
- [ ] Workspace-level `bunx vitest run` still works (Turbo runs tests across all apps that have them — currently just headball)

### US-1.5: Verify Vercel headball project deploys from new path
**Description:** As the maintainer, I need to confirm Vercel deploys after the path change before advancing.

**TDD:** Push and verify.

**Acceptance Criteria:**
- [ ] Push branch to GitHub
- [ ] Vercel `social-hub-headball` project triggers preview deploy
- [ ] Deploy succeeds (rootDirectory = `apps/headball`)
- [ ] Preview URL renders Headball home page identically to main
- [ ] Manual smoke test: create room, join with second browser, play one round, verify it works

### US-1.6: REGRESSION-CRITICAL gate (REG-1 from eng review)
**Description:** As the maintainer, I MUST verify zero regressions before advancing to Phase 2. This is the IRON RULE.

**TDD:** Full test suite.

**Acceptance Criteria:**
- [ ] `bunx tsc --noEmit` from workspace root passes
- [ ] `bun run lint` passes
- [ ] `cd apps/headball && bunx vitest run` shows 21/21 pass
- [ ] `cd apps/headball && bunx playwright test` shows 5/5 pass (after supabase start)
- [ ] Vercel headball preview deploys green
- [ ] **/qa GATE:** Run `/qa standard` against the headball Vercel preview URL. Compare to Phase 0 baseline. ZERO new bugs allowed. ZERO regressions allowed.
- [ ] If any regression: STOP, investigate, fix, re-run /qa. Do not advance.

## Functional Requirements

- FR-1.1: All Headball source code lives under `apps/headball/`.
- FR-1.2: `supabase/` remains at workspace root.
- FR-1.3: All imports use relative paths or `@/` alias scoped to apps/headball; no cross-app imports yet (Phase 2 introduces packages).
- FR-1.4: Existing Headball functionality is byte-identical from a user perspective.

## Non-Goals

- Extracting any shared code into packages (Phase 2).
- Modifying any Postgres functions or tables.
- Changing realtime subscription patterns.
- Refactoring component internals.
- Adding any features.

## Technical Considerations

- Bun workspaces will hoist node_modules; check that `playwright` browsers are installed in the right scope (`bunx playwright install` may need re-running after the move).
- Next.js 16 may cache build artifacts; clear `.next` between attempts if behavior seems weird.
- The `lib/round-trigger.ts` and any other files using `import { ... } from "@/lib/..."` need their tsconfig `paths` updated to scope `@/` to `apps/headball/`.

## Success Metrics

- 21/21 unit tests pass
- 5/5 e2e specs pass
- 0 visual regressions on /qa
- Vercel deploys green from new path

## Open Questions

- None.

---

## /qa GATE PROTOCOL

Same as Phase 0 protocol. Run /qa against the post-Phase-1 preview URL. Compare to Phase 0 baseline. Block Phase 2 unless score holds or improves.

## Phase Boundary Marker

Phase 1 is COMPLETE when:
- All US-1.x stories show all checkboxes checked
- /qa GATE passes (zero regressions)
- Git tag `phase-1-done` pushed

Then read `tasks/prd-phase-2-extract-packages.md`.
