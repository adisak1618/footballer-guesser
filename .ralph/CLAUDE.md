# Ralph Agent Instructions — Headball Multi-Game Platform

You are an autonomous coding agent working on the Headball multi-game platform monorepo restructure.

## Source of Truth (READ THIS FIRST EVERY ITERATION)

The full architectural decision context lives in:

- **Design doc:** `~/.gstack/projects/board-game/adisakchaiyakul-main-design-20260508-multigame-platform.md`
- **Test plan:** `~/.gstack/projects/board-game/adisakchaiyakul-main-eng-review-test-plan-20260508-multigame-platform.md`
- **Phase PRDs:** `tasks/prd-phase-*.md` (gives full context for the story you're picking)

Decision IDs (A1.C, C2.A, D3, T-2.A, etc.) referenced in `.ralph/prd.json` map to those design doc sections. Read the relevant decision before implementing.

## Your Task

1. Read `.ralph/prd.json` to find the highest-priority user story where `passes: false`
2. Read `.ralph/progress.txt` (Codebase Patterns section first) for prior learnings
3. Read the relevant phase PRD in `tasks/` for full story context
4. Verify you're on branch `feat/multigame-platform`. If not, `git checkout feat/multigame-platform`
5. Implement THAT ONE story (and only that story) using the discipline below
6. Run quality checks per the acceptance criteria
7. Update CLAUDE.md files in modified directories if you discover reusable patterns
8. Commit ALL changes with message: `feat: [Story ID] - [Story Title]`
9. Update `.ralph/prd.json` to set `passes: true` for completed story
10. Append to `.ralph/progress.txt`
11. If story has "Push git tag phase-N-done" in criteria, push the tag

## TDD Discipline (per superpowers:test-driven-development)

If the story acceptance criteria mention "Write failing test" or "Test-first":

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

## /qa GATE Stories (Phase boundary stories)

Stories with "GATE" in the title (US-007, US-013, US-022, US-030, US-037, US-051, US-065, US-074, US-082) are phase-boundary regression gates. They:

1. Run all existing tests (Headball regression check)
2. Push the branch to GitHub and wait for Vercel preview deploys
3. Run `/qa standard` (or `/qa exhaustive` for US-074, US-082) against the relevant preview URL
4. Compare results to baseline saved in `.ralph/qa-baseline-*.txt`
5. If regressions found: STOP THE LOOP. Do not advance. Surface the issue in progress.txt and exit (the `<promise>COMPLETE</promise>` signal does NOT fire on a failed gate).

The gstack `/qa` skill is invoked from your skill list. If you don't have access to it in this Ralph context (no gstack installed for autonomous mode), surface that and ask the maintainer to run `/qa` manually before advancing the next phase.

For US-007 (Phase 0 baseline): /qa output goes into `.ralph/qa-baseline-headball.txt` for future comparison.

## Manual Operational Stories (Pause Required)

US-005 (Vercel projects) and US-006 (staging Supabase) require manual dashboard work the agent cannot do. When you reach these:

1. Print exactly what the maintainer must do
2. Do NOT mark passes: true
3. Append a "PAUSE: manual work required" entry to progress.txt
4. End your response (no `<promise>COMPLETE</promise>` signal — another iteration will check)
5. The maintainer manually completes, then manually edits prd.json to flip `passes: true` for that story

## Project Quality Commands

Run these for stories that touch their respective layers:

| Layer | Command |
|---|---|
| Type | `bunx tsc --noEmit` |
| Lint | `bun run lint` (or `bunx eslint`) |
| Unit tests | `bunx vitest run` (workspace-wide) |
| E2E tests | `cd apps/headball && bunx playwright test` (or apps/insider/apps/hub when those exist) |
| Migration test | `bunx supabase db reset && bunx supabase db push --linked` |
| Build | `bunx turbo run build` |

Local Supabase is required for integration and e2e tests:
```
bunx supabase start
```

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
- All Postgres functions: `using errcode = 'PGAMExx'` convention (per C1.B)
- Every Insider RPC starts with `perform reconcile_round_phase` (per T-2.A)
- ...
```

## CLAUDE.md File Updates (project-level)

If a directory you modified has a `CLAUDE.md` (project-level, NOT this Ralph prompt), append non-obvious learnings there:

- "When adding a Postgres function, also add `alter publication supabase_realtime add table <name>` if clients subscribe (per A4)"
- "Game-specific RPCs go in `apps/<game>/lib/insider-rpc.ts`, not in packages/core"
- "Database types regenerate via `bunx supabase gen types typescript --local > packages/types/src/database.types.ts`"

DO NOT add story-specific implementation details. Only patterns useful to future work.

## Quality Bar (non-negotiable)

- ALL commits must pass typecheck + lint + relevant tests
- Do NOT commit broken code (failing test = green light to commit ONLY if you're in the red phase of TDD and the next iteration will fix it; otherwise broken)
- Keep changes focused to the single story
- Follow existing code patterns from packages/core, packages/ui, etc.

## Confusion Protocol

If you encounter ambiguity that affects implementation:

- Two plausible architectures or data models for the same requirement
- A request that contradicts existing patterns
- A destructive operation where scope is unclear
- Missing context that would change your approach

STOP. Append the question to progress.txt under a `## Open Questions` section. Do NOT mark passes: true. End your response. The maintainer will resolve and re-trigger Ralph.

## Browser Verification

For UI stories with "Verify in browser using dev-browser skill" criterion:

1. Push your changes to the branch
2. Wait for Vercel preview deploy
3. Use whatever browser tooling you have (Playwright headed, gstack /browse, or a visible Chromium) to navigate to the preview URL
4. Verify the visible behavior matches the wireframe in the design doc
5. Take a screenshot, save to `.ralph/screenshots/US-NNN.png`
6. Note the verification in progress.txt

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
- Read the relevant phase PRD in `tasks/` BEFORE coding.
- The design doc decisions (A1.C, C2.A, D3, T-2.A, etc.) are the contract. Don't relitigate them — implement them.

When you start, your first action should be: `cat .ralph/prd.json | jq '.userStories | map(select(.passes == false)) | .[0]'` to see the next story.
