# Headball — agent instructions

Project-specific guidance for AI coding agents (Claude Code, Amp, Cursor, etc.). Mirrors the human-facing `README.md` and the project rules in `CLAUDE.md`.

<!-- BEGIN:nextjs-agent-rules -->
## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Stack

Next.js 16 (App Router) + TypeScript strict + Supabase (Postgres + Realtime + RLS) + Zustand + Zod + Tailwind v4 + shadcn/ui. Package manager is **Bun** — use `bun`, `bunx`, `bun run`, never npm/yarn/pnpm.

## Local development

Docker Desktop must be running. First-time setup:

```bash
bun install
bunx supabase start            # Postgres + Realtime + Studio in Docker
bunx supabase db reset         # apply migrations + seed 100 PL players
cp .env.example .env.local     # paste values from `bunx supabase status`
bun run dev                    # http://localhost:3000
```

Daily run after the first time: `bunx supabase start && bun run dev`.

Studio for direct SQL: <http://127.0.0.1:54323>. Stop the stack with `bunx supabase stop` when done.

If `supabase start` errors on Docker, do NOT try to start Docker yourself — append a note to your progress log asking the user to open Docker Desktop and stop.

## Quality checks (run before committing)

```bash
bunx tsc --noEmit              # typecheck
bun run lint                   # eslint
bunx vitest run                # 21 unit tests
bunx playwright test           # 5 E2E specs (needs Supabase running)
```

E2E runs serially (`workers: 1`) because they share the local Postgres. Don't parallelize.

## Read before working

- `README.md` — human-facing setup, troubleshooting, project layout
- `CLAUDE.md` — project rules, skill routing, design system pointer
- `docs/PLAN.md` — full architecture, schema, atomic guess function
- `docs/DESIGN.md` — Stadium Energy design system (READ before any UI change)
- `docs/game-rules.md` — game rules in Thai
- `progress.txt` (in `scripts/ralph/` if present) — Ralph iteration learnings

## Hard rules

- Thai-only user copy. Don't invent English strings.
- Use design tokens from `docs/DESIGN.md` only — no ad-hoc colors/fonts/spacing. Extend `app/globals.css` `@theme` block to add tokens.
- All DB writes go through `SECURITY DEFINER` Postgres functions (`create_room`, `join_room`, `start_game`, `start_round`, `submit_guess`, `next_round`). Anon clients have read-only RLS.
- Player ID lives in `localStorage` under `headball_player_id` — agents must preserve this contract.
- Conventional commits. `feat: US-XXX - <title>` for Ralph stories. Keep diffs minimal.

## Out of scope (do not add)

Auth/accounts, multiple categories beyond `premier-league`, custom decks, turn timer, QR codes, player photos, push notifications, i18n. Per `docs/PLAN.md`.
