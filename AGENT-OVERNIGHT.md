# Overnight Autonomous Run — Agent Briefing

This file is the entry-point prompt for an unattended Claude Code session. Open Claude Code, paste the section below into the first message, then walk away.

---

## CURRENT STATE (verified 2026-04-30 02:15)

- **Greenfield Next.js 16 scaffolding**: `package.json` ready, `app/page.tsx` is default boilerplate
- **Supabase running locally**: 9 containers healthy, no migrations yet
- **Port 3001 for `bun dev`** (port 3000 occupied by another project — do NOT kill it)
- **Planning docs locked**: `docs/PLAN.md`, `docs/DESIGN.md`, `docs/game-rules.md`
- **Visual reference**: `docs/mood-board.html` (open in browser to see the 6 approved screens)
- **2 git commits**: `c091959` planning, `ea9b483` scaffold, `c92fed8` supabase config
- **`.env.local` already populated** with local Supabase URL + publishable key

## YOUR JOB

Implement **Lanes A, B, C, D** in `docs/PLAN.md` to ship a working MVP of Headball (game ทายชื่อนักฟุตบอลบนหัว) running on `http://localhost:3001`.

The MVP must:
1. Let host create a room (gets a 6-char code)
2. Let 1-7 other players join via the code (each gets a deterministic player tag color from the 8-color palette)
3. Run rounds: random-assign Premier League player names to each player, render the BIG NAME card (landscape, Bebas Neue 144px, jersey color background)
4. Handle guess submission (atomic via `submit_guess()` Postgres function)
5. Handle foul (wrong guess) and correct (right guess) screens
6. Show final scoreboard with replay
7. Multi-device sync via Supabase Realtime (Postgres Changes on rooms/players/round_state/round_events)

Visual fidelity = `docs/mood-board.html` (these are the approved mockups).

## EXECUTION ORDER

Follow `docs/PLAN.md` "Implementation Steps" section:

**Lane A — Backend** (independent):
1. Write `supabase/migrations/0001_init.sql` — all tables + RLS + `submit_guess()` function (full SQL is in `docs/PLAN.md`)
2. Write `supabase/migrations/0002_seed_premier_league.sql` — 100 Premier League player names (curate from your training knowledge — Liverpool, Man Utd, Arsenal, Chelsea, Man City legends + current stars)
3. Run `bunx supabase db reset` to apply migrations

**Lane B — Frontend foundation** (parallel with A):
4. `lib/supabase.ts` — typed client with `createBrowserClient` from `@supabase/ssr`
5. `bunx supabase gen types typescript --local > lib/database.types.ts`
6. `lib/game-store.ts` — Zustand store (room state, players, current round)
7. `lib/schemas.ts` — Zod validators (display name, room code, guess text)
8. `lib/room-code.ts` — 6-char generator with collision retry

**Lane C — Game screens** (depends on A + B):
9. `app/page.tsx` — Landing (สร้างห้อง / เข้าห้อง buttons) — match `docs/mood-board.html` Screen 1
10. `app/join/page.tsx` — Join with code — match Screen 2 entry
11. `app/room/[code]/page.tsx` — Lobby + Playing + Results (use state machine from PLAN) — match Screens 2/3/4
12. Components: `components/big-name-card.tsx` (landscape, 144px Bebas), `components/player-chip.tsx` (numbered + drag handle), `components/guess-modal.tsx`, `components/scoreboard.tsx`
13. Globals: load Bebas Neue + Anton + IBM Plex Sans Thai Looped from Google Fonts in `app/layout.tsx`
14. Apply DESIGN.md tokens via Tailwind config + CSS variables

**Lane D — Tests + polish**:
15. Vitest unit: `lib/__tests__/room-code.test.ts`, `scoring.test.ts`, `game-store.test.ts`
16. Playwright E2E: `e2e/lobby.spec.ts`, `e2e/full-game.spec.ts`, `e2e/race-guess.spec.ts` (the CRITICAL one — concurrent submit_guess test), `e2e/foul.spec.ts`, `e2e/reconnect.spec.ts`
17. Connection banner component + reconnect via localStorage `player_id`

## RULES

1. **Read `docs/PLAN.md` and `docs/DESIGN.md` BEFORE starting each Lane.** They have the full schema, file structure, color tokens, font sizes.
2. **Commit atomically** — one feature per commit. Use conventional commits: `feat:`, `fix:`, `test:`, `chore:`.
3. **Run `bun test` after each Lane.** Don't commit broken tests.
4. **Test Playwright against http://localhost:3001** (NOT 3000 — that's another project).
5. **Match `docs/mood-board.html` visually.** It's the source of truth for what the screens should look like.
6. **Use shadcn/ui primitives** (`components/ui/button|input|dialog`) instead of writing from scratch.
7. **Player tag colors are deterministic by `join_order`**: 1=red, 2=blue, 3=yellow, 4=green, 5=purple, 6=orange, 7=pink, 8=cyan.
8. **BIG NAME card is locked landscape** — use `screen.orientation.lock('landscape')` API + CSS `@media (orientation: portrait)` warning.

## STOP CONDITIONS — END THE SESSION WHEN ANY APPLY

- ✅ All 17 implementation tasks committed AND `bun test` passes AND `bunx playwright test` passes (full success — write a `STATUS-MORNING.md` summary)
- ⚠️ Same error appears 3 times in a row across attempts (write `BLOCKED.md` with what was tried)
- ⚠️ Supabase containers crash and won't restart (write `BLOCKED.md` with `docker ps` output and last logs)
- ⚠️ A migration breaks the schema and `supabase db reset` fails (write `BLOCKED.md`)
- ⚠️ Playwright can't boot a browser instance (write `BLOCKED.md`)

In ALL stop cases: produce `STATUS-MORNING.md` at repo root with:
- Lanes completed (A/B/C/D)
- Tests passing count
- Last commit hash
- Manual steps remaining (deploy to Vercel, etc.)
- Anything that needs the human's eye

## ANTI-PATTERNS — DO NOT

- ❌ Do NOT push to remote (no `git push`) — local commits only
- ❌ Do NOT touch port 3000 / kill PID 74205 (other project running there)
- ❌ Do NOT install new dependencies beyond what `package.json` already has unless absolutely needed (and never `--global`)
- ❌ Do NOT modify `docs/PLAN.md` or `docs/DESIGN.md` (those are locked source-of-truth)
- ❌ Do NOT use Inter/Roboto/Helvetica/Arial fonts — only Bebas Neue + Anton + IBM Plex Sans Thai Looped (per DESIGN.md)
- ❌ Do NOT use claymation/mascot/illustration imagery
- ❌ Do NOT add purple gradients, 3-column SaaS card grids, or any AI slop pattern listed in DESIGN.md
- ❌ Do NOT write code without first reading the relevant section of `docs/PLAN.md`

## SANITY CHECKS BEFORE EACH COMMIT

```bash
bun typecheck 2>/dev/null || bunx tsc --noEmit  # No type errors
bun lint                                          # Lint passes
bun test --run                                    # Unit tests pass
```

If any fails: fix BEFORE committing. Don't accumulate broken commits.

## WHEN STUCK, INSPECT

- DB state: `bunx supabase db diff` (what changed) or `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- Supabase Studio (admin UI): http://127.0.0.1:54323 (browse data, run SQL)
- Realtime debugging: subscribe to `room:*` channel via Studio's Realtime tab
- Container logs: `docker logs supabase_realtime_board-game --tail 50`

## WHEN DONE

Write `STATUS-MORNING.md` and STOP. Do NOT keep iterating once the 17 tasks are committed and tests pass — that's wasted budget.
