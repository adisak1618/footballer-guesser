---
title: Embedded & Distributed Databases for Footballer Dataset
slug: embedded-distributed-db
category: data-architecture
approach: embedded-sql
tags: [sqlite, better-sqlite3, bun-sqlite, turso, libsql, pglite, duckdb, supabase-replica, edge-replica, multi-game-reuse]
problem-domain: footballer-data-reuse
dataset-size: 5-20MB
read-write-ratio: read-heavy
date: 2026-05-02
status: research
related: [static-bundled-data, edge-data-services]
---

# Embedded & Distributed Databases for the Footballer Dataset

## Scope

Project context: Headball + future football trivia games. Dataset is 100 PL players today (`supabase/migrations/0003_seed_players.sql`), planned to scale to ~2,000–5,000 players across the top-5 European leagues. Target file size 5–20 MB. Reads dominate (game-time lookups, list, fuzzy match). Writes are infrequent and admin-driven (transfer windows). Hosting on Vercel (Fluid Compute, Node.js runtime). Bun is the local package manager.

This report covers the **"keep SQL ergonomics, eliminate the network hop"** middle path. Sister reports cover (a) raw static-bundled JSON/Parquet and (b) edge data services like Cloudflare D1 / Workers KV / Upstash. Reference those for trade-offs at either end.

Bottom-line up front: for a read-heavy 5–20 MB dataset queried from Vercel Fluid Compute, **`better-sqlite3` over a SQLite file shipped in the build artifact, wrapped in a small `@headball/players-db` npm package**, is the lowest-latency, lowest-ops, lowest-cost answer. Turso embedded replicas are the "if you ever need writes" upgrade path. PGlite / DuckDB-WASM are not justified for this dataset shape.

---

## 1. Embedded SQLite in Node

The category leader for "real DB that feels like a local file."

### Drivers

| Driver | Sync? | Native module? | Notes |
|---|---|---|---|
| `better-sqlite3` | Yes (sync) | Yes (`.node`) | Most mature; production default for Node serverless. v12+ supports prebuilt binaries for Linux x64/arm64 (Vercel's lambda env). |
| `node:sqlite` | Yes (sync) | Built into Node 22.5+ | No install. Roughly 1.14–1.67× slower than better-sqlite3 in published benches. Stable in Node 24. |
| `bun:sqlite` | Yes (sync) | Built into Bun | Fastest in Bun's own benches; independent benches show better-sqlite3 ties or wins on real queries. Irrelevant on Vercel (Bun isn't the deployed runtime). |
| `@libsql/client` (local mode) | Async | Native | SQLite fork from Turso. Local file works fine but you pay async overhead. Use only if you plan to migrate to remote libSQL later. |

### Latency numbers

- Indexed PK lookup on a warm cache: **5–20 μs per row** (SQLite, generic). p99 reads on a 1 GB DB measured at **45 μs** by the SQLite project.
- Real op/sec from independent driver benchmark (sqg.dev, 2026):
  - `getUserById` (PK): **better-sqlite3 1,223,260 ops/s** vs node:sqlite 1,073,001, libSQL 61,093, Turso (remote) 707,859.
  - `getUserByEmail` (indexed): better-sqlite3 557k ops/s.
  - `countUsers` with `pluck`: 538k ops/s.
- For our footballer dataset (rows ~2–5k, indexed on `id`, `name`, `team_id`), expect **single-digit μs per lookup**, **<200 μs for a `WHERE team_id = ?` returning ~25 rows**, and **<1 ms for full-table scans** including JS marshaling.

### Cold start cost of opening the DB file

- Opening a fresh DB handle in better-sqlite3 is **<5 ms** even for files in the tens of MB; the file is mmap'd lazily, so opening doesn't read the whole thing.
- The first query on a cold OS page cache pays disk I/O: at 5–20 MB and Lambda's local NVMe-backed `/tmp` (or read-only Lambda filesystem), figure **5–30 ms first query**, then μs steady-state.
- Practical Fluid Compute pattern: open the DB in module scope so it survives across invocations on the warm instance. Vercel Fluid keeps the JS instance alive and reuses it across concurrent requests (the whole point of Fluid).

