---
title: Static Bundled Data for Footballer Dataset
slug: static-bundled-data
category: data-architecture
approach: static-files
tags: [json, messagepack, flatbuffers, npm-package, cdn, bundled, in-memory, multi-game-reuse]
problem-domain: footballer-data-reuse
dataset-size: 5-20MB
read-write-ratio: read-heavy
date: 2026-05-02
status: research
related: [edge-data-services, embedded-distributed-db]
---

# Static Bundled Data for the Footballer Dataset

The premise: footballer data (~100 PL today, target 2,000–5,000 across top-5 leagues, 5–20 MB) is **read-heavy, infrequently mutated, and shared across many sibling games**. We treat it as content, not state. No request hits Supabase at game time — every client either has the bytes already (bundled) or has them in HTTP cache (CDN). This sidesteps Realtime, RLS, and connection limits entirely for the data path.

This research only covers the static-file family. Two parallel research branches cover **edge data services** (KV/Edge Config/D1) and **embedded distributed DBs** (Turso/PowerSync/SQLite-on-the-edge); compare against those before final architecture lock-in.

---

## 1. Format options

Numbers below are the *order-of-magnitude shape* of what to expect for a 10 MB / ~3,000-row dataset of mixed strings + small ints + photo URLs. Real numbers depend on row shape; I cite sources, not microbenchmarks I ran.

