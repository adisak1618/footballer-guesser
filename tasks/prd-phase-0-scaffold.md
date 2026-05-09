# PRD: Phase 0 — Scaffold Monorepo

**Source of truth:** `~/.gstack/projects/board-game/adisakchaiyakul-main-design-20260508-multigame-platform.md`
(read this before starting any story — design doc has full decision context)

**Branch:** `feat/multigame-platform`

**Phase goal:** Convert the single-app `board-game` repo into a Bun-workspaces + Turborepo monorepo skeleton with empty `apps/{hub,headball,insider}` and `packages/{core,ui,types}`. Three Vercel projects deploy successfully from the monorepo. Existing Headball code is NOT yet moved (Phase 1 does that).

**Honest estimate:** 1 working day.

---

## Introduction

This phase is pure plumbing. Zero user-facing changes. The deliverable is "Vercel deploys 3 zero-byte apps from one monorepo with shared env vars." If this fails, the whole platform plan needs rework.

## Goals

- Bun workspaces configured at repo root with `apps/*` and `packages/*`.
- Turborepo with `dev`, `build`, `lint`, `test` pipelines.
- Three Vercel projects (hub, headball, insider) all linked to one Supabase staging project (T-5.C from eng review).
- Each Vercel project deploys a placeholder Next.js 16 app from its `rootDirectory`.
- Existing Headball code at repo root is untouched; tests still pass.

## User Stories

### US-0.1: Initialize Bun workspaces at repo root
**Description:** As a developer, I need workspace config so Bun can resolve `@social-hub/*` package imports across apps.

**TDD:** No test (configuration).

**Acceptance Criteria:**
- [ ] Root `package.json` has `"workspaces": ["apps/*", "packages/*"]`
- [ ] `bun install` runs cleanly with no errors
- [ ] Existing `bun run dev` (current Headball app) still starts on port 3000
- [ ] Existing `bunx vitest run` passes all 21 tests
- [ ] Typecheck passes: `bunx tsc --noEmit`

### US-0.2: Add Turborepo with pipelines
**Description:** As a developer, I need Turbo so changes to `packages/core` invalidate the right downstream builds.

**TDD:** No test (configuration).

**Acceptance Criteria:**
- [ ] `bun add -d turbo` at workspace root
- [ ] `turbo.json` defines `dev` (no cache, persistent), `build` (depends on `^build`), `lint`, `test` pipelines
- [ ] `bunx turbo run lint` runs on existing code without error
- [ ] Existing tests still pass

### US-0.3: Create empty apps/ and packages/ directories with placeholder files
**Description:** As a developer, I need the monorepo skeleton so Vercel has rootDirectory targets to point at.

**TDD:** No test (scaffolding).

**Acceptance Criteria:**
- [ ] Directories created: `apps/hub`, `apps/headball`, `apps/insider`, `packages/core`, `packages/ui`, `packages/types`
- [ ] Each has minimal `package.json` with `"name": "@social-hub/<name>"` and version `0.0.1`
- [ ] `apps/hub` has minimal `next.config.ts` and `app/page.tsx` returning "Hub placeholder"
- [ ] `apps/insider` has minimal `next.config.ts` and `app/page.tsx` returning "Insider placeholder"
- [ ] `apps/headball` is EMPTY (Phase 1 fills it; current code stays at repo root)
- [ ] Each `packages/*` has empty `index.ts` exporting nothing
- [ ] `bun install` resolves all workspace packages
- [ ] `bunx tsc --noEmit` passes

### US-0.4: Configure shared tsconfig.base.json
**Description:** As a developer, I need shared TS config so apps and packages have consistent strict mode + path aliases.

**TDD:** No test (configuration).

**Acceptance Criteria:**
- [ ] `tsconfig.base.json` at workspace root with strict mode, ES2022 target, module ESNext, paths for `@social-hub/*` resolving to `packages/*/src/index.ts`
- [ ] Each `apps/*/tsconfig.json` and `packages/*/tsconfig.json` extends base
- [ ] `bunx tsc --noEmit` from workspace root passes for all apps + packages

### US-0.5: Create three Vercel projects with rootDirectory pointing at apps/
**Description:** As the maintainer, I need three Vercel deploys verified before any code moves so the monorepo split is provably feasible.

**TDD:** No test (manual operational verification).