### Vercel deployment shape

Two viable file locations:

1. **Read-only, shipped in build artifact** — put `players.db` next to your route file and reference with `path.join(process.cwd(), 'data/players.db')`. Use Next.js `outputFileTracingIncludes` to force inclusion. Counts against the 250 MB unzipped function size limit. At 5–20 MB this is comfortable.
2. **Writeable `/tmp`** — copy or download the DB to `/tmp/players.db` at cold start, then open. Required if you ever need to `WAL` checkpoint or write. `/tmp` is per-instance ephemeral; not shared between Lambda instances.

For Headball (read-only at game time), **option 1 is the right default**. No download cost, no version drift, no IAM, deterministic deploys.

### Known gotcha

`better-sqlite3` is a native module — it must be built for the Lambda Linux env. Prebuilt binaries exist; if Next bundles tree-shake them out, force inclusion via `outputFileTracingIncludes`. There's a known Node 24 self-register bug in some Vercel + Nuxt setups; pinning to Node 22 is the safe path right now.

---

## 2. Turso / libSQL

SQLite-the-database with a managed cloud and the killer feature of **embedded replicas**: a local SQLite file on your server that syncs from a remote primary. Reads hit the local file (μs), writes go to remote and are replicated back.

### Pricing (May 2026, from turso.tech/pricing)

| Tier | Price | Storage | Reads/mo | Writes/mo | DBs | Active DBs |
|---|---|---|---|---|---|---|
| Free | $0 | 5 GB | 500 M | 10 M | 100 | 100 |
| Developer | $4.99 | 9 GB (+$0.75/GB) | 2.5 B | 25 M | unlimited | 500 |
| Scaler | $24.92 | 24 GB | 100 B | 100 M | unlimited | 2,500 |

Sync interval is configurable via `syncInterval` (e.g. 30s or 60s). Every `sync()` call transfers a delta even if nothing changed, so don't poll aggressively.

### How embedded replicas work

```ts
import { createClient } from '@libsql/client';

const db = createClient({
  url: 'file:./local-replica.db',
  syncUrl: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
  syncInterval: 60, // seconds
});

await db.sync(); // initial pull
const players = await db.execute('SELECT * FROM players WHERE team_id = ?', [1]);
```

Reads hit the local SQLite file with **microsecond latency**. Sync runs in background. Writes go to remote and propagate.

### Vercel integration