| Format | Wire size (rel. JSON) | Gzip wire size | Parse cost in browser | TS ergonomics | Verdict |
|---|---|---|---|---|---|
| **JSON** | 1.0× (10 MB) | ~1.5–2 MB (typical 5–7× ratio for ASCII text) | **Fastest in V8** for cold reads — `JSON.parse` is C++, hits ~70 MB/s on M-class hardware | First-class via `import data from './x.json' assert {type:'json'}` or `as const` | Default winner unless something forces otherwise |
| **MessagePack** | ~0.7–0.8× | ~1.3–1.7 MB | **Slower than JSON.parse in browsers** (Faulkner 2023; pure-JS decoder loses to V8's native parser); MessagePackr is faster but still not a clear win | Decent (`msgpackr` ships d.ts) | Don't use in browser; useful only on server-to-server hops |
| **Protobuf (protobuf.js)** | ~0.4–0.6× | smaller | Beats JSON only on *very* large payloads in optimized branches; otherwise comparable. Schema gen step required. | Generated `.d.ts` from `.proto` is excellent | Overkill for a static read-only roster |
| **FlatBuffers** | ~0.5–0.7× | smaller | **Zero-copy reads**, no parse step at all; access is pointer-arithmetic on the ArrayBuffer | Generated TS bindings, awkward field access (`player.name()` not `player.name`) | Only worth it if you stream a 200 MB file and want field-level lazy reads |
| **Parquet** | ~0.2–0.3× columnar | already compressed | Parse via `parquet-wasm` ~1–2 MB WASM blob; predicate pushdown is great if you only need a few columns | Weak — must hand-write types | Built for analytics, not row-by-row gameplay reads |
| **CSV** | ~0.6× | ~0.2× | Trivial parse; no nested fields | Hand-written types only | Fine for the source-of-truth admin spreadsheet, not for runtime |
| **SQLite (sql.js)** | ~0.4–0.6× (with indices) | well-compressed | sql-wasm.wasm is **~1.5 MB cold load**, then SQL queries run on the main thread synchronously | Manual; no automatic types | Only worth it if you need real SQL or `sql.js-httpvfs` range-request access |

### Concrete numbers from the literature

- **`JSON.parse` is V8-native C++** and outperforms most pure-JS binary decoders in the browser. Faulkner's 2023 browser benchmark across JSON / MessagePack / Protobuf / FlatBuffers / Avro / Bebop / Cap'n Proto found that **MessagePack and CBOR were the *worst* performers in browsers**; the only formats that beat JSON were Avro (avsc), Bebop, and a patched protobuf.js — and only on large payloads. ([Binary Formats are Better Than JSON in Browsers](https://adamfaulkner.github.io/binary_formats_are_better_than_json_in_browsers.html))
- **Google Chrome Labs `json-parse-benchmark`** documents that `JSON.parse` is ~1.7× faster than the equivalent JS object literal evaluation across all engines, because the parser is pure C++ with no JS-engine deopt traps. ([json-parse-benchmark](https://github.com/GoogleChromeLabs/json-parse-benchmark))
- **FlatBuffers' own benchmarks** show 5–10× speedup vs JSON — but only when measuring *zero-copy access*, not when you materialize every row. For our case (load all players once into a Map), the zero-copy advantage evaporates. ([FlatBuffers Benchmarks](https://flatbuffers.dev/benchmarks/))
- **For a 10 MB JSON file, `JSON.parse` blocks the main thread ~100–200 ms** on a mid-range phone. Streaming (`stream-json`) only helps in Node, not in the browser. ([Optimizing Large JSON Files in Production](https://superjson.ai/blog/2025-09-07-optimizing-large-json-files-production/))
- **sql.js cold-loads ~1.5 MB of WASM** before first query; queries themselves are synchronous and block the main thread. ([sql.js README](https://github.com/sql-js/sql.js/))

### Practical takeaway on format

For 5–20 MB of mostly-string data parsed once on the client:

- **Plain JSON wins on simplicity, native parse speed, and TS ergonomics.**
- The binary-format speedup only matters for hot-path serialization (multi-Hz network frames), not for a one-shot dataset boot.
- **Keep an admin/source-of-truth Postgres table**, then **export to JSON at build time** or to a CDN object on edit. The build artifact is what every game consumes.

---

## 2. Distribution strategies

Five concrete options; ranked by fit for our multi-game requirement.

| # | Strategy | Update latency | Cross-repo reuse | Cold-start cost | Versioning | Best for |
|---|---|---|---|---|---|---|
| **1** | **Private npm package** (`@headball/players`) consumed by every game | Publish + bump ⇒ next deploy picks it up | Excellent (npm `dependencies`) | Bundled into JS chunk; tree-shakeable if structured | Semver | **Recommended** for multi-game repo fleet |
| **2** | **Bundled `import players from './players.json'`** (single repo) | Redeploy | None — duplicated per repo | JSON is stringified into JS bundle, parsed eagerly at module load | Git tag | Fine for single game, fails the multi-game test |
| **3** | **Static asset on Vercel CDN / Blob** (`/data/players.v42.json`) fetched at runtime | Push file + bust query string | Fetch URL is the API; works for ANY game in ANY framework | None (lazy fetch); browser caches `immutable` for a year | Filename hash or `?v=42` | Excellent when the dataset grows past 20 MB or is shared with non-Next clients |
| **4** | **Git submodule of a `players-data` repo** | `git submodule update` + redeploy | Works but every dev must remember the submodule dance | Same as bundled JSON | Git SHA | Don't — submodules are a known footgun in CI |
| **5** | **GitHub Releases artifact** downloaded in build step | Cut release + redeploy | Works but you're reimplementing npm | Same as bundled | Release tag | Useful only for >100 MB binary blobs npm rejects |

### Strategy 1 deep dive: private npm package

Structure:

```
@headball/players/
├── package.json        # "main": "./dist/index.js", "types": "./dist/index.d.ts"
├── data/
│   └── players.json    # source of truth (committed)
├── scripts/
│   └── build-indexes.ts  # generates byClub, byNation, byNamePrefix
└── dist/
    ├── index.js        # exports players, byClub, byNation, search()
    ├── index.d.ts
    └── players.json    # copied so consumers can also fetch raw
```

Consumers:

```ts
// any game repo
import { players, byClub, search } from '@headball/players'
const liverpool = byClub.get('Liverpool')!
const matches = search('mo salah')   // typo-tolerant
```

**Where to host the registry:**

- **GitHub Packages** (npm registry built into the org) — free for public repos, free up to limits for private. Auth via `GITHUB_TOKEN`. Works on Vercel out of the box if you set `NPM_RC` env or commit a `.npmrc` with a `${GITHUB_TOKEN}` placeholder.
- **Vercel Marketplace registries** — newer, less mature.
- **Verdaccio self-hosted** — overkill for a one-person fleet.

### Strategy 3 deep dive: CDN static asset

```
https://cdn.headball.app/data/players-v42.json    (immutable, max-age=31536000)
https://cdn.headball.app/data/manifest.json       (max-age=60, revalidate)
```

`manifest.json` points to the current versioned URL. Each game polls it on app boot, fetches the players file once, caches in IndexedDB, and uses it forever until manifest version bumps. This pattern decouples *publishing* from *deploying* — no game needs to redeploy when the roster changes.

Vercel specifics:

- Files in `public/` get `Cache-Control: public, max-age=0, must-revalidate` by default. Override in `vercel.json` to `public, max-age=31536000, immutable` for hashed filenames. ([Vercel Cache-Control docs](https://vercel.com/docs/caching/cache-control-headers))
- Vercel Blob: treat blobs as immutable; create new ones rather than overwriting. Use `?v=` query strings or hashed filenames for safe long-cache. ([Vercel Blob docs](https://vercel.com/docs/vercel-blob))
- Vercel's default static-file CDN cache lives for the lifetime of the deployment and persists across deployments if the file hash is unchanged. ([Vercel CDN Cache](https://vercel.com/docs/caching/cdn-cache))

---

## 3. Query patterns

For 3,000–5,000 player rows fully in memory:

| Pattern | Build cost | Per-query cost | Memory | When |
|---|---|---|---|---|
| **Linear scan** (`players.find(p => …)`) | 0 | O(n) ≈ 0.05 ms for 5k rows | n | Random one-offs, admin code |
| **Map/Set indexes** (`byId: Map<string, Player>`) | O(n) once at boot, ~5 ms | O(1) | ~2× | The default for every keyed lookup |
| **Bucket indexes** (`byClub: Map<string, Player[]>`) | O(n), trivial | O(1) bucket + small scan | ~2–3× | Filtering by club / nation / position |
| **Prefix/trie** for autocomplete | O(n × avg name length) ≈ 50 ms | O(prefix length) | ~3× | "type three letters, see suggestions" |
| **MiniSearch** full-text inverted index | One-time index build, ~100–300 ms for 5k docs | <5 ms per query | Index ~1–2× source size | **Recommended** for fuzzy player-name search; handles 5k records "with no detectable latency" per author |
| **Fuse.js** Bitap fuzzy | Effectively zero | O(n) per keystroke; **slow at 5k**, fine at ~500 | Low | Only for tiny lists |
| **sql.js** in-browser SQL | 1.5 MB WASM cold load + DB load | <1 ms with indices | DB stays in WASM heap | If you need ad-hoc JOINs at runtime |

Sources: [MiniSearch author's note on indexing 5,000 songs in a fraction of a second](https://lucaongaro.eu/blog/2019/01/30/minisearch-client-side-fulltext-search-engine.html), [Fuse.js performance issue thread](https://github.com/loilo/Fuse/issues/18), [sql.js performance discussion](https://news.ycombinator.com/item?id=33374402).

### Recommended query layer

A 50-line module that builds all indexes once at boot:

```ts
// @headball/players/src/index.ts (sketch)
import raw from './players.json'
import MiniSearch from 'minisearch'

export const players = raw as readonly Player[]

export const byId = new Map(players.map(p => [p.id, p]))
export const byClub = Map.groupBy(players, p => p.club)
export const byNation = Map.groupBy(players, p => p.nation)

const mini = new MiniSearch<Player>({
  fields: ['name', 'club', 'nation'],
  storeFields: ['id'],
  searchOptions: { fuzzy: 0.2, prefix: true },
})
mini.addAll(players)
export const search = (q: string) => mini.search(q).map(r => byId.get(r.id)!)
```

Boot cost on a mid-range phone for 5,000 rows: ~100 ms JSON.parse + ~200 ms MiniSearch indexing = **<400 ms one-time**. After that everything is in-memory and instant.

---

## 4. Update workflow

The whole point of this approach is **separating data publishing from app deploys**. Three tiers depending on cadence:

### Tier A: rare updates (transfer windows, twice a year)

- Edit `players.json` in the `@headball/players` repo, run `bun run build` (regenerates `dist/`), `npm version minor && npm publish`.
- Each game's Renovate/Dependabot bot opens a PR; merge ⇒ Vercel redeploy ⇒ new bytes shipped.
- **Latency:** hours-to-days, gated on review.
- **Audit trail:** git history + npm version log.

### Tier B: weekly updates (kit numbers, position changes)

- Same pipeline as A, but `pin` to `^1.x` in each game so minors auto-resolve on next CI build.
- **Latency:** until next deploy of any kind (typically ~weekly).

### Tier C: hot updates (correcting a typo across all live games without redeploying)

- Switch to **Strategy 3 (CDN manifest)**.
- Admin tool writes new `players-v43.json` to Vercel Blob, then atomically updates `manifest.json` to point at v43.
- Each game polls `manifest.json` on app boot (or every N minutes via Realtime). On version mismatch, fetch the new file, swap in-memory map, persist to IndexedDB.
- **Latency:** seconds (CDN propagation) to minutes (browser cache TTL on manifest).
- **Cache-busting safety:** never overwrite a versioned file; always create a new URL.

### Cache-busting cheatsheet

| Asset | Cache-Control | Filename pattern |
|---|---|---|
| `players-v42.json` | `public, max-age=31536000, immutable` | Hash or version in filename |
| `manifest.json` | `public, max-age=60, must-revalidate` | Stable name |
| npm package tarball | n/a (npm handles it) | Semver |

---

## 5. Cross-game reuse mechanism

This is the load-bearing decision for the multi-game vision. Concrete recommendation:

### Recommended: monorepo workspace + private npm package, hybrid publish

```
headball-platform/                # single git repo
├── apps/
│   ├── headball-trivia/          # the current game (Heads Up style)
│   ├── headball-bingo/           # next game
│   └── headball-quiz/            # the one after that
├── packages/
│   ├── players/                  # @headball/players — THE shared dataset
│   ├── ui/                       # @headball/ui — shadcn shared
│   └── supabase-shared/          # auth, room helpers
├── package.json                  # workspaces: ["apps/*", "packages/*"]
├── turbo.json                    # turbo build pipeline
└── pnpm-workspace.yaml           # or bun's workspaces equivalent
```

Why this beats the alternatives:

- **Inside the monorepo:** `apps/headball-trivia/package.json` declares `"@headball/players": "workspace:*"`. Bun's workspaces (and pnpm/Yarn) symlink it. Edits to `packages/players/data/players.json` are instantly visible to every app on next `bun run dev`.
- **Outside the monorepo (eventually):** The same package can also be published to GitHub Packages so future external games or microsites consume `@headball/players@^1.4.0`. Same source, two distribution channels.
- **Vercel deployments per app:** Each app under `apps/` is its own Vercel project with its own `Root Directory`. Vercel's monorepo support handles this natively.
- **Turborepo caches the data-build step.** `packages/players/dist/` only rebuilds when the source JSON changes; all downstream apps re-use the cache.

Sources: [Vercel + Next.js monorepo example (belgattitude)](https://github.com/belgattitude/nextjs-monorepo-example), [Turborepo + pnpm workspaces guide (LogRocket)](https://blog.logrocket.com/build-monorepo-next-js/), [Vercel official monorepo docs](https://vercel.com/docs/monorepos).

### Bun-specific note

Bun supports workspaces (`"workspaces": ["apps/*", "packages/*"]` in root `package.json`) since 1.0. The `workspace:*` protocol resolves to the in-tree version. No registry round-trip needed during dev.

### Anti-patterns we explicitly reject

- **Git submodules** for the dataset: every CI/dev has to remember `git submodule update --init --recursive`, and Vercel's build step often misses it.
- **Copy-paste duplication** of `players.json` across game repos: roster drift is inevitable.
- **Google Sheets as runtime source**: nice for editing, terrible for game-time read latency.

---

## 6. Pitfalls

### 6a. Bundle-size impact on Next.js cold starts

- A 10 MB JSON file inlined via `import data from './players.json'` ends up in the JS bundle as a stringified literal. Webpack/Turbopack ship it to the client whether the page needs it or not unless you carefully gate behind `dynamic(import('...'), { ssr: false })`.
- Vercel's serverless cold start parses every imported module before serving the first request. **Vercel measured 200–800 ms of cold-start overhead** from heavy barrel-file imports on serverless functions. ([How we optimized package imports in Next.js](https://vercel.com/blog/how-we-optimized-package-imports-in-next-js))
- Mitigations:
  - Mark the data import as **client-only** and lazy-load it from `public/data/players.json` via `fetch` on first game screen mount. Then the SSR'd lobby page never touches it.
  - Or push it out of the bundle entirely → Strategy 3 (CDN fetch).

### 6b. TypeScript on huge JSON literals

- TS will happily widen a 10 MB JSON literal to a structural type, but `tsc --noEmit` slows down badly when the file is `import`ed `as const`. Project teams have hit 30–60 s typecheck regressions from a single big literal.
- **Fix:** Ship a hand-written `Player` interface and cast the import: `const players = raw as readonly Player[]`. Don't ask TS to infer the type from the JSON.
- Generate `Player` from a Zod schema so it's enforced at build time:

```ts
const Player = z.object({ id: z.string(), name: z.string(), club: z.string(), … })
export type Player = z.infer<typeof Player>
// build-time: validate every row through Player.parse, fail CI on schema drift
```

### 6c. What breaks at 50 MB

| Limit | At what size | Mitigation |
|---|---|---|
| `JSON.parse` blocks main thread | ~30 MB on mobile (>500 ms) | Move parse into a Web Worker, or fetch already-parsed via `Response.json()` (still C++) |
| Vercel function bundle limit | 250 MB unzipped, 50 MB zipped | Move data out of bundle to `public/` or CDN |
| Browser parse stalls Time-to-Interactive | ~10 MB JSON on 4G mobile | Strategy 3 + cache in IndexedDB after first load |
| npm package max size | 2 GB but practically painful past 100 MB | Split per league: `@headball/players-pl`, `@headball/players-laliga`, etc. |
| Vercel Blob max object | 5 GB | Not a concern |
| `import data from './x.json'` increases TS memory | ~20 MB JSON ⇒ multi-GB tsserver RAM | Cast to opaque type, don't infer |
| Git repo bloat | >100 MB JSON in git history | Use Git LFS or move source to a database |

### 6d. Photo URLs vs photo bytes

If you ever want to bundle player **photos**, you cross from "data" to "media": move them straight to a CDN-served folder (`/players/<id>.webp`), keep only URLs in JSON. 5 MB of metadata is fine; 5 MB is ~20 player photos at modest quality, so embedding photos in the dataset is a non-starter.

---

## 7. Concrete recommendation

For Headball-the-fleet on Next.js 16 + Vercel + Bun:

### The pick: monorepo workspace + private `@headball/players` package + hybrid CDN escape hatch

1. **Convert the repo to a Bun workspace monorepo** with `apps/headball-trivia/` (the current game, moved) and `packages/players/`.
2. `packages/players/` exports `players`, indexes (`byId`, `byClub`, `byNation`), and a `search()` function backed by **MiniSearch**. Source data is `data/players.json`, validated through a Zod schema at build time.
3. Every new game adds `"@headball/players": "workspace:*"` to its `package.json`. Zero copy-paste.
4. **Long-term escape hatch:** also publish each release to GitHub Packages and to `https://cdn.headball.app/data/players-vN.json`. Most games consume the npm package; any client (mobile app, marketing site, partner integration) can hit the CDN URL without npm at all.
5. **Source of truth** stays in Supabase (admin UI), and a CI job exports to `players.json` on merge to main. The dev never hand-edits the JSON.

### 5-line code sketch

```ts
// apps/headball-trivia/lib/players.ts
import { players, byClub, search } from '@headball/players'

export function nextRoundPlayer(usedIds: Set<string>) {
  const pool = players.filter(p => !usedIds.has(p.id))
  return pool[Math.floor(Math.random() * pool.length)]
}
```

That's the entire data layer at game time. No Supabase round-trip, no Realtime subscription, no RLS policy. Game start is a `fetch`-free boot.

### Why this beats the alternatives in our context

- **vs edge data services (KV/Edge Config):** No network at game time. Edge Config is great for feature flags but charges per read; rosters never change mid-game so the read-tax buys nothing.
- **vs embedded distributed DB (Turso/SQLite-on-edge):** A sync-replica DB is overkill for 5 MB of static content. The complexity is justified only if writes are also frequent and multi-region.
- **vs status quo (Supabase table):** The current table works for 100 names but doesn't scale to "5 games × 5,000 players × Realtime presence = thousands of idle subscribers". Move static content out of the realtime-DB now, before it becomes the bottleneck.

### Migration steps (high level, not for this doc to execute)

1. Add `pnpm-workspace.yaml` / Bun workspaces config; move current app into `apps/headball-trivia/`.
2. Scaffold `packages/players/` with `data/players.json` exported from current Supabase seed.
3. Replace runtime `from('football_players').select()` with `import { players } from '@headball/players'`.
4. Add a CI job: on push to main of `packages/players/`, bump version + publish to GitHub Packages + upload `players-v<version>.json` to Vercel Blob with `manifest.json` swap.
5. Delete the `football_players` Supabase table (or keep as admin staging area only).

---

## Sources

- [Binary Formats are Better Than JSON in Browsers — Adam Faulkner](https://adamfaulkner.github.io/binary_formats_are_better_than_json_in_browsers.html)
- [Google Chrome Labs json-parse-benchmark](https://github.com/GoogleChromeLabs/json-parse-benchmark)
- [FlatBuffers official benchmarks](https://flatbuffers.dev/benchmarks/)
- [JSON Parsing Performance: Optimizing Large JSON Files in Production (SuperJSON, 2025)](https://superjson.ai/blog/2025-09-07-optimizing-large-json-files-production/)
- [How we optimized package imports in Next.js — Vercel](https://vercel.com/blog/how-we-optimized-package-imports-in-next-js)
- [Vercel CDN Cache documentation](https://vercel.com/docs/caching/cdn-cache)
- [Vercel Cache-Control headers](https://vercel.com/docs/caching/cache-control-headers)
- [Vercel Blob documentation](https://vercel.com/docs/vercel-blob)
- [MiniSearch — full-text client-side search](https://lucaongaro.eu/blog/2019/01/30/minisearch-client-side-fulltext-search-engine.html)
- [Fuse.js performance discussion #18](https://github.com/loilo/Fuse/issues/18)
- [sql.js README](https://github.com/sql-js/sql.js/)
- [sql.js-httpvfs — phiresky](https://github.com/phiresky/sql.js-httpvfs)
- [Next.js monorepo example — belgattitude](https://github.com/belgattitude/nextjs-monorepo-example)
- [Build a monorepo in Next.js — LogRocket](https://blog.logrocket.com/build-monorepo-next-js/)
- [Performance Analysis of JSON, Buffer, Protobuf, MessagePack for Websockets — DEV.to](https://dev.to/nate10/performance-analysis-of-json-buffer-custom-binary-protocol-protobuf-and-messagepack-for-websockets-2apn)
- [JSON vs FlatBuffers vs Protocol Buffers — DEV.to](https://dev.to/eminetto/json-vs-flatbuffers-vs-protocol-buffers-526p)
