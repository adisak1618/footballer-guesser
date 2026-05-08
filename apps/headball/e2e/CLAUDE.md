# e2e — Playwright integration tests

Run with `bun run e2e` (or `bunx playwright test`). Local Supabase must be running (`bunx supabase start`). The Next dev server is auto-started by `playwright.config.ts` (`reuseExistingServer: true`).

## Conventions

- One worker, fully serial (`fullyParallel: false`, `workers: 1`). Tests share a real local Postgres; do not parallelize.
- Each test must spin up its own room via `createRoom(page, name)` from `_helpers/flow.ts` — never reuse a code from another test.
- Use `_helpers/admin.ts` for any DB shortcut (override `max_rounds`, fetch `assigned_name`). It uses the local service-role JWT (the standard Supabase demo key — not a secret).
- To shorten a game, set `setMaxRounds(code, n)` AFTER `createRoom` and BEFORE `startGameAsHost`. The realtime subscription pushes the new value to all clients before they enter PLAYING.
- The PLAYING screen routes by `myRow.is_active`: `true` → `NameCard`, `false` → `RoundScoreboard`. The NameCard's "OUT" / "+N" branch in `components/name-card.tsx` is dead code reachable only if the routing in `playing.tsx` ever changes — don't write assertions against it.
- After a player guesses, assert on the scoreboard text (`รอผู้เล่นคนอื่น...`) or on the next round's `Round X/Y` indicator — not on per-round score chips.

## Helpers

- `_helpers/admin.ts` — service-role Supabase client. Bypasses RLS so it can mutate `rooms.max_rounds` directly and read any `round_state` row.
- `_helpers/flow.ts` — page-level helpers: `createRoom`, `joinRoom`, `startGameAsHost`, `submitGuessFromCard`. All match Thai UI copy from `docs/PLAN.md` storyboard. Update them in lockstep with copy changes.

## Common gotchas

- Two CTAs on the landing page match the `สร้างห้อง` regex (the page button + the dialog submit). Use `.first()` for the page CTA, then scope dialog submit via `getByRole("dialog", { name: ... }).getByRole("button", ...)`.
- Realtime takes a moment to deliver player-join events; rely on Playwright's auto-retrying assertions (`toBeVisible({ timeout })`) instead of `waitForTimeout`.
- Concurrency / race specs (e.g. `race-guess.spec.ts`): supabase-js serializes RPCs on a single `SupabaseClient`. To exercise PG-level row-lock concurrency you MUST instantiate two separate `createClient(...)` instances and only THEN `Promise.all(...)`. A single shared client makes the race trivially pass.
- Specs that call Supabase RPCs from Node (no browser) need the anon key in `process.env`. Playwright's runner does not auto-load `.env.local` (only `bun run dev` does), so hardcode the local-dev publishable key as a fallback (`sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH`) and let `NEXT_PUBLIC_SUPABASE_ANON_KEY` override. Same pattern as `_helpers/admin.ts`'s service-role fallback.