Turso is on the Vercel Marketplace (turso.tech / vercel.com/marketplace/tursocloud). Marketplace install auto-provisions `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. You install `@libsql/client` and you're done.

**Catch on Fluid Compute**: each Lambda instance has its own ephemeral `/tmp`, so your "embedded replica" file disappears when the instance dies. Cold start = pay the full sync (`db.sync()`) which downloads the dataset (~5–20 MB at our scale). That's seconds, not μs. Mitigations:

- `syncInterval: 0` and only sync on a cron, not per request.
- Skip embedded replica entirely on serverless and use `createClient({ url: syncUrl })` (remote SQLite over HTTP), which is still fast (~700k ops/s on PK lookups in benchmarks) but pays a network hop per query.
- Use a long-running server (Fly, Render) where embedded replicas shine.

For a project that's already pure-Vercel and read-only at game time, **Turso embedded replicas don't add value over a static file** — they're a feature for write-heavy or multi-region-write apps.

### Multi-tenant pattern for N games

- One Turso DB shared across games + an `app_id` column on writes-only tables. All games SELECT from the same `players` rows.
- Or one Turso DB per game, all created via the management API. Free tier allows 100 DBs; Developer tier is unlimited. Cheap if you go this way.
- Auth: one auth token per game backend, scoped via Turso's group/database permissions.

Note: Turso's docs flag embedded replicas as a "legacy" branding now in favor of "Turso Sync" (the new SDK). Same underlying capability; new API surface.

---

## 3. PGlite (Postgres in WASM)

ElectricSQL's full Postgres compiled to WebAssembly. Runs in browser, Node, Bun, Deno.

### Numbers

- **Bundle size: ~3 MB gzipped** (reported as 3.7 MB on npm; under 3 MB on later builds).
- **Status**: alpha as of 2026, but in v0.4 (March 2026) shipped PostGIS, connection multiplexing, refactored architecture decoupling initdb. 13 M weekly downloads across packages.
- **Persistence on Node**: filesystem (`new PGlite('./pgdata')`) or in-memory.
- **Concurrency**: single-user/single-connection. The v0.4 multiplexer helps but it's not Postgres-the-server.

### When PGlite makes sense

- You want **client-side Postgres** in the browser (offline-first PWA, local dev sandbox).
- You have an existing Postgres schema with extensions (pgvector, PostGIS) you don't want to rewrite as SQLite.
- You want to share the exact same query/schema between client (PGlite) and server (Supabase Postgres).

### When it doesn't, for this project

- 3 MB gzipped is **30× the size of a 100 KB JSON dump** of all 5,000 players. Bundle cost is real.
- WASM init time on Node serverless is non-trivial (no published cold-start numbers, but instantiating a Postgres engine ≠ opening a SQLite mmap; expect 100–300 ms).
- We're not using Postgres-only features. Players table is 5–8 columns. SQLite handles it.
- Alpha status is a real concern for a 1-developer game project.

Verdict: skip PGlite for the server path. Reconsider only if Headball ever ships an offline-first client that needs to run real SQL locally.

---

## 4. DuckDB / DuckDB-WASM

Analytical column-store SQL engine. Reads Parquet/CSV/JSON natively, including **HTTP range requests over remote files** — you can host `players.parquet` on Vercel Blob/R2 and query it with DuckDB without downloading the whole file.

### Numbers

- **DuckDB-WASM core + extensions**: ~3.2 MB gzipped on first visit, browser-cached after.
- **Native DuckDB in Node**: `duckdb` npm package, native module. No WASM overhead.
- HTTP range requests + Parquet metadata pruning means a `WHERE league = 'PL' LIMIT 50` against a 100 MB remote Parquet can transfer **<100 KB**.

### Where DuckDB beats SQLite

- **Analytical queries** (group-by, aggregates) over millions of rows.
- **Columnar data** where you only read 2 of 30 columns.
- **Remote Parquet** as the canonical store.

### Where DuckDB loses for our case

- Footballer data is row-shaped (one row per player) and small. 5,000 rows × 8 cols is laughably small for SQLite; DuckDB's columnar advantage doesn't materialize.
- Typical access pattern is point lookup or small filter, not aggregation. SQLite + B-tree index wins.
- WASM build is single-threaded with a 4 GB browser memory cap — moot for us, but signals "this is for analytics, not transactional reads."

Verdict: DuckDB is the right tool when the dataset is **>1 GB, columnar, and analytical**. Not this dataset. Revisit only if Headball ever wants to ship a "stat-explorer" mode over millions of historical match events.

---

## 5. Supabase Read Replicas + Connection Pooling

The "stay on Supabase, just make reads cheaper" path.

### What Supabase offers (May 2026)

- **Read replicas**: Pro tier and above only. Free tier has no replicas. Replicas are added per-region for cross-region reads.
- **Supavisor**: managed Postgres connection pooler in front of every Supabase project (free tier included). Modes: transaction (recommended for serverless) and session.
- **Free tier**: 500 MB DB storage, unlimited API requests, 50k MAUs, **paused after 1 week of inactivity** with only 2 active projects.

### Why this isn't the right answer

- Read replicas don't reduce **first-byte latency for a small lookup** — you're still on Postgres-over-pgwire-over-network. Even Supavisor adds ~5–20 ms p50 vs. 0.005 ms for an in-process SQLite read.
- Replicas help **scale write contention and cross-region** workloads. Headball at 100 concurrent players doesn't need that.
- The "free tier paused after 1 week" trap has bitten Headball already (Supabase Free is a dev-only environment).
- **Cost to unlock replicas: $25/mo Pro plan minimum**, vs. $0 for shipping a static SQLite file.

### Sensible Supabase compromise

Keep Supabase for **game state** (rooms, players in a session, scores, Realtime channels) where you genuinely need a server-of-record and pub/sub. Move the **footballer reference dataset out** of Supabase into an embedded SQLite file. Headball already does this conceptually — `players` is in migration `0003_seed_players.sql` but it's purely seed data, never mutated by gameplay.

This split mirrors the well-trodden "hot data in Postgres / cold reference data in static file" pattern used by, e.g., timezone DBs, currency tables, country codes.

---

## 6. SQLite-as-Static-Asset Pattern

Two sub-patterns for getting the `.db` file onto Vercel Fluid Compute.

### A. Bundle in the build artifact (preferred for our size)

- File goes in `data/players.db`, included via `outputFileTracingIncludes` in `next.config.ts`.
- Path at runtime: `path.join(process.cwd(), 'data/players.db')`.
- Counts against 250 MB unzipped function size. We're using ~5–20 MB. Fine.
- Pros: zero cold-start network cost, deterministic per deploy, version-pinned to the deploy SHA.
- Cons: data updates require a redeploy. For a transfer-window-cadence dataset (3× per year), this is a feature, not a bug — every roster snapshot is git-tagged and rollback-able.

### B. Lazy-download from Vercel Blob / S3 / R2 to /tmp

- At cold start: `if (!fs.existsSync('/tmp/players.db')) await downloadFromBlob('players.db', '/tmp/players.db')`.
- Then `new Database('/tmp/players.db', { readonly: true })`.
- Pros: data updates without redeploy. Multiple games can pull from one Blob URL. Build artifact stays small.
- Cons: every cold instance pays the download (5–20 MB → ~200–800 ms over Vercel's network at typical bandwidth). `/tmp` is per-instance ephemeral, capped at 512 MB. Adds a moving part.

**Recommendation**: pattern A for the seed-set (deploy = canonical source). If you ever need mid-week roster swaps without a deploy, layer pattern B as an override.

---

## 7. Cross-Game Reuse Mechanism

The user's actual goal: **N football games sharing one footballer dataset**.

Three concrete options, in order of recommendation:

### Option 1: Shared internal npm package (winner)

Publish `@headball/players-db` as a private npm package (or a git submodule, or a Bun workspace package in a monorepo) that contains:

```
@headball/players-db/
  data/
    players.db          # 5-20 MB SQLite file
  src/
    index.ts            # opens DB, exports typed query helpers
    schema.sql          # for regeneration / migrations
    types.ts            # generated row types
  package.json
