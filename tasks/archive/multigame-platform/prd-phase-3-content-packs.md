# PRD: Phase 3 — content_packs Registry + word_packs + Handler Dispatch + Types Regen

**Source of truth:** `~/.gstack/projects/board-game/adisakchaiyakul-main-design-20260508-multigame-platform.md`

**Branch:** `feat/multigame-platform`

**Phase goal:** Add `content_packs` registry + `word_packs` + `word_pack_items` tables. Implement `get_random_pack_item(slug)` RPC with handler dispatch (A2.B). Headball's existing `start_round` and football tables are UNTOUCHED. Regenerate `database.types.ts` into `packages/types`.

**Honest estimate:** 3 working days.

**Dependencies:** Phase 2 must be COMPLETE (`phase-2-done` tag pushed).

---

## Introduction

This phase ADDS a new content layer for future games. Headball doesn't change. The whole point is that game #2 (Insider) and beyond can call `get_random_pack_item('any-pack-slug')` without knowing the underlying schema. C4 from eng review: this phase is purely additive.

## Goals

- New tables: `content_packs`, `word_packs`, `word_pack_items`
- New RPC: `get_random_pack_item(p_slug text)` polymorphs based on pack handler
- Football handler queries existing `category_players JOIN football_players`
- Word handler queries `word_pack_items`
- Migration is backward-compatible (T-7): no destructive drops, all additions
- `database.types.ts` regenerated and moved to `packages/types/src/database.types.ts`
- Headball runtime behavior IDENTICAL (start_round still works)

## User Stories

### US-3.1: Migration 0013 — content_packs registry table
**Description:** As a future game developer, I need a registry of content packs so I can query any pack by slug without knowing its underlying schema.

**TDD:** Test-first via TS integration test (T-2.B).

**Acceptance Criteria:**
- [ ] Write failing test in `apps/headball/lib/__tests__/content-packs.test.ts`: query `content_packs` table for slug `'football-premier-league'` returns one row with `handler='football_category'` and `source_ref='premier-league'`
- [ ] Create migration `supabase/migrations/0013_content_packs.sql`:
  - `create table content_packs (slug text primary key, display_name text not null, display_name_th text, handler text not null check (handler in ('football_category','word_list')), source_ref text not null, enabled bool default true)`
  - Seed: insert one row per existing category in current Headball schema, all with `handler='football_category'` and `source_ref` = the category slug
  - Enable RLS, anon SELECT policy
  - `alter publication supabase_realtime add table content_packs` (per A4)
- [ ] `bunx supabase db reset` from local applies migration cleanly
- [ ] Apply to staging Supabase via `bunx supabase db push --linked`
- [ ] Test passes

### US-3.2: Migration 0014 — word_packs and word_pack_items tables
**Description:** As Insider, I need a place to store generic word lists (Thai food, movies, music, etc.).

**TDD:** Test-first.

**Acceptance Criteria:**
- [ ] Write failing test: insert a `word_packs` row, insert 5 `word_pack_items`, query returns them
- [ ] Create migration `0014_word_packs.sql`:
  - `create table word_packs (slug text primary key, display_name text not null, display_name_th text, enabled bool default true)`
  - `create table word_pack_items (pack_slug text references word_packs(slug) on delete cascade, value text not null, metadata jsonb default '{}'::jsonb, primary key (pack_slug, value))`
  - Index on (pack_slug)
  - Enable RLS, anon SELECT policy on both
  - `alter publication supabase_realtime add table word_packs, word_pack_items` (per A4) — actually word_pack_items doesn't need realtime; mark with `-- no-realtime` comment per US-2.8 convention. word_packs same.
- [ ] Migration applies cleanly locally and to staging

### US-3.3: Migration 0015 — get_random_pack_item RPC with handler dispatch (A2.B)
**Description:** As Insider, I need one RPC that returns a random item from any pack regardless of handler.

**TDD:** Test-first via TS integration test.

**Acceptance Criteria:**
- [ ] Write failing tests: (a) `get_random_pack_item('football-premier-league')` returns a row with `display_value` matching a name from football_players, (b) call returns different values across multiple invocations (random), (c) `get_random_pack_item('insider-thai-food')` returns a value from word_pack_items, (d) `get_random_pack_item('unknown-slug')` raises Postgres error with errcode `PGAME01`
- [ ] Create migration `0015_get_random_pack_item.sql`:
  - SECURITY DEFINER function `get_random_pack_item(p_slug text) returns table(item_id text, display_value text, metadata jsonb)`
  - Reads `content_packs.handler`, `source_ref`
  - For `handler='football_category'`: `select fp.id::text, fp.name, jsonb_build_object('nationalities', fp.nationalities, 'position', fp.position) from category_players cp join football_players fp on fp.id = cp.player_id where cp.category_slug = source_ref order by random() limit 1`
  - For `handler='word_list'`: `select wpi.value, wpi.value, wpi.metadata from word_pack_items wpi where wpi.pack_slug = source_ref order by random() limit 1`
  - On unknown slug: `raise exception 'pack not found: %', p_slug using errcode = 'PGAME01'`
  - GRANT EXECUTE on RPC to anon
- [ ] All tests pass

### US-3.4: Seed initial Insider word packs
**Description:** As an Insider tester, I need at least one word pack populated so the game has content on day 1.

**TDD:** N/A (data seed).

**Acceptance Criteria:**
- [ ] Add seed script `scripts/seed-insider-packs.ts` that inserts 4 starter word packs into staging:
  - `insider-thai-food` ~30-50 items (ผัดไทย, ส้มตำ, ต้มยำ, etc.)
  - `insider-movies-classic` ~30 items (Inception, Titanic, etc.)
  - `insider-th-celebrities` ~20 items (use safe public-figure names)
  - `insider-football-stars` ~30 items (Messi, Ronaldo, etc. — overlaps with football data but pure word-list version)
