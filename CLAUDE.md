# Headball — Multi-Game Platform Monorepo

Mobile multiplayer game platform for Thai players. The first shipped game is **Headball** (ทายชื่อนักฟุตบอลบนหัว), a Heads Up-style same-room game for football fans. The repo is structured as a Bun + Turborepo workspace so additional games (Insider, Hub) can land alongside Headball without disturbing it.

## Quick Reference

- **Stack**: Next.js 16 (App Router) + TypeScript strict + Supabase (Postgres + Realtime) + Vercel
- **Workspace tooling**: Bun workspaces + Turborepo v2
- **State**: Zustand client store, Supabase as source of truth
- **Validation**: Zod schemas for all form input
- **Tests**: Vitest (unit) + Playwright (E2E) — Supabase local Docker for integration
- **Package manager**: Bun (use `bun add`, `bunx`, `bun run` — never `npm`/`yarn`/`pnpm`)

## Project structure

```
apps/
  headball/          Next 16 app — currently the only shipped game
    app/             App Router pages
    components/      UI components (incl. shadcn primitives)
    lib/             Client store, Zod schemas, Supabase client
    e2e/             Playwright specs
    scripts/         Seed pipeline (fetch/build/seed)
    public/, package.json, next.config.ts, tsconfig.json,
    vitest.config.ts, playwright.config.ts, vitest.setup.ts
  hub/               Placeholder (Phase 4)
  insider/           Placeholder (Phase 5)
packages/
  core/              Shared client utilities (cross-game)
  ui/                Shared UI primitives (cross-game)
  types/             Shared TS types (incl. generated Supabase types in later phases)
  content/           Static content packs (e.g. PL roster) consumed by apps
data/                Cross-app static data (PL roster JSON, etc.) — stays at workspace root
supabase/            Supabase config + migrations — stays at workspace root (shared by all games)
docs/                Plan, design system, game rules
tasks/               Phase PRDs (Headball multi-game platform restructure)
.ralph/              Autonomous build harness state (prd.json, progress.txt)
tsconfig.base.json   Shared TS config — apps/packages extend this
turbo.json           Turborepo task graph (dev/build/lint/test)
package.json         Workspace root — Bun workspaces + Turbo proxies
vitest.config.ts     Workspace-root vitest projects pointer (`apps/*`)
```

## Local development

Full human-facing instructions live in `README.md`. Quick agent reference:

**First-time setup** (assumes Docker Desktop is running):

```bash
bun install                    # resolves workspace symlinks under node_modules/@social-hub/*
bunx supabase start            # local Postgres + Realtime + Studio (Docker), workspace root
bunx supabase db reset         # apply migrations + seed 100 PL players
cp .env.example apps/headball/.env.local   # then paste values from `bunx supabase status`
bun run dev                    # http://localhost:3000 — proxies to turbo run dev --filter=@social-hub/headball
```

`apps/headball/.env.local` is required because Next.js loads `.env.local` from the project directory (`apps/headball/`), NOT from the workspace root. After changing env vars, restart `bun run dev`.

**Daily run**: `bunx supabase start && bun run dev`.

**Quality checks** before committing:

```bash
# Workspace level (proxied through turbo where appropriate):
bun run test                   # turbo run test → vitest in apps/headball (57 tests)
bun run lint                   # turbo run lint
bun run build                  # turbo run build --filter=@social-hub/headball
bunx vitest run                # workspace-root vitest with projects: ["apps/*"]

# Per-package (run inside the package directory):
cd apps/headball && bunx tsc --noEmit       # typecheck (no workspace-root tsconfig — see learnings)
cd apps/headball && bunx playwright test    # 5 E2E specs (needs Supabase running)
```

There is no workspace-root `tsconfig.json`. Run typecheck per-package; CI will eventually wire per-app `typecheck` scripts via turbo.

**Supabase Studio**: <http://127.0.0.1:54323> — direct SQL access while the stack is up.

**Ports**: 54321 (API), 54322 (Postgres), 54323 (Studio). If any are in use, `bunx supabase stop --all` then retry.

**Docker not running** is the #1 cause of `supabase start` failures. Don't try to start Docker yourself — ask the user to open Docker Desktop and retry.

**E2E specs run serially** (`workers: 1`) because they share the local Postgres. Don't change this.

## Workspace conventions

- **Path aliases**: import shared packages via `@social-hub/<name>` (e.g. `@social-hub/core`). Inside `apps/headball/`, `@/...` resolves to that app's root and `@/data/...` resolves to the workspace-root `data/` directory. No deep imports across packages — barrel-export only (decision D3).
- **Workspace packages** (`packages/*`) declare `"main": "./src/index.ts"`, `"types": "./src/index.ts"`, and `"exports": { ".": "./src/index.ts" }` so consumers import the TS source directly. No build step for shared packages.
- **Shared TS config**: every app/package extends `../../tsconfig.base.json`. The base owns `target/module/strict/jsx/baseUrl/paths` — don't redeclare per-package.
- **Vitest aliases** must be an array (not an object) so regex matchers (e.g. `@/data/*`) can come before the catch-all `@` alias. Order: most-specific first.
- **Adding a new app** (`apps/<game>/`):
  - Create a `package.json` with name `@social-hub/<game>`, scripts `dev/build/lint/test`, and Next/React deps local to the app.
  - Extend `tsconfig.base.json` and add app-local `paths` only when needed.
  - Update `.gitignore` if the app introduces new scratch dirs.
  - Vercel project for the new app uses `rootDirectory = apps/<game>` (manual setup).

## Key Files

- `tasks/prd-phase-*.md` — phase-by-phase PRDs for the multi-game platform restructure
- `.ralph/prd.json` — Ralph-loop user stories (passes:false ⇒ next iteration picks up)
- `.ralph/progress.txt` — `## Codebase Patterns` section first; full per-story log below
- `apps/headball/app/` — Headball's Next.js App Router pages
- `apps/headball/components/ui/` — shadcn primitives (button, input, dialog)
- `apps/headball/lib/utils.ts` — shadcn cn() helper
- `docs/PLAN.md` — Headball implementation plan, schema, file structure (pre-monorepo, mostly still accurate)
- `docs/DESIGN.md` — Stadium Energy design system — **READ BEFORE ANY UI WORK**
- `docs/game-rules.md` — game rules in Thai
- `docs/mood-board.html` — visual preview (open in browser)
- `supabase/` — Supabase config + migrations (shared across all games)

## Stadium Energy Design System

Always read `docs/DESIGN.md` before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.

**Aesthetic identity**: Stadium Floodlight + Trading Card. Dark navy backgrounds, jersey-bright player tag colors, Bebas Neue at 120-160px for the BIG NAME card. No mascots, no illustrations.

**The memorable thing**: "รู้สึกเหมือนเชียร์ Liverpool ตอนชนะ" — every UI decision should serve this stadium energy.

In QA mode (/qa, /design-review), flag any code that doesn't match `DESIGN.md`.

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