```

Each game imports it:

```ts
import { getPlayersByLeague, fuzzyMatchPlayer } from '@headball/players-db';

const matches = fuzzyMatchPlayer(userInput, { threshold: 0.8 });
```

The package handles the DB open lifecycle (singleton, lazy, readonly). Games never touch SQL directly.

**Why this wins**:
- Zero infra. No cloud account, no auth tokens, no rate limits.
- Atomic versioning: `@headball/players-db@2026.5.1` pins the exact roster snapshot.
- Each game's deploy is self-contained and offline-runnable.
- Updating rosters = bump the package version, redeploy each game (or use Renovate/Dependabot to fan out PRs).

**How to publish**:
- GitHub Packages (free for private repos under personal/org).
- Or commit `players.db` as a git submodule pointing at a `headball-data` repo; each game `bun install`s via `git+ssh://...`.
- Or vendor it as a workspace package in a Turborepo/Bun monorepo if all games live in one repo.

### Option 2: Single Turso database, one DB per game (or shared)

- Free tier supports 100 DBs and 500 M reads/mo — easily 5–10 games at our traffic.
- Each game gets its own auth token, scoped to read.
- Updating rosters = one SQL run on the primary, all games' embedded replicas pick it up on next sync.
- Trade-off: every game backend now has a network dependency on Turso, plus rate-limit considerations.

