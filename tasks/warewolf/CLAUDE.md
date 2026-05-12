# Ralph Agent Instructions — Warewolf Balance & Setup Recommender V1

You are an autonomous coding agent working on the Warewolf app inside the Headball multi-game platform monorepo. V1 ships a standalone balance/setup recommender for the Thai Werewolf community before the multiplayer game itself exists.

## Source of Truth (READ THIS FIRST EVERY ITERATION)

- **Design doc:** `~/.gstack/projects/board-game/adisakchaiyakul-main-design-20260512-051400-werewolf-balance-tool.md`
  - The **"Eng Review Decisions (2026-05-12)"** section near the bottom is the **latest locked decision authority** — supersedes all earlier text.
  - The **"Reconciliation pass (2026-05-12, post-prototype)"** section captures what changed after the prototype.
  - The **"Design Review Decisions (2026-05-12, Pass 1–7)"** section locks visual + IA decisions.
- **Prototype:** `~/.gstack/projects/board-game/designs/warewolf-full-app-20260512/finalized.html`
  - Behavioral source of truth. Line numbers cited in story acceptance criteria.
- **Test plan:** `~/.gstack/projects/board-game/adisakchaiyakul-main-eng-review-test-plan-20260512-171001.md`
- **Main PRD:** `tasks/warewolf/prd.md` (full story list, locked constraints, build order)
- **Story files:** `tasks/warewolf/stories/US-NNN.md` (one per story; read the one you're implementing)
- **Project conventions:** `CLAUDE.md` at repo root — esp. "Adding a new app" checklist for US-009 and the realtime publication lint discipline.

Story IDs (US-001 through US-027) map to the story files under `tasks/warewolf/stories/`. Each story cites Eng Review Decision numbers (#1–#6) — read the decision in the design doc before implementing.

## CRITICAL: kill background processes before ending your response

`claude --print` (the mode you're running in) does NOT exit until ALL Bash subprocesses you started have terminated. If you start a dev server, a watcher, or any long-running process during this iteration, you MUST kill it before ending your response.

If you ran ANY of these during this iteration:
- `bun run dev`
- `bunx next dev`
- `turbo run dev`

You MUST kill them at the very end:

```bash
pkill -f "next dev" 2>/dev/null; pkill -f "next-server" 2>/dev/null; pkill -f "turbo run dev" 2>/dev/null; true
```

This rule is non-negotiable.

## Your Task

1. Read `.ralph/prd.json` to find the highest-priority user story where `passes: false`.
2. Read `.ralph/progress.txt` for prior learnings.
3. Read the story file at `tasks/warewolf/stories/<story-id>.md` for full acceptance criteria.
4. Read the relevant section of the design doc cited in the story's Technical Notes.
5. Verify you're on branch `main`.
6. Implement THAT ONE story (and only that story).
7. Run all acceptance-criteria quality checks (`cd apps/warewolf && bunx tsc --noEmit`, `bun run lint`, story-specific tests).
8. Commit ALL changes with message: `feat: [Story ID] - [Story Title]`.
9. Update `.ralph/prd.json` to set `passes: true` for the completed story.
10. Append to `.ralph/progress.txt`.
11. **MANDATORY FINAL STEP:** run the pkill cleanup above.

## TDD Discipline (when criteria mention "Tests written")

1. Write the failing test exactly as the criterion describes.
2. Run it — confirm it fails for the expected reason.
3. Write minimum implementation to pass.
4. Run all tests — confirm green.
5. Refactor if needed; tests stay green.

## Locked Decisions Cheat-Sheet

When a story says "per Eng Review decision #N", these are the N's:

1. **Card art** — ship existing JPGs from `apps/warewolf/source/processed/warewolf-card-cropped/` (IP risk accepted).
2. **Solver fallback** — `pickWolvesForBalance` throws on empty pool; `<SolverErrorRow>` catches.
3. **Unknown role ID** — parser silently substitutes `villager`; validator stays strict.
4. **Client state** — thin Zustand store (`useWarewolfStore`); URL is canonical.
5. **Locale precedence** — segment wins; query → 301 redirect.
6. **Category tab mapping** — `lib/category-tabs.ts` derives from team + category.
