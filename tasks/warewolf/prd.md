# PRD: Warewolf Balance & Setup Recommender V1

**Source of truth:** `~/.gstack/projects/board-game/adisakchaiyakul-main-design-20260512-051400-werewolf-balance-tool.md`
(read this before starting any story — design doc has the full decision context, the locked Eng Review Decisions, and the Pass 1–7 design decisions)

**Prototype reference:** `~/.gstack/projects/board-game/designs/warewolf-full-app-20260512/finalized.html`
(1553 lines; the interactive HTML is the behavioral source of truth — every component, every animation timing, every solver edge case)

**Test plan:** `~/.gstack/projects/board-game/adisakchaiyakul-main-eng-review-test-plan-20260512-171001.md`

**Branch:** `main` (no separate feature branch; new app slot lives under `apps/warewolf/`)

**Honest estimate:** 3–4 weeks for V1 with 27 stories, after pre-code blockers close.

---

## Introduction / Overview

The Headball monorepo is adding a Werewolf game (`apps/warewolf/`) as game #2. Before building the real-time multiplayer game itself, V1 ships a **standalone web tool** that solves the single hardest practical problem for Werewolf groups: **picking a role setup that's actually balanced for the number of players you have.**

The tool targets the **Thai Werewolf community**, which has no polished balance calculator (the English-speaking community has ~10). Same audience as Headball, same monorepo, same Vercel deploy story — different design system (Grimoire — parchment + serif + blood-red, NOT Stadium Energy). Two surfaces: a how-to-play rules transcript (Thai + English) and a balance recommender. For a given player count (5–20 V1), the recommender lists every (archetype × variation) combination, filtered by a multi-select archetype chip strip and sorted by `|balance|` ascending (most balanced first). Tap a setup card to open a customize view where the user can swap, add, or delete roles and watch the balance scale and Playable banner update live.

Standalone first — no backend, no auth. State lives in the URL (`?p=12&roles=seer,bodyguard,...&lang=th`), shared by paste. The real multiplayer game ships later and reuses this tool's solver + role data as the lobby "select setup" step.

## Goals

- Ship a **shareable, no-backend balance recommender** for the Thai Werewolf community before the multiplayer game exists.
- Achieve **solver speed < 5ms** for a full setup-list rebuild on a mid-range Android (2021-era), measured via a Vitest perf test.
- Achieve **balance audit pass**: for every `(archetype × playerCount in [minPlayers..maxPlayers] × variationIdx ∈ {0,1,2})` cell, `|balance| ≤ 5` OR the cell is hidden by gating.
- Achieve **100% line + branch coverage** on the pure-function libraries (`solver`, `validator`, `share-url`).
- Ship **TH + EN at launch** with no untranslated strings; language toggle preserves customization state.
- Achieve **`<2.5s` mobile LCP on simulated 3G** (Lighthouse CI gate).
- Public launch posts in 2 Thai Werewolf communities + 1 BGG forum.

---

## Technical Constraints (LOCKED DECISIONS)

These constraints are locked from the design doc's **"Eng Review Decisions (2026-05-12)"** section. Every story's acceptance criteria reference these by number. Apply during implementation; do not relitigate.

### Architecture (6 decisions)

1. **Card art** — ships existing JPGs from `apps/warewolf/source/processed/warewolf-card-cropped/` (user accepted IP risk; no commission for V1). Pipeline converts JPG → WebP @ 512×768@85 into `packages/content/card-art/`.
2. **Solver fallback** — throws on empty filtered pool; `<SolverErrorRow archetype playerCount>` catches in UI and renders "Solver can't balance this — {archetype} @ {count}p". Replaces the prototype's `return ['werewolf']` bug at `finalized.html:699`.
3. **Unknown role ID** — parser substitutes silently with `villager` (single source of unknown handling in `decodeSetup`); validator stays strict (unknown id → blocker). Type-contract guarantee.
4. **Client state** — thin Zustand store (`useWarewolfStore`: playerCount, activeFilters, currentSetup, dirty, lang). Zustand 5.0.12 already in workspace via Headball; reuse. URL remains canonical for shareable state; localStorage persists lang. ~30 LOC.
5. **Locale precedence** — `/[lang]/` path segment wins; `?lang=other` query param triggers server-side 301 redirect to the matching segment. No client-side hydration mismatch.
6. **Category tab mapping** — `lib/category-tabs.ts` derives tabs from team + category. Mapping: `wolves = team === 'werewolf'`, `power = category ∈ {protection, kill, vote}`, `social = category ∈ {chaos, vanilla-social}`, `info | vanilla | neutral` 1:1 from category. Every role belongs to exactly one tab; no orphans.