Use this if (a) you want roster updates without redeploys, (b) you anticipate writes (favorites, custom rosters per game), or (c) you want one source of truth that's queryable from a dashboard.

### Option 3: Central read-only HTTP API (worst of both)

A small "players API" service (Vercel function or Hono on Workers) that wraps the SQLite file and serves JSON. Each game calls it.

- Adds a network hop and an HTTP serializer for no real gain at our scale.
- Only justifiable if non-Node clients (mobile native, Python data tooling) need access. Not the case here.

---

## 8. Pitfalls to Plan For

| Pitfall | Where it bites | Mitigation |
|---|---|---|
| Cold-start file open | First request after a Lambda spawns. ~5–30 ms for an mmap on 5–20 MB. | Open DB at module scope (top-level). Fluid keeps instance warm. Acceptable as a one-time hit. |
| 250 MB function size limit | Bundling a huge DB + node_modules. | Our DB is 5–20 MB; node_modules ~50 MB; comfortable. Monitor via `vercel inspect`. |
| Native module build mismatch | `better-sqlite3` `.node` built for wrong arch / Node version. | Use prebuilt binaries; pin Node to 22.x in `package.json` `engines`; avoid Node 24 until self-register bug resolved. |
| `/tmp` ephemerality | Per-instance, lost on cold start, 512 MB cap. | Don't rely on `/tmp` for shared state. If using lazy-download pattern, accept the per-instance redownload. |
| Write contention | Two games racing to write the same file. | Don't write. The package is read-only. If you must write, use Turso (write-coordinator) or push writes to Supabase. |
| Version drift between embedded replicas | Different Lambda instances on different sync points. | Tolerable if reads are idempotent (ours are). For consistency-critical reads, query remote directly. |
| WASM bundle size (PGlite/DuckDB-WASM) | 3 MB gzipped on cold start adds ~50–200 ms init time. | Not applicable if you skip these; that's the recommendation. |
| Vercel build artifact caps for assets | Some teams bundle gigabytes of images. | Use Vercel Blob for media; only the DB belongs in the function bundle. |
| Turso embedded replica on serverless | `/tmp` replica file disappears, sync redownloads on each cold start. | Use Turso *remote* mode on Vercel Fluid, or skip Turso entirely. |
| Roster updates require redeploy (static-bundled path) | Friction when a player transfers mid-week. | Acceptable at transfer-window cadence (3× per year). For ad hoc updates, layer in lazy-download from Vercel Blob. |
| PGlite alpha status | API churn, edge bugs. | Skip for production; use only if you specifically need browser Postgres. |

---

## 9. Concrete Recommendation

**Pick: `better-sqlite3` + SQLite file shipped in a private `@headball/players-db` npm package, bundled into each game's Vercel build artifact.**

Why:
- **Latency**: μs reads, in-process. Beats every networked option by 2–4 orders of magnitude.
- **Cost**: $0 forever. No DB service to pay for.
- **Ops**: zero. No tokens, no quotas, no incidents to monitor.
- **Reuse**: npm package is the most idiomatic way to share data + types across N TypeScript projects.
- **Versioning**: `players.db` is regenerated by a build script from the canonical CSV/JSON source, semver-pinned. Every game's roster is auditable from `package-lock`.
- **Vercel fit**: Fluid Compute reuses warm instances, so the 5–30 ms first-query cost is amortized across thousands of requests.
- **Supabase still does its job**: rooms, players in a session, Realtime — nothing changes there. We're only relocating the *reference* data.