**Acceptance Criteria:**
- [ ] Vercel project `social-hub-hub` created, rootDirectory = `apps/hub`, framework preset = Next.js, install command = `cd ../.. && bun install`, build command = `cd ../.. && bunx turbo run build --filter=@social-hub/hub`
- [ ] Vercel project `social-hub-headball` created, rootDirectory = `apps/headball` (will populate in Phase 1)
- [ ] Vercel project `social-hub-insider` created, rootDirectory = `apps/insider`
- [ ] All 3 projects share env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` pointing at staging Supabase project (T-5.C)
- [ ] Pushing this branch produces 3 successful preview deploys: hub shows "Hub placeholder", insider shows "Insider placeholder", headball builds (empty, fine for now)
- [ ] Manual: copy preview URLs into PR description for review

### US-0.6: Set up staging Supabase project (T-5.C)
**Description:** As the maintainer, I need a non-prod Supabase so previews can hit a real DB without polluting any production data.

**TDD:** No test (operational).

**Acceptance Criteria:**
- [ ] Create new Supabase project named `headball-staging` (separate from any prod project)
- [ ] Apply current Headball migrations (`supabase/migrations/0001-0012`) via `bunx supabase db push --linked`
- [ ] Verify staging schema matches local: `bunx supabase db diff --linked` returns no diff
- [ ] Update `.env.local.example` documenting the two env vars
- [ ] Document the local-vs-staging-vs-prod story in `supabase/migrations/README.md` (also gets the T-7 release-order convention later)

### US-0.7: Phase 0 regression gate
**Description:** As the maintainer, I need to know nothing broke before advancing to Phase 1.

**TDD:** Run all existing tests.

**Acceptance Criteria:**
- [ ] `bunx tsc --noEmit` passes
- [ ] `bun run lint` passes
- [ ] `bunx vitest run` passes all 21 tests
- [ ] `bunx playwright test` passes all 5 e2e specs (after `bunx supabase start`)
- [ ] Existing `bun run dev` still works on `localhost:3000` showing current Headball
- [ ] All 3 Vercel projects show successful preview deploys
- [ ] **/qa GATE:** Run `/qa` against current Headball preview URL to baseline it. Capture before-restructure health score. Block Phase 1 if /qa shows new bugs vs main.

## Functional Requirements

- FR-0.1: Repository structure remains backwards-compatible with existing dev workflow at this stage (Headball at root still works).
- FR-0.2: Vercel monorepo deploys must succeed for all three projects.
- FR-0.3: Bun workspaces resolve `@social-hub/*` imports.
- FR-0.4: Turborepo invalidates correctly across package dependencies.
- FR-0.5: Staging Supabase mirrors current production schema.

## Non-Goals

- Moving Headball code into `apps/headball` (Phase 1).
- Extracting any shared packages (Phase 2).
- Adding new schema (Phase 3).
- Building hub UI (Phase 4) or Insider (Phase 5).
- Setting up custom domain (deferred to v2).
- Setting up real prod Supabase (deferred until Insider ships per T-5.C).

## Technical Considerations

- Vercel rootDirectory + monorepo + Bun workspaces is a Layer 2 pattern. If Vercel build fails on the install/build commands, try `bun install --no-frozen-lockfile` in the install command.
- Turborepo cache hits depend on consistent `outputs` config. If builds feel slow, check `turbo.json` outputs match `next.config.ts` build output.
- Bun workspaces use symlinks; some IDEs need restart to resolve `@social-hub/*` types.

## Success Metrics

- 3 green Vercel preview deploys on this branch
- 0 regressions in 21 unit tests + 5 e2e specs
- /qa baseline captured

## Open Questions

- None (all settled in design doc).

---

## /qa GATE PROTOCOL

After ALL stories above pass, before advancing to Phase 1:

1. Push branch to GitHub
2. Wait for 3 Vercel preview deploys to succeed
3. Run `/qa standard` against the headball preview URL
4. Compare /qa health score to baseline on main
5. If score regresses or /qa finds new bugs: STOP, investigate, fix, re-run /qa
6. If clean: commit a `chore: phase 0 complete` marker, advance to Phase 1 PRD

## Phase Boundary Marker

Phase 0 is COMPLETE when:
- All US-0.x stories show all checkboxes checked
- /qa GATE passes
- Branch is pushed and 3 Vercel deploys are green
- A git tag `phase-0-done` is pushed

Then read `tasks/prd-phase-1-relocate-headball.md`.
