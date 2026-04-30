# Changelog

All notable changes to Headball are documented here. Format loosely based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning per [SemVer](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Lobby host settings panel: rounds stepper (1-20), Top-N stepper (1..player_count-1), category dropdown. Host commits via Save; guests see a read-only mirror that updates over Realtime. Settings become read-only once the game enters PLAYING and persist across rematch. Category locks once any round has been played.
- `update_room_settings` Postgres function (`SECURITY DEFINER`) with host check, status=LOBBY guard, range validation, top-N clamp against player count, and category-locked guard. RLS still blocks direct table writes — all settings flow through this RPC.
- Phase 1 scoring guard: `start_game` and `next_round` now compute `rooms.effective_score_positions = LEAST(score_positions, player_count - 1)` so 2-player rooms no longer hand the loser any "trophy" points (was 3/2 with default top-N=3; now 1/0). Recomputed on every round start to handle mid-game disconnects.
- E2E spec `e2e/lobby-settings.spec.ts` covering host edit → guest mirror via Realtime and non-host disabled state.
- Transient `GuessResult` screen (Correct/Foul paired counterparts) between guess submission and the inter-round scoreboard. Anton 88px headline, Bebas 96px score, IBM Plex Thai body. Reveals the assigned name + points earned + new total. Auto-advances after 8s; tap to skip. `prefers-reduced-motion: reduce` disables the pop-in animation; static layout intact. (#2)
- Guess input typo tolerance (issue #3, Option C):
  - `lib/player-names.ts` + `data/premier-league.ts` — bundled 100-name list with `findPrefixMatches(input, max=3)` (word-prefix, case-insensitive, plain — diacritic strip is server-only).
  - `components/guess-modal.tsx` — up to 5 neutral chip suggestions below the input after 2+ chars; tapping a chip fills the input without auto-submitting. Chips suppressed under `prefers-reduced-motion: reduce` via `useSyncExternalStore`.
  - Migration `0008_fuzzy_match.sql` — adds `fuzzystrmatch` + `unaccent` extensions, switches `submit_guess` to `levenshtein(lower(trim(unaccent(...))), lower(trim(unaccent(...)))) <= 2` while preserving the `COALESCE(effective_score_positions, score_positions)` Phase 1 guard from 0007. Forgives one or two-letter typos and missing diacritics; rejects distinct real names.
  - Vitest coverage: `lib/__tests__/player-names.test.ts` (prefix hit, case-insensitive, empty, max cap, default-max, no-match, name-count parity).
  - Playwright coverage: new `e2e/chip-suggestions.spec.ts` (2-char gating, tap-fills-no-submit, reduced-motion suppression), extended `e2e/full-game.spec.ts` (typo accept), extended `e2e/foul.spec.ts` (Pele vs Gerrard still fouls).

### Changed
- `e2e/full-game.spec.ts` drives `max_rounds` via the new lobby settings UI instead of the `setMaxRounds` admin helper. 2-player score expectations updated for the Phase 1 guard (Host 2 vs Guest 0 over 2 rounds).
- `submit_guess` now reads `COALESCE(effective_score_positions, score_positions)` so legacy rooms created before this migration continue to score correctly.
- `docs/PLAN.md` Screen 2 (Lobby) layout now documents the settings panel; "Multiple categories" removed from the "Not in scope" list (Phase 2 unblocks it).
- `app/room/[code]/playing.tsx` now routes `NameCard → GuessResult → RoundScoreboard` for the inactive-this-round branch. Reload mid-result is gated by a per-(round, player) localStorage flag and skips directly to the scoreboard. Realtime round-advance preempts the result with an instant cut to the next NameCard. (#2)
- Foul (red) variant of `GuessResult` puts the player's total-score pill in the top-right slot (no rank pill, since fouled players have no rank). (#2)

### Removed
- Dead `is_active=false` OUT/+N branch from `components/name-card.tsx` (the routing in `playing.tsx` now sends inactive players to `GuessResult`, never to that branch). (#2)

## [0.1.0-alpha.1] - 2026-04-30

First playable MVP. Built autonomously overnight via Ralph (21 user stories, 21 commits). Expect bugs — this is **alpha**.

### Added
- Supabase schema: `rooms`, `players`, `round_state`, `round_positions`, `round_events`, `football_players` with RLS (anon role read-only; writes via `SECURITY DEFINER` Postgres functions only).
- Atomic Postgres functions: `create_room`, `join_room`, `start_round`, `start_game`, `submit_guess`, `next_round`. Race-safe position counter on `round_positions` (verified via concurrency E2E spec).
- Seed: 100 Premier League player names (`category='premier-league'`).
- Next.js 16 App Router pages: landing (`/`), join (`/join`), room (`/room/[code]`) with Lobby / Playing / Results sub-views.
- BIG NAME card (Bebas Neue 144px / 96px on small phones), tap-to-cover overlay (honor system), guess modal, foul flash, scoreboard interlude, final results screen with confetti.
- Realtime: Supabase channel subscriptions on `rooms`, `players`, `round_state` for live multiplayer.
- Reconnect: `localStorage` `headball_player_id` resume flow + connection status banner.
- Stadium Energy design system (Anton + Bebas Neue + IBM Plex Thai) per `docs/DESIGN.md`. Thai-only copy.
- Tests: Vitest unit (21 cases — room-code, scoring, game-store), Playwright E2E (5 specs — lobby, full-game, race-guess, foul, reconnect).

### Known limitations
- No deploy target wired yet — runs locally only (`bunx supabase start` + `bun run dev`).
- No auth: anyone with the 6-char room code can join. By design for MVP.
- Single category (`premier-league`); no custom decks.
- No turn timer; players manage themselves.
- No stale-room cleanup job; rooms persist in DB indefinitely.
- No QR code / share sheet; players type the 6-char code.
- iOS Safari Wake Lock requires a user gesture — first round may sleep on some devices.
- Foul overlay animation is short-lived (~600ms); on slow devices the flash may be barely perceptible.
- Realtime reconnect after >30s disconnect prompts a hard "back to home" modal rather than auto-resuming silently.

### Out of scope (per `docs/PLAN.md`)
Auth / accounts, multiple categories, custom decks, voice/video chat, push notifications, analytics dashboard, custom domain, i18n.

[0.1.0-alpha.1]: https://github.com/adisak1618/footballer-guesser/releases/tag/v0.1.0-alpha.1