### Code Quality (3 inline fixes)

- **Validator single-pass:** fold the three loops over `setup` at `finalized.html:792–818` into one pass.
- **i18n message template contract:** spec each blocker code's interpolation args in `messages/en.json` and `th.json` using next-intl ICU MessageFormat.
- **Solver constants comments:** port the three explanatory comments at `finalized.html:683–690` (`SINGLETON_WOLVES`, `PACK_REQUIRED`, `MAX_WOLF_CUB`) verbatim into `lib/wolf-pools.ts`. They explain *why*, not *what*.

### Performance (CI gates locked)

- **Bundle budget:** `/setup/customize` gzipped JS ≤ 80KB; CI fails on +20% (96KB). Tooling: `@next/bundle-analyzer` + a CI script reading `next build` output.
- **Lighthouse CI:** mobile simulated 3G; LCP < 2.5s. CI fails on regression.
- **Solver perf test:** Vitest assertion `computeSetupList(20) < 50ms` (10× margin over realistic 5ms).

### File layout

- **DROPPED:** `apps/warewolf/lib/seen-cache.ts` (feature deferred to v1.1; do not list empty file slot).
- **NEW:** `apps/warewolf/lib/category-tabs.ts` (Decision #6).
- **NEW component:** `<SolverErrorRow>` (Decision #2).

### Stack

Next 16 (App Router) + TypeScript strict + Tailwind v4 + next-intl + Zod + Vitest + Playwright + Zustand 5.0.12 + Sharp (build-cards script). No Supabase, no auth, no Server Actions, no Route Handlers in V1.

---

## Story List

27 stories, 8 lanes. Priorities are the implementation order.

| ID | Title | Lane | Depends on | Priority |
|----|-------|------|------------|----------|
| US-001 | Roles data — `packages/content/werewolf-roles.ts` | A. Data | — | 1 |
| US-002 | Wolf pool constants — `lib/wolf-pools.ts` | A. Data | US-001 | 2 |
| US-003 | Archetypes — `lib/archetypes.ts` | A. Data | US-001 | 3 |
| US-004 | Village seeds — `lib/village-seeds.ts` | A. Data | US-001, US-003 | 4 |
| US-005 | Solver — `lib/solver.ts` (DFS, throws on empty pool) | A. Data | US-001–004 | 5 |
| US-006 | Validator — `lib/validator.ts` (single-pass, strict) | A. Data | US-001 | 6 |
| US-007 | Share URL — `lib/share-url.ts` (Zod, parser substitutes) | A. Data | US-001 | 7 |
| US-008 | Category tabs — `lib/category-tabs.ts` | A. Data | US-001 | 8 |
| US-009 | App scaffold + Grimoire tokens | B. Scaffold | US-010 | 9 |
| US-010 | `docs/DESIGN-warewolf.md` | B. Scaffold | — | 10 |
| US-011 | next-intl + locale precedence (301 redirect) | C. i18n | US-009 | 11 |
| US-012 | Card art pipeline — Sharp WebP conversion | D. Card art | US-001 | 12 |
| US-013 | `<CardArt>` + `<CardArtPlaceholder>` | E. Components | US-009, US-012 | 13 |
| US-014 | `<BalanceScale>` + `<PlayableBanner>` + `<SolverErrorRow>` | E. Components | US-005, US-006, US-009 | 14 |
| US-015 | `<ArchetypeChipStrip>` (multi-select) | E. Components | US-003, US-009 | 15 |
| US-016 | `<SetupCard>` (setup-list row) | E. Components | US-013, US-014 | 16 |
| US-017 | `<RoleDetailModal>` + `<AddRoleSheet>` | E. Components | US-008, US-013 | 17 |
| US-018 | `useWarewolfStore` Zustand store | E. Components | US-009 | 18 |
| US-019 | `/[lang]/page.tsx` — landing | F. Routes | US-009, US-011, US-013 | 19 |
| US-020 | `/[lang]/setup/page.tsx` — merged setup list | F. Routes | US-015, US-016, US-018 | 20 |
| US-021 | `/[lang]/setup/customize/page.tsx` — customize loop | F. Routes | US-007, US-014, US-017, US-018 | 21 |
| US-022 | `/[lang]/rules/page.tsx` — rules transcript | F. Routes | US-001, US-009, US-011 | 22 |
| US-023 | Balance audit property test (384 cells) | G. Tests + perf | US-005 | 23 |
| US-024 | E2E specs (5) + clipboard fallback + card 404 | G. Tests + perf | US-019–022 | 24 |
| US-025 | CI perf gates — bundle budget + Lighthouse CI | G. Tests + perf | US-021 | 25 |
| US-026 | A11y verification — axe-core + manual SR pass | H. A11y + launch | US-019–022 | 26 |
| US-027 | Vercel project + subdomain + launch | H. A11y + launch | US-023–026 | 27 |

---

## Functional Requirements

- **FR-1:** The system must provide a player count stepper (5–20 inclusive) on `/setup`. Out-of-range URL `p` values clamp to [5, 20] and show a single-line toast.
- **FR-2:** The system must list every `(archetype × variation)` combination valid for the current player count on `/setup`, filtered by archetype `minPlayers`/`maxPlayers` caps and an optional multi-select chip strip.
- **FR-3:** The setup list must be sorted by `|balance|` ascending (most balanced first).
- **FR-4:** Tapping a setup card must navigate to `/setup/customize` pre-loaded with that variation's roles, player count, and lang.
- **FR-5:** The customize view must render a card grid using real card art from `packages/content/card-art/<id>.webp`, with a corner balance badge and `×N` count badge on duplicates.
- **FR-6:** Tapping a role card must open a role detail modal (mobile) or sticky right-column panel (desktop ≥1024px) with team/balance/category badges, mechanic description, and Replace + Delete buttons.
- **FR-7:** Replace must open the add-role sheet pre-filtered to the same category tab as the role being replaced.
- **FR-8:** Add Role must open the sheet with 6 tabs (Wolves / Info / Power / Vanilla / Social / Neutral) per the locked mapping in `lib/category-tabs.ts`.
- **FR-9:** The customize view must render a sticky single-line Playable banner with format `glyph · VERDICT · reason`. Reason ellipses on overflow.
- **FR-10:** The balance scale must show Wolves total on left, Village total on right, with a tilt pointer. Pointer color: green in `[-2, +2]`, dark amber `#7a4d00` outside that band, blood-red on any blocker.
- **FR-11:** The Save CTA must copy the current share URL to the clipboard; when `navigator.clipboard.writeText` is unavailable (insecure context, private browsing), fall back to a `<textarea> + document.execCommand('copy')` path.
- **FR-12:** Save must be disabled when the validator returns `ok: false`.
- **FR-13:** The solver `pickWolvesForBalance` must throw on empty filtered pool. The setup list must catch the throw and render `<SolverErrorRow>` in place of the affected row.
- **FR-14:** The validator must return blockers with codes: `no-wolves`, `wolves-gte-village`, `role-count-mismatch`, `unknown-role`. Strict on unknown role IDs.
- **FR-15:** The share-URL parser `decodeSetup` must silently substitute unknown role IDs with `villager`. The parser is the single source of unknown-id handling.
- **FR-16:** The share-URL parser must clamp `p` to [5, 20] and emit a clamp event the UI shows as a toast.
- **FR-17:** Language switching must update the `/[lang]/` segment in place and preserve setup state. `?lang=other` query → 301 redirect to matching segment.
- **FR-18:** All interactive elements must meet a 44px tap target floor.
- **FR-19:** Escape must close any open modal or sheet.
- **FR-20:** The rules page must show a sticky chapter indicator (updates via IntersectionObserver), a collapsible TOC, and a role compendium paginated by team (Wolves / Village / Neutral tabs).

---

## Non-Goals (V1 explicitly does NOT)

- No dynamic OG image generation per share link (static OG only; deferred to v1.1).
- No group-experience modifier toggle (Strangers / Experienced ±5 band shift) — deferred to v1.1.
- No Cursed, Doppelganger, Cupid, Diseased, Ghost, Lycan, Lone-other roles in V1 pool (mid-game team flip and win-condition overrides too complex for V1 solver).
- No community submission library (Approach C, deferred to v2).
- No multiplayer game integration in this PR (separate workstream; lobby will reuse setup picker post-launch).
- No Storybook.
- No analytics SDK (Vercel Web Analytics is free + one-click later).
- No dark mode (Grimoire is light-only V1).
- No idle animation on landing card-fan (v1.1 may add 4s subtle sway).
- No `lib/seen-cache.ts` (feature deferred; not in V1 file layout).
- No Re-roll / Open-Selected buttons on setup list (removed per reconciliation).
- No drag-and-drop role reordering.
- No "Learn more" expandable in role detail modal (deferred to v1.1).
- No solver promotion to `packages/content/` (kept in `apps/warewolf/lib/` for V1; promotes when the multiplayer game starts importing it).
- No dynamic archetype creation by users (v2).
- No Supabase, no Postgres, no auth, no Server Actions, no API routes.

---

## Design Considerations

- **Grimoire design system** is the canonical visual language for this app. NOT Stadium Energy (that's Headball). Both live side-by-side in the monorepo. Tokens are extracted from the prototype's CSS and codified in `docs/DESIGN-warewolf.md` per US-010.
- **Approved wireframes** live at `~/.gstack/projects/board-game/designs/warewolf-{landing,setup-picker,variations,customize,rules}-20260512/` — each with an `approved.json` capturing decisions and a wireframe HTML.
- **Customize page is locked to Pattern D v2** (card grid + tap-to-detail modal + single-line banner). Desktop ≥1024px replaces the modal with a sticky right-column panel.
- **Typography:** Cormorant Garamond Latin + Noto Serif Thai. Display-xl 48px, display 32px, balance pointer 42px, balance sums 30px italic, banner verdict 17px, banner glyph 22px. Body 14px floor (latin + thai).
- **Color tokens:** parchment background, ink for text, blood-red `#8b1a1a` for accents/focus/red banner state, off-cream for cards. Dark amber `#7a4d00` for tilted balance.
- **Italic Cormorant** restricted to vibe quotes, decorative labels, role names in titles. Body text uses upright Cormorant.
- **Wax-seal icons** — V1 uses Unicode glyph placeholders per design doc (bespoke SVG commission deferred per Pass 4 blocker #1).
- **Motion timing** per Pass 7 table: pointer 200ms ease-out, modal/sheet 280ms `cubic-bezier(.16,1,.3,1)`, tile press 150ms ease-out. `prefers-reduced-motion` zeros all transitions.

---

## Technical Considerations

- All locked decisions from the **"Technical Constraints (LOCKED DECISIONS)"** block above apply to every story's acceptance criteria. Stories cite decision numbers (e.g. "Throws per Decision #2").
- **Build order is 8 lanes (A–H)**. Wave plan: A+B+D in parallel (separate worktrees) → C → E → F → G + H parallel.
- **Lane F (Routes) touches the same `app/[lang]/` tree across stories** — keep sequential to avoid merge conflicts.
- **Test paths:**
  - Unit/property tests live alongside source: `lib/solver.test.ts`, `lib/validator.test.ts`, etc.
  - E2E specs live in `apps/warewolf/e2e/`.
  - `vitest.config.ts` MUST exclude `e2e/**` per CLAUDE.md (workspace-root vitest projects `["apps/*"]` would otherwise collect Playwright files).
- **Realtime publication lint** (`scripts/check-realtime-publication.sh`) runs as the first step of `bun run lint` workspace-wide. Warewolf has zero Supabase migrations; verify the script no-ops cleanly.
- **Each app story includes** `Typecheck passes: cd apps/warewolf && bunx tsc --noEmit` per CLAUDE.md (no workspace-root tsconfig; per-package typecheck).

---

## Success Metrics

- All 27 stories show `passes: true` in `.ralph/prd.json` after later conversion.
- Balance audit property test passes — 100% of in-range cells produce `|balance| ≤ 5`.
- Lighthouse mobile LCP < 2.5s on `/setup/customize` (CI-verified).
- `/setup/customize` route bundle ≤ 96KB gzipped (CI-verified; 80KB target + 20% margin).
- ≥ 3 Thai Werewolf groups have engaged with the tool (Office-Hours Assignment validation, see Open Questions).
- ≥ 1 organic share-link paste observed in target communities within 7 days of launch.

---

## Open Questions (pre-code design blockers)

These are the 4 unresolved blockers from the design doc's "Unresolved (blockers for code start)" section. They can run in parallel with implementation but should close before launch.

1. **Wax-seal SVG commission.** ~34 bespoke SVGs from a designer (~2k–6k THB, 1–2 weeks). Without these, V1 ships with placeholder Unicode glyphs that read as AI slop. Mitigation: V1 can launch with placeholders and ship seals as a v1.1 polish.
2. **Pre-launch validation with 3+ Thai Werewolf groups** (Office-Hours Assignment). Show wireframes + archetype names + Thai copy to real Thai Werewolf players. Validates aesthetic fit, copy comprehension, and the moment-of-use hypothesis. **Strongly recommended before launch.**
3. **Thai copy strategy.** Translate the English copy verbatim, or write fresh Thai-native copy that feels community-authentic? Latter requires a Thai writer/native speaker (~1 day).
4. **Desktop layouts for landing, picker, variations, rules pages** (customize is locked to 2-column at ≥1024px). Without explicit specs, the implementer ad-libs and visual consistency drifts. ~2 hours of design work.

---

## Build Order — 8 Lanes with Wave Plan

```
Wave 1 (parallel worktrees):
  Lane A: Data layer (US-001 → US-008)        — pure TS, no deps
  Lane B: App scaffold (US-009, US-010)        — depends on docs/DESIGN-warewolf.md
  Lane D: Card art pipeline (US-012)           — independent script

Wave 2 (sequential after B):
  Lane C: i18n (US-011)                        — depends on Lane B scaffold

Wave 3 (after A+B+C+D):
  Lane E: UI components (US-013 → US-018)      — single lane; shared tokens

Wave 4 (after E):
  Lane F: Routes (US-019 → US-022)             — same app/[lang]/ tree; sequential

Wave 5 (parallel after F):
  Lane G: Tests + perf (US-023 → US-025)
  Lane H: A11y + launch (US-026, US-027)
```

**Phase Boundary Markers:**
- After Lane A — push WIP commit, run `bunx vitest run apps/warewolf/lib/` (every solver test passes).
- After Lane E — push WIP commit, components compile.
- After Lane F — push WIP commit, every route renders.
- After Lane G — perf gates active in CI.
- After US-027 — git tag `warewolf-v1-launch`, public post.

## /qa GATE PROTOCOL

After Lane F is complete, before Lane G (tests + perf):
1. Push branch.
2. Wait for Vercel preview deploy to succeed.
3. Run `/qa standard` against the preview URL.
4. Capture health-score baseline.
5. If `/qa` finds new bugs: STOP, investigate, fix, re-run `/qa`.
6. If clean: commit `chore: warewolf lane F complete` and advance to Lane G.

After US-027 (production deploy):
- Run `/canary` against the production URL.
- Verify the share-URL round-trip flow on three devices (iOS Safari, Android Chrome, desktop Firefox).