- [ ] Add corresponding `content_packs` rows pointing at each
- [ ] Script is idempotent (`on conflict do nothing`)
- [ ] Run against staging: `bun run scripts/seed-insider-packs.ts --target staging`
- [ ] Add to `package.json` scripts: `"seed:insider": "bun run scripts/seed-insider-packs.ts"`

### US-3.5: Verify Headball start_round is UNCHANGED
**Description:** As the maintainer, I MUST verify Headball's existing flow still works (C4 — Phase 3 is purely additive).

**TDD:** Run all existing Headball tests.

**Acceptance Criteria:**
- [ ] Existing `start_round` Postgres function: NO CHANGE
- [ ] Existing football_players, categories, category_players tables: NO CHANGE
- [ ] Run all 21 unit tests: pass
- [ ] Run all 5 e2e specs: pass
- [ ] Manual: create a Headball room, start a round, verify a name was assigned (queries category_players directly as before)

### US-3.6: Regenerate database.types.ts to packages/types (T-6)
**Description:** As all apps, we need fresh DB types after schema changes per T-6 sequencing.

**TDD:** Typecheck across workspace.

**Acceptance Criteria:**
- [ ] Run `bunx supabase gen types typescript --local > packages/types/src/database.types.ts`
- [ ] Re-export `Database` from `packages/types/src/index.ts`
- [ ] DELETE `apps/headball/lib/database.types.ts` (now lives in packages/types)
- [ ] Update Headball imports: `import type { Database } from '@social-hub/types'`
- [ ] `bunx tsc --noEmit` from workspace root passes
- [ ] No type errors in any app or package

### US-3.7: Add packages/content with TypeScript wrappers around handler RPC
**Description:** As Insider + future games, I need TS-typed wrappers around `get_random_pack_item`.

**TDD:** Test-first.

**Acceptance Criteria:**
- [ ] Create `packages/content/src/index.ts` exporting:
  - `getRandomPackItem(supabase, packSlug): Promise<{ itemId: string, displayValue: string, metadata: Record<string,unknown> }>`
  - `listEnabledPacks(supabase): Promise<{ slug: string, displayName: string, displayNameTh?: string, handler: string }[]>` — for Insider host setup screen
- [ ] Both use `dispatch()` from `packages/core` so error handling is consistent
- [ ] Tests in `packages/content/src/__tests__/` cover happy path + unknown-pack error
- [ ] Add `packages/content` to workspace root tsconfig paths
- [ ] Tests pass

### US-3.8: Phase 3 regression gate (REG-3 from eng review)
**Description:** As the maintainer, I MUST verify Headball still works AND new content layer works.

**TDD:** Full test suite + new content tests + manual.

**Acceptance Criteria:**
- [ ] `bunx tsc --noEmit` passes from workspace root
- [ ] `bun run lint` passes
- [ ] `bunx vitest run` passes ALL tests (existing 21 + new content_packs tests + new word_packs tests + new dispatch tests)
- [ ] `bunx playwright test` passes 5/5 (Headball e2e unchanged)
- [ ] Manual Headball smoke test: full round end-to-end, name assigned correctly from football_players
- [ ] Manual content RPC smoke test: `select * from get_random_pack_item('insider-thai-food')` returns a Thai food item
- [ ] Vercel headball preview deploys green
- [ ] **/qa GATE:** Run `/qa standard` against headball preview. Zero regressions.

## Functional Requirements

- FR-3.1: `content_packs` is the registry for ALL future game content lookups.
- FR-3.2: `get_random_pack_item(slug)` is the single API for picking content; apps don't query underlying tables directly.
- FR-3.3: Headball is NOT modified to use the new layer (continues querying football tables directly per C4).
- FR-3.4: All migrations are additive and backward-compatible (T-7).
- FR-3.5: Realtime publication discipline (A4) holds — every new public-readable table has matching publication line OR `-- no-realtime` comment.
- FR-3.6: `packages/types/src/database.types.ts` is the single Database type for the workspace.

## Non-Goals

- Migrating Headball to use `get_random_pack_item` (deliberately not — would risk regression).
- Adding any Insider-specific schema (Phase 5a).
- Building Insider UI (Phase 5b-d).
- Building hub UI (Phase 4).
- Real prod Supabase migrations (still on staging per T-5.C).

## Technical Considerations

- The `random()` ordering in `get_random_pack_item` doesn't scale beyond ~10k items. For v1 packs (~100 items each), it's fine. Document for future optimization.
- The polymorphic return shape `{ item_id, display_value, metadata }` is intentional. Football handler returns rich metadata (nationalities, position); word handler returns empty `{}`. Type safety still works because `metadata: Record<string,unknown>`.
- Test-first reminder: write the failing TS integration test BEFORE the migration. The test uses real local Supabase via `bunx supabase start`.

## Success Metrics

- All existing tests pass + new content layer tests pass
- Headball start_round unchanged
- `get_random_pack_item` works for both football and word packs
- 4 word packs seeded into staging

## Open Questions

- None.

---

## /qa GATE PROTOCOL

Run /qa standard against headball preview. Block Phase 4 unless clean.

## Phase Boundary Marker

Phase 3 is COMPLETE when:
- All US-3.x stories show all checkboxes checked
- /qa GATE passes
- Git tag `phase-3-done` pushed

Then read `tasks/prd-phase-4-hub.md`.