Upgrade triggers (when to revisit this choice):
- Need writes from games into the shared dataset (favorites, user-submitted players) → migrate to Turso.
- Need <hour roster updates without a redeploy → add the lazy-download-from-Blob fallback layer.
- Build artifact ever pushes 200 MB → move to Blob-hosted file.

### 5-line code sketch

```ts
// @headball/players-db/src/index.ts
import Database from 'better-sqlite3';
import path from 'node:path';
const db = new Database(path.join(__dirname, '../data/players.db'), { readonly: true, fileMustExist: true });
db.pragma('journal_mode = OFF'); db.pragma('query_only = ON');
export const getPlayersByLeague = db.prepare('SELECT * FROM players WHERE league = ?').all.bind(db.prepare('SELECT * FROM players WHERE league = ?'));
```

(In practice the prepared-statement pattern is cleaner with named exports per query, plus a `searchPlayers(query, limit)` using SQLite FTS5 — but the five-line shape above is the entire integration surface. Each Headball-family game adds `import { searchPlayers } from '@headball/players-db'` and is done.)

---

## Sources

- [SQLite Driver Benchmark — sqg.dev (2026)](https://sqg.dev/blog/sqlite-driver-benchmark/)
- [SQLite speed — sqlite.org](https://sqlite.org/speed.html)
- [How fast is SQLite? — marending.dev](https://marending.dev/notes/sqlite-benchmarks/)
- [SQLite performance tuning — phiresky's blog](https://phiresky.github.io/blog/2020/sqlite-performance-tuning/)
- [Bun SQLite docs](https://bun.com/docs/runtime/sqlite)
- [Better-sqlite3 vs node:sqlite vs Bun benchmark discussion](https://github.com/WiseLibs/better-sqlite3/discussions/1057)
- [Turso pricing](https://turso.tech/pricing)
- [Turso Embedded Replicas docs](https://docs.turso.tech/features/embedded-replicas/introduction)
- [Local-First with Turso Embedded Replicas](https://turso.tech/blog/local-first-cloud-connected-sqlite-with-turso-embedded-replicas)
- [Turso Cloud for Vercel marketplace](https://vercel.com/marketplace/tursocloud)
- [Embedded Replicas GA announcement](https://turso.tech/blog/embedded-replicas-go-ga-with-production-friendly-upgrades)
- [PGlite npm](https://www.npmjs.com/package/@electric-sql/pglite)
- [PGlite GitHub](https://github.com/electric-sql/pglite)
- [PGlite v0.4 announcement](https://electric.ax/blog/2026/03/25/announcing-pglite-v04)
- [DuckDB-WASM GitHub](https://github.com/duckdb/duckdb-wasm)
- [DuckDB-WASM HTTP range requests — HN](https://news.ycombinator.com/item?id=29040120)
- [DuckDB-WASM VLDB paper](https://www.vldb.org/pvldb/vol15/p3574-kohn.pdf)
- [DuckDB Wasm docs — Query](https://duckdb.org/docs/current/clients/wasm/query)
- [Vercel Functions Limits](https://vercel.com/docs/functions/limitations)
- [Vercel Fluid Compute](https://vercel.com/docs/fluid-compute)
- [Scale to one: How Fluid solves cold starts](https://vercel.com/blog/scale-to-one-how-fluid-solves-cold-starts)
- [Is SQLite supported in Vercel? — KB](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel)
- [250 MB function size troubleshooting](https://vercel.com/kb/guide/troubleshooting-function-250mb-limit)
- [Supabase Read Replicas docs](https://supabase.com/docs/guides/platform/read-replicas)
- [Supabase Pricing](https://supabase.com/pricing)
- [Supavisor GitHub](https://github.com/supabase/supavisor)
