# Warewolf perf gates

Two CI gates protect against silent perf drift. Both fail the workflow on
regression — they are **errors, not warnings** (per Eng Review locked perf
decision, design doc lines 841–842).

## Gate 1 — Bundle budget (`bun run check:bundle`)

- **Route:** `/setup/customize` (the heaviest interactive route).
- **Metric:** sum of gzipped sizes of JS chunks that the prerendered HTML
  loads but the baseline `/en` (landing) does NOT load. I.e. the JS *added*
  by navigating from landing to customize — the spirit of the old webpack
  `next build` "Size" column.
- **Why this measurement.** Under Turbopack the per-route build manifest
  only lists root-main + polyfills shared across every route, so the only
  reliable way to extract route-specific cost is to diff actual chunk
  references in the prerendered `*.html`. See `scripts/check-bundle-budget.ts`.
- **Target:** 80 KB gzipped.
- **Hard ceiling:** 96 KB gzipped (target + 20%). CI fails above this.
- **Tooling:** `@next/bundle-analyzer` wired in `next.config.ts` (enable
  locally with `ANALYZE=true bunx next build` for the treemap) +
  `scripts/check-bundle-budget.ts` for the CI assertion.

## Gate 2 — Lighthouse mobile LCP (`treosh/lighthouse-ci-action`)

- **URLs tested:** `/en`, `/en/setup`, `/en/setup/customize` against the
  Vercel preview deploy of the current PR.
- **Form factor:** mobile (412×823 @ DPR 1.75), simulated 3G throttling
  (`rttMs: 150`, `throughputKbps: 1638.4`, `cpuSlowdownMultiplier: 4`).
- **Assertion:** `largest-contentful-paint ≤ 2500ms` (median of 3 runs).
- **Soft warnings:** FCP ≤ 1800ms, CLS ≤ 0.1, TBT ≤ 200ms. Do not block CI
  but should be watched.
- **Config:** `.github/lighthouserc.json`.
- **Workflow:** `.github/workflows/warewolf-perf.yml`, `lighthouse` job
  (only runs on PRs — preview deploys are PR-scoped).

## Baseline (2026-05-12, US-025 first wiring)

Measured locally on macOS via `bun run check:bundle` against
`bunx next build` output (Next.js 16.2.4 + Turbopack, React 19.2.4).

```
Route: /setup/customize
Route-specific chunks (vs /en baseline):
  19.34 KB  /_next/static/chunks/01at~stofetj4.js
  64.28 KB  /_next/static/chunks/10sadsdx5ikn-.js
  --------
  83.62 KB  gzipped total
```

- Status: **WARN** — above the 80 KB target, within the +20% margin.
- Hard budget 96 KB has 12.38 KB of headroom.

Lighthouse baseline will be captured on the first PR that triggers the
workflow (requires Vercel preview URL).

## When you exceed the budget

The customize page is the largest interactive route in V1. Honor the
locked Eng Review decision and **fix at the source rather than raise the
budget**:

- Split the customize page into smaller route segments or `lazy()`-loaded
  islands.
- Audit `@next/bundle-analyzer` treemap (`ANALYZE=true bunx next build` then
  open the report it prints) to find the heaviest module.
- Defer heavy deps (e.g. icon sets, large i18n message blobs) to dynamic
  import when interaction reveals them.
- Confirm tree-shaking — barrel re-exports from `@social-hub/content` and
  `@social-hub/ui` should stay narrow.

Raising the budget requires a design-doc amendment + maintainer approval.
