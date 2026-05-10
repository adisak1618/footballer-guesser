# Multi-Game Platform — Implementation PRDs

Branch: `feat/multigame-platform`

These PRDs convert the design doc into Ralph-loop-consumable phase files. Each phase has its own /qa gate that blocks the next phase.

## Source of Truth

The full architectural decision context lives in:

- **Design doc:** `~/.gstack/projects/board-game/adisakchaiyakul-main-design-20260508-multigame-platform.md`
- **Test plan:** `~/.gstack/projects/board-game/adisakchaiyakul-main-eng-review-test-plan-20260508-multigame-platform.md`

Read the design doc's `Engineering Review Decisions` and `Design Review Decisions` sections before starting. Decision IDs (A1.C, C2.A, D3, T-2.A, etc.) are referenced throughout the PRDs and map back to those sections.

## Phase Order (Ralph loop sequence)

| # | PRD | Days | Tag on completion |
|---|-----|------|---|
| 0 | `prd-phase-0-scaffold.md` | 1 | `phase-0-done` |
| 1 | `prd-phase-1-relocate-headball.md` | 2 | `phase-1-done` |
| 2 | `prd-phase-2-extract-packages.md` | 3 | `phase-2-done` |
| 3 | `prd-phase-3-content-packs.md` | 3 | `phase-3-done` |
| 4 | `prd-phase-4-hub.md` | 2 | `phase-4-done` |
| 5 | `prd-phase-5-insider.md` (5a/5b/5c/5d sub-phases) | 13-15 | `phase-5a/b/c/d-done` then `phase-5-done` |
| **Total** | | **~24-27 days = 5-5.5 weeks solo** | |

Each phase MUST complete before the next begins. The /qa GATE at the end of each phase enforces this — if /qa shows regressions, do not advance.

## Implementation Stack

The Ralph loop should use these skills per story:

- **`/superpowers:test-driven-development`** — for ANY story that has TDD acceptance criteria. Write the failing test first, run it, watch it fail, write minimum code to pass, refactor.
- **`/superpowers:verification-before-completion`** — before marking any story complete, run the verification commands listed in the acceptance criteria. Evidence before assertions.
- **`/superpowers:systematic-debugging`** — if a test fails for a reason that's not obvious, don't guess. Investigate root cause first.
- **`/qa standard`** at sub-phase boundaries — runs gstack QA testing. Use `/qa exhaustive` at end of Phase 5d for final gate.

## TDD Granularity (per option 2D from confirmation)

- **Schema/RPC stories** (Phase 3, Phase 5a): test-first via TS integration tests against local Supabase. Story format = "write failing TS test → write migration + plpgsql function → run tests → pass."
- **UI stories** (Phase 4, Phase 5b): test-first via Playwright e2e. Story format = "write failing Playwright spec → write React components/pages → run spec → pass."
- **Visual quality** (Phase 5d): /qa runs at sub-phase boundaries catch visual regressions.

Stories that are pure mechanical moves (e.g., `git mv`) or pure config changes don't have a test-first requirement — they have verification-before-completion checks instead.

## /qa Cadence (per option 3B)

`/qa standard` runs at the end of EACH phase as a regression gate:

| Phase | /qa target | Mode |
|---|---|---|
| 0 | headball preview | standard (baseline) |
| 1 | headball preview | standard (compare to baseline) |
| 2 | headball preview | standard (compare) |
| 3 | headball preview | standard (Headball untouched check) |
| 4 | hub preview | standard (new) + headball preview standard (regression) |
| 5a | headball preview | standard (Postgres-only changes; insider has no UI yet) |
| 5b | insider preview | standard (new) + headball preview (regression) |
| 5c | insider preview | exhaustive (all tiers) |
| 5d | insider preview | exhaustive (final gate) + `/design-review` live audit |

A failed /qa gate blocks the next phase. Investigate via `/investigate`, fix, re-run /qa.

## Ralph Loop Pseudocode

```
for each PRD in [phase-0, phase-1, phase-2, phase-3, phase-4, phase-5]:
  read PRD
  for each user_story in PRD.user_stories:
    # superpowers TDD
    invoke /superpowers:test-driven-development
    write failing test (per acceptance criteria)
    run test, confirm fail
    write minimum implementation
    run test, confirm pass
    refactor (if needed)
    
    # verification
    invoke /superpowers:verification-before-completion
    run all acceptance criteria checks
    only mark story done when all checks pass
    
    commit atomic with descriptive message
  
  # phase regression gate
  push branch
  wait for Vercel preview deploys
  invoke /qa <mode> against the right preview URL
  
  if /qa shows regressions:
    invoke /investigate to find root cause
    fix
    re-run /qa
  
  if /qa clean:
    push tag `phase-<N>-done`
    advance to next PRD

# after phase-5-done
invoke /review for pre-landing PR review
manual maintainer review
merge to main
invoke /document-release
```

## Branch Strategy

All work happens on `feat/multigame-platform`. Sub-phase tags (`phase-0-done`, `phase-1-done`, ...) mark progress for resume points if the loop is interrupted.

The maintainer reviews and tests manually after each phase before approving the next. Final merge to main happens after `phase-5-done` and a clean `/review` pass on the PR.

## Resume Protocol

If the Ralph loop crashes or is interrupted:

1. Check git tags: `git tag --list 'phase-*-done'` shows last completed phase
2. Read the next PRD in sequence
3. Within that PRD, look for the first US-X.Y story with unchecked acceptance criteria
4. Resume from there

## Decision Reference (quick lookup)

When a PRD references a decision ID, find it in the design doc:

- **A1-A6** — Architecture decisions (RLS, content unification, timer, publication, Q&A logging, hub identity)
- **C1-C4** — Code quality (error model, state machine spec, types sequencing, Phase 3 clarification)
- **T-1.B / T-2.B / T-3.A** — Test scope decisions
- **T-2.A** — reconcile_round_phase pattern (Codex finding)
- **T-3.B** — Anyone can advance phase actions
- **T-4** — eligible_voter_ids snapshot
- **T-5.C** — Local + staging Supabase
- **T-6** — Types regen after Phase 3
- **T-7** — Migration backward-compat
- **T-8.A** — Honest 5-6 week timeline
- **D1-D6** — Design decisions (Master layout, Insider hints, secret privacy, role privacy, hub metaphor, vote tally privacy)
