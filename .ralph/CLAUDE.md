# Ralph Agent Instructions — Warewolf Balance & Setup Recommender

You are an autonomous coding agent building the Warewolf Balance & Setup Recommender — a standalone Grimoire-styled web tool for the Thai Werewolf community, shipping before the multiplayer game itself exists. Lives at `apps/warewolf/` inside the existing Bun + Turborepo monorepo.

## Source of Truth (READ THIS FIRST EVERY ITERATION)

- **Design doc:** `~/.gstack/projects/board-game/adisakchaiyakul-main-design-20260512-051400-werewolf-balance-tool.md`
  - The **"Eng Review Decisions (2026-05-12)"** section near the bottom contains the 6 locked architecture decisions. Implementation must honor these (referenced as decision #1–#6 in story acceptance criteria).
  - The **"Reconciliation pass (2026-05-12, post-prototype)"** section captures what changed after the prototype.
  - The **"Design Review Decisions (2026-05-12, Pass 1–7)"** section locks visual + IA decisions.
- **Test plan:** `~/.gstack/projects/board-game/adisakchaiyakul-main-eng-review-test-plan-20260512-171001.md`
- **HTML prototype** (behavioral source of truth): `~/.gstack/projects/board-game/designs/warewolf-full-app-20260512/finalized.html` — line numbers cited throughout story acceptance criteria.
- **PRD tree** (the active feature PRD package):
  - Main PRD: `tasks/warewolf/prd.md`
  - Story files: `tasks/warewolf/stories/US-NNN.md` — **read the file matching the active story BEFORE implementing**
  - Warewolf-scoped Ralph instructions (deeper): `tasks/warewolf/CLAUDE.md`
- **Project conventions:** `CLAUDE.md` at repo root — esp. "Adding a new app" checklist for US-009 and the realtime publication lint discipline.

Story IDs (US-001 through US-027) map to the story files under `tasks/warewolf/stories/`. Each story cites Eng Review Decision numbers (#1–#6) — read the cited decision in the design doc before implementing.

## Locked Eng Review Decisions (cheat-sheet)

1. **Card art:** ship existing JPGs from `apps/warewolf/source/processed/warewolf-card-cropped/` via Sharp → WebP @ 512×768@85 pipeline. User accepted IP risk; no commission for V1.
2. **Solver fallback:** `pickWolvesForBalance` THROWS on empty filtered pool. `computeSetupList` catches and renders `<SolverErrorRow archetype playerCount>` for the affected row. Replaces the prototype `return ['werewolf']` bug at `finalized.html:699`.
3. **Unknown role ID:** `decodeSetup` in `lib/share-url.ts` silently substitutes `villager`. Validator stays STRICT — anything unrecognized is an `unknown-role` blocker. Single source of truth in the parser.
4. **Client state:** thin Zustand store (`lib/store.ts`) + URL canonical for shareable state + localStorage for lang only. Zustand 5.0.12 already in workspace via Headball; reuse.
5. **Locale precedence:** `/[lang]/` segment wins. Middleware 301-redirects `/[lang]/...?lang=other` to match the query.
6. **Category tab mapping:** `lib/category-tabs.ts` derives 6 tabs from team + category per locked JSDoc mapping. `wolves = team==='werewolf'`; `power = category ∈ {protection, kill, vote}`; `social = category ∈ {chaos, vanilla-social}`; vanilla-social subset = {mason, spellcaster, old-hag}.

**CI perf gates:** bundle ≤ 80KB +20% (96KB) on `/setup/customize`, Lighthouse mobile LCP < 2.5s on simulated 3G. Both ERROR-level.

## CRITICAL: kill background processes before ending your response

`claude --print` (the mode you're running in) does NOT exit until ALL Bash subprocesses you started have terminated. If you start a dev server, a watcher, or any long-running process during this iteration, you MUST kill it before ending your response. Otherwise ralph.sh will hang indefinitely waiting for your process to return, and the loop never advances to the next story.

**The most common offender: dev servers.** If you ran ANY of these during this iteration:
- `bun run dev`
- `bun run dev:all`
- `bunx next dev`
- `turbo run dev`
- `supabase functions serve`

You MUST kill them at the very end before returning. Run this as your last Bash call:

```bash
pkill -f "next dev" 2>/dev/null; pkill -f "next-server" 2>/dev/null; pkill -f "turbo run dev" 2>/dev/null; pkill -f "supabase functions serve" 2>/dev/null; true
```

(The trailing `; true` ensures non-zero exit codes from pkill don't make the command "fail" if no processes match.)

**Do NOT kill** `bunx supabase start` (Docker containers — those are managed by `supabase stop`) or your terminal's parent shell.

This rule is non-negotiable. If you skip it, ralph.sh stops on this iteration forever and you've broken the loop for the rest of the run.

## Your Task

1. Read `.ralph/prd.json` to find the highest-priority user story where `passes: false`.
2. Read `.ralph/progress.txt` (Codebase Patterns section first) for prior learnings.
3. Read the story file at `tasks/warewolf/stories/<story-id>.md` for full acceptance criteria + Technical Notes (story file is more detailed than prd.json).
4. Read the design doc section cited in the story's Technical Notes.
5. Verify you're on branch `feat/warewolf`. If not, `git checkout -b feat/warewolf` (create from main on first iteration; checkout existing branch on subsequent iterations).
6. Implement THAT ONE story (and only that story) using the discipline below.
7. Run quality checks per the acceptance criteria.
8. Update CLAUDE.md files in modified directories if you discover reusable patterns.
9. Commit ALL changes with message: `feat: [Story ID] - [Story Title]`.
10. Update `.ralph/prd.json` to set `passes: true` for the completed story.
11. Append to `.ralph/progress.txt` (one-line entry + any new Codebase Patterns if relevant).
12. If story criterion says "push a WIP commit `feat: warewolf lane X complete`" or "push git tag", push it.
13. **MANDATORY FINAL STEP:** run the pkill cleanup above. Even if you didn't think you started a dev server. Belt and suspenders.

## TDD Discipline (per superpowers:test-driven-development)

If the story acceptance criteria mention "Write failing test" or "Tests written":

1. Write the failing test EXACTLY as the criterion describes
2. Run it. Confirm it fails for the expected reason (not a typo)
3. Write minimum implementation to pass the test
4. Run the test. Confirm it passes
5. Refactor if needed (tests still passing)
6. THEN run all other quality checks

Do NOT skip the failing-test step even if you "know what to write." That's the whole point of TDD — the test catches the case where your implementation is silently wrong.

For stories without explicit "test-first" criteria (config files, mechanical moves, docs):
- Write the change
- Run the verification commands listed in acceptance criteria
- Confirm each acceptance criterion is met before marking done

## Verification Discipline (per superpowers:verification-before-completion)

Before marking a story `passes: true`:

1. Read every acceptance criterion checkbox
2. Run the command (or inspection) for each
3. Capture the actual output, not your guess
4. If anything is unclear or missing — STOP. Do NOT mark passes: true.

Evidence before assertions. Always.

## /qa GATE (Lane F boundary — after US-022)

US-022 acceptance criteria include "Trigger /qa GATE per `tasks/warewolf/prd.md` '/qa GATE PROTOCOL' section". When you reach the end of Lane F:

1. Push the branch to GitHub.
2. Wait for the Vercel preview deploy to succeed.
3. Run `/qa standard` against the preview URL.
4. Capture health-score baseline.
5. If `/qa` finds new bugs: STOP THE LOOP. Investigate, fix, re-run `/qa`. Do NOT advance to Lane G with regressions.
6. If clean: commit `chore: warewolf lane F complete` and advance to Lane G.

If `/qa` is unavailable in this autonomous context, surface that and ask the maintainer to run it manually before advancing the next lane.

## Manual Operational Story (Pause Required)

US-027 (Vercel project + subdomain + production deploy) requires manual Vercel dashboard work and DNS provisioning the agent cannot do.

When you reach US-027:

1. Print exactly what the maintainer must do (Vercel project create with the specific rootDirectory/install/build commands; DNS A or CNAME record for the subdomain; TLS verification; three-device smoke test).
2. Do NOT mark passes: true.
3. Append a "PAUSE: manual work required" entry to progress.txt.
4. End your response (no `<promise>COMPLETE</promise>` signal — another iteration will check).
5. The maintainer manually completes, then manually edits prd.json to flip `passes: true` for that story.

## Project Quality Commands

Run these for stories that touch their respective layers:

| Layer | Command |
|---|---|
| Type | `cd apps/warewolf && bunx tsc --noEmit` |
| Lint | `bun run lint` (workspace-wide; includes realtime publication lint that no-ops on warewolf) |
| Unit tests | `bunx vitest run` (workspace-wide) or `cd apps/warewolf && bunx vitest run` |
| E2E tests | `cd apps/warewolf && bunx playwright test` |
| Build | `bunx turbo run build --filter=@social-hub/warewolf` |
| Bundle budget | `bun run check:bundle` (added in US-025) |

No local Supabase needed for warewolf — V1 has zero migrations and no backend.

## Progress Log Format

APPEND to `.ralph/progress.txt`:

```
## [ISO Date/Time] — [Story ID]
- What was implemented
- Files changed
- **Learnings:**
  - Patterns discovered
  - Gotchas encountered
  - Useful context for future iterations
---
```

If you discover a **reusable pattern**, add it to a `## Codebase Patterns` section at the TOP of progress.txt:

```
## Codebase Patterns
- All warewolf solver functions are pure TS, no DOM/browser APIs (must work server-side)
- `decodeSetup` is the sole place that substitutes unknown role IDs (per Eng Review decision #3)
- `<CardArt>` always falls back to `<CardArtPlaceholder>` on 404 — never use raw `next/image` for cards
- ...
```

## CLAUDE.md File Updates (project-level)

If a directory you modified has a `CLAUDE.md` (project-level, NOT this Ralph prompt), append non-obvious learnings there:

- "Grimoire tokens live in `apps/warewolf/app/globals.css`; canonical source is `docs/DESIGN-warewolf.md`. Headball's Stadium Energy is unrelated."
- "Card art is photos of physical Ultimate Werewolf cards; user accepted IP risk per Eng Review decision #1."
- "Path aliases inside `apps/warewolf/`: `@/*` → app root, `@/data/*` → workspace `data/`."

DO NOT add story-specific implementation details. Only patterns useful to future work.

## Project conventions (quick reference)

- Bun + Turborepo. Package manager is `bun` (never npm/yarn/pnpm).
- Path aliases via `@social-hub/*`. Inside `apps/warewolf/`, `@/...` resolves to the app root and `@/data/...` resolves to workspace root `data/`.
- Workspace packages declare `"main": "./src/index.ts"` etc. No build step for shared packages.
- Tests: Vitest unit + Playwright E2E. `apps/warewolf/vitest.config.ts` MUST exclude `e2e/**`.
- `playwright.config.ts` MUST have `workers: 1`.
- Realtime publication lint: Warewolf has no Supabase migrations; `scripts/check-realtime-publication.sh` no-ops cleanly.
- Per-package typecheck: `cd apps/warewolf && bunx tsc --noEmit` (no workspace-root tsconfig).

## Quality Bar (non-negotiable)

- ALL commits must pass typecheck + lint + relevant tests
- Do NOT commit broken code (failing test = green light to commit ONLY if you're in the red phase of TDD and the next iteration will fix it; otherwise broken)
- Keep changes focused to the single story
- Follow existing code patterns from Headball where applicable; reuse shared packages

## Confusion Protocol

If you encounter ambiguity that affects implementation:

- The active story's acceptance criteria contradict the design doc's locked decisions
- A criterion requires a real-world dep (subdomain DNS provisioning, Vercel project creation) — pause and document in `notes`
- Tests fail in a way that suggests a design problem, not a code problem
- Two plausible architectures for the same requirement
- Missing context that would change your approach

STOP. Append the question to progress.txt under a `## Open Questions` section. Do NOT mark passes: true. End your response. The maintainer will resolve and re-trigger Ralph.

## Browser Verification

For UI stories with "Verify in browser using dev-browser skill" criterion (US-013–US-022, US-026):

1. Run `bun run dev` (then kill at end per pkill rule above) OR push to the branch and wait for Vercel preview.
2. Use whatever browser tooling you have (Playwright headed, gstack `/browse`, or a visible Chromium) to navigate to the page.
3. Verify the visible behavior matches the prototype and approved wireframe in the design doc.
4. Take a screenshot, save to `.ralph/screenshots/US-NNN.png`.
5. Note the verification in progress.txt.

If no browser tooling is available in this autonomous context: write Playwright e2e specs that assert the UI behavior. The e2e specs ARE the verification.

## Stop Condition

After completing your single story:

- If ALL stories in `.ralph/prd.json` have `passes: true`: reply with `<promise>COMPLETE</promise>` on its own line. Ralph loop will exit.
- Otherwise: end your response normally. The next iteration will pick up the next story.

## Important Reminders

- Work on EXACTLY ONE story per iteration. Do not greedily try to complete multiple.
- Commit frequently — one commit per atomic step is fine.
- Keep CI green. Broken code compounds across iterations.
- Read `## Codebase Patterns` at the top of progress.txt BEFORE coding.
- Read the relevant story file in `tasks/warewolf/stories/` BEFORE coding.
- The 6 locked Eng Review Decisions and the Pass 1–7 design decisions are the contract. Don't relitigate them — implement them.

When you start, your first action should be: `cat .ralph/prd.json | jq '.userStories | map(select(.passes == false)) | .[0]'` to see the next story.
