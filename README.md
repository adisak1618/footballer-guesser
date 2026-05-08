# Headball Multi-Game Platform

Mobile multiplayer game platform for Thai players. The first shipped game is **Headball** — ทายชื่อนักฟุตบอลบนหัว, a Heads Up-style same-room multiplayer game for football fans. 2-8 players on phones, one host, one 6-character room code. Each round you see a name on someone else's screen but not your own; you ask questions, then guess what's "on your head."

Status: **alpha** ([v0.1.0-alpha.1](https://github.com/adisak1618/footballer-guesser/releases/tag/v0.1.0-alpha.1)) — first playable Headball MVP, expect bugs. The repo is mid-restructure into a multi-game monorepo (see [`tasks/prd-phase-*.md`](tasks/) for the plan).

## Tech stack

- **Frontend**: Next.js 16 (App Router) + TypeScript strict + Tailwind v4 + shadcn/ui
- **State**: Zustand client store, Zod for input validation
- **Backend**: Supabase — Postgres + Realtime + RLS (no Auth; anonymous play)
- **Workspace**: Bun workspaces + Turborepo v2
- **Tests**: Vitest (unit) + Playwright (E2E)
- **Package manager**: [Bun](https://bun.com)
- **Deploy target**: Vercel — one project per app, `rootDirectory = apps/<game>`

See [`docs/PLAN.md`](docs/PLAN.md) for the full Headball architecture and [`docs/DESIGN.md`](docs/DESIGN.md) for the Stadium Energy design system. The multi-game restructure is tracked in [`tasks/`](tasks/).

## Repo layout

```
apps/
  headball/          Next 16 app — the only shipped game
  hub/               Placeholder (Phase 4)
  insider/           Placeholder (Phase 5)
packages/
  core/, ui/, types/, content/   Shared cross-game packages
data/                Cross-app static data (workspace root)
supabase/            Migrations + config (workspace root, shared by all games)
docs/                Plan, design system, game rules
tasks/               Phase PRDs for the multi-game restructure
.ralph/              Autonomous build harness state
```

## Prerequisites

- [Bun](https://bun.com) ≥ 1.1
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (running) — Supabase CLI uses Docker for the local stack
- macOS or Linux (Windows via WSL2 should work but is untested)
- Optional: [GitHub CLI](https://cli.github.com) for releases, [Playwright browsers](https://playwright.dev) installed via `bunx playwright install` for E2E

## First-time setup

```bash
git clone git@github.com:adisak1618/footballer-guesser.git
cd footballer-guesser
bun install                    # resolves workspace symlinks under node_modules/@social-hub/*

# 1. Start the local Supabase stack (Postgres, Realtime, Studio, etc.)
#    First run pulls Docker images (~2 min). Subsequent runs are instant.
bunx supabase start

# 2. Apply migrations + seed the 100 Premier League names
bunx supabase db reset

# 3. Wire env vars — Next loads .env.local from the app dir, NOT the workspace root
cp .env.example apps/headball/.env.local
# Open apps/headball/.env.local and paste the values printed by `bunx supabase status`:
#   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key>

# 4. Run the dev server (proxies to turbo run dev --filter=@social-hub/headball)
bun run dev
```

Open <http://localhost:3000> on your phone (same Wi-Fi → use your machine's LAN IP, e.g. `http://192.168.1.42:3000`).

## Daily development

Once the first-time setup is done, the loop is:

```bash
bunx supabase start    # if Docker isn't already running the stack
bun run dev            # http://localhost:3000 — Headball via turbo
```

Workspace scripts (run from repo root):

| Command | What it does |
|---|---|
| `bun run dev` | Headball dev server (turbo, filtered) |
| `bun run dev:all` | All apps in parallel (Headball + Hub + Insider placeholders) |
| `bun run dev:hub` / `bun run dev:insider` | Run a specific app |
| `bun run build` | Build Headball (turbo, filtered) |
| `bun run build:all` | Build every app |
| `bun run lint` | `turbo run lint` across packages |
| `bun run test` | `turbo run test` (currently 57 vitest cases in Headball) |
| `bunx vitest run` | Workspace-root vitest with `projects: ["apps/*"]` — same 57 cases |
| `bun run seed:all` | Re-fetch + rebuild + emit Headball PL roster SQL |

Per-app commands (run from inside `apps/headball/`):

```bash
cd apps/headball
bunx tsc --noEmit         # typecheck this app (no workspace-root tsconfig)
bunx playwright test      # 5 E2E specs (needs Supabase running)
bun run e2e               # alias of the above
```

Stop the local Supabase stack when you're done (frees Docker resources):

```bash
bunx supabase stop
```

Useful Supabase Studio at <http://127.0.0.1:54323> while the stack is up — direct SQL access to inspect rooms / players / round_state.

## How to play (multiplayer locally)

1. Player 1 opens the app → "สร้างห้อง" → enters name → lands in lobby with a 6-char code.
2. Players 2-N open the app on their phones (same Wi-Fi, dev server on host's LAN IP) → "เข้าห้อง" → type the code + their name.
3. Host taps **START GAME**. Each player's phone shows a different football name in huge Bebas font.
4. Players hold their phones face-out so others can see. Ask yes/no questions. Tap your screen to cover the name → "ทายชื่อ" → submit your guess.
5. Correct = points (first finisher gets the most). Wrong = **FOUL**, out for the round.
6. After all max rounds, final scoreboard shows the winner. Host can "เล่นรอบใหม่" to reset.

## Tests

```bash
# Workspace-level (turbo runs vitest inside each app that has a test script):
bun run test

# Workspace-level (direct vitest, picks up apps/* via projects config):
bunx vitest run

# Per-app vitest from inside an app:
cd apps/headball && bunx vitest run

# E2E (Playwright) — 5 specs: lobby, full-game, race-guess, foul, reconnect
# Requires local Supabase running.
cd apps/headball
bunx playwright install   # first time only
bunx playwright test

# Lint / typecheck
bun run lint                              # turbo across packages
cd apps/headball && bunx tsc --noEmit     # typecheck per-package
```

E2E specs run serially (`workers: 1`) because they share the local Postgres. The race-guess spec is the property test that verifies `submit_guess` is concurrency-safe at the SQL level.

## Headball app layout

Inside `apps/headball/`:

```
app/                       Next.js App Router pages
  page.tsx                 Landing
  join/page.tsx            Join with code
  room/[code]/             Lobby / Playing / Results
  actions/                 Server actions (create-room, start-game, etc.)
components/
  ui/                      shadcn primitives
  name-card.tsx            Big Bebas name card (the hero of the game)
  guess-modal.tsx
  connection-status.tsx
lib/
  supabase.ts              Browser client
  database.types.ts        Generated from migrations
  game-store.ts            Zustand store + localStorage player_id
  schemas.ts               Zod validators
  room-code.ts             6-char generator + retry helper
e2e/                       Playwright specs + helpers
scripts/                   Seed pipeline + ralph harness state
```

Workspace-root `supabase/` (shared across all games):

```
supabase/
  migrations/              0001_init.sql (schema), 0002_*.sql (RPCs), 0003_seed_players.sql
  config.toml
```

## Troubleshooting

**`bunx supabase start` errors with Docker connection refused**
Open Docker Desktop and wait for it to finish starting, then retry.

**Port 54321 / 54322 / 54323 already in use**
Something else is bound. Either stop the other process or run `bunx supabase stop --all` to kill orphaned Supabase containers, then retry `bunx supabase start`.

**App loads but `Invalid API key` shows in the network tab**
`apps/headball/.env.local` is missing or wrong. Run `bunx supabase status`, copy the `anon key` field into `NEXT_PUBLIC_SUPABASE_ANON_KEY` inside `apps/headball/.env.local`, and restart the dev server (Next caches env vars).

**"Cannot add 'postgres_changes' callbacks ... after subscribe()" in the dev console**
Known React 19 StrictMode + supabase-js double-mount race. Should not affect functionality. If you see it consistently, refresh the page once.

**iOS Safari: screen sleeps mid-round**
Wake Lock requires a user gesture. Tap the screen once after START GAME to arm it. Known alpha limitation.

**Playwright tests fail with "no rows" or "room not found"**
The local Supabase stack isn't running, or migrations haven't applied. Run `bunx supabase db reset`, then re-run the tests.

**`bunx tsc --noEmit` from workspace root prints help text**
Expected — there is no workspace-root `tsconfig.json`. Always run typecheck per-package: `cd apps/headball && bunx tsc --noEmit`.

**Want a clean slate**
```bash
bunx supabase stop --no-backup   # destroys local DB
bunx supabase start
bunx supabase db reset
```

## Documentation

- [`CHANGELOG.md`](CHANGELOG.md) — release notes per version
- [`docs/PLAN.md`](docs/PLAN.md) — Headball implementation plan, schema, atomic guess function
- [`docs/DESIGN.md`](docs/DESIGN.md) — Stadium Energy design system, tokens, screen layouts
- [`docs/game-rules.md`](docs/game-rules.md) — game rules (Thai)
- [`tasks/`](tasks/) — phase PRDs for the multi-game restructure
- [`CLAUDE.md`](CLAUDE.md) — project instructions for AI coding agents

## License

Not yet decided. Treat as all-rights-reserved until a LICENSE file lands.
