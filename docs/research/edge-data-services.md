---
title: Edge Data Services for Footballer Dataset
slug: edge-data-services
category: data-architecture
approach: managed-edge-store
tags: [vercel-edge-config, vercel-blob, vercel-runtime-cache, cloudflare-kv, cloudflare-r2, upstash, cdn-cache, multi-game-reuse]
problem-domain: footballer-data-reuse
dataset-size: 5-20MB
read-write-ratio: read-heavy
date: 2026-05-02
status: research
related: [static-bundled-data, embedded-distributed-db]
---

> **TL;DR** — Vercel Edge Config is **disqualified** by size (Pro cap 64 KB, Enterprise 512 KB; we need 5–20 MB). The pragmatic Vercel-native pick is **Vercel Blob (public JSON file) + Vercel Runtime Cache + Next.js `'use cache: remote'` with `cacheTag('footballers')`**, fronted by Vercel's CDN. Cloudflare R2 is the cross-vendor equivalent if we want a public CDN URL accessible from any game's backend. Supabase remains the write-side admin DB; the Blob is a generated, versioned, read-only artifact.

## 1. Service options (size, latency, pricing matrix)

| Service | Size cap | Read latency | Write model | Pricing (key dims) | Verdict for 5–20 MB roster |
|---|---|---|---|---|---|
| **Vercel Edge Config** | 8 KB Hobby / **64 KB Pro** / **512 KB Ent** (per store) | <1 ms typical, p99 <15 ms at edge | REST API; up to 10 s global propagation | Pro: $3/M reads, $5/M writes | DISQUALIFIED — 30–100x too small even on Enterprise |
| **Vercel Blob** | 5 TB per object; private + public | CDN-cached after first hit; 94-city Fast Data Transfer | `put()` / `del()` from server, presigned client uploads | $0.023/GB-mo storage, $0.05/GB egress, $0.40/M simple ops | STRONG — JSON file as artifact, served via CDN |
| **Vercel Runtime Cache** | **2 MB per item**, per-region KV | In-region; sub-ms typical | `cache.set()` w/ TTL+tags; `expireTag()` propagates ~300 ms | Bundled in compute pricing | LAYER (not store) — chunk by team or use as Supabase shield |
| **Vercel KV** | — | — | — | **SUNSET — replaced by Upstash Redis on Marketplace** | n/a |
| **Vercel Postgres** | — | — | — | **SUNSET — replaced by Neon on Marketplace** | n/a |
| **Cloudflare Workers KV** | 25 MiB per value, 512 B per key, 1 KB → ∞ namespaces | ~10–50 ms cold edge, sub-ms hot; eventually consistent (≤60 s) | 1 write/s per key | $0.50/M reads, $5/M writes, $0.50/GB-mo | STRONG — fits 20 MB in one value, edge-cached |
| **Cloudflare R2** | 5 TB per object | S3-compatible; CDN-cacheable, no edge guarantee on raw GET | S3 PUT/DELETE | $0.015/GB-mo, **$0 egress**, $0.36/M Class A (writes), $0.36/M Class B (reads) | STRONG — cheapest; public bucket as CDN URL |
| **Upstash Redis** | 100 MB per string value (paid plan), 50 GB+ per DB | 1–10 ms typical (region-pinned) | Standard Redis SET/GET | $0.20/100K requests, 200 GB free egress, $0.03/GB after | OK — but Redis-shaped, not JSON-blob shaped |
| **Neon (HTTP driver, edge-friendly)** | Postgres limits | ~30–80 ms cold from Vercel functions | SQL | Free tier 0.5 GB; serverless billing | Overkill if dataset is read-only |
| **Turso (libSQL)** | SQLite limits per replica | Sub-ms with embedded replicas | libSQL writes | Generous free tier | Covered by another agent — note: best when you want SQL + edge replicas, not for "single JSON blob" use case |

Sources: Vercel Edge Config Limits doc (2026-02-26), Vercel Blob GA pricing announcement, Vercel Runtime Cache docs, Cloudflare KV limits page, Cloudflare R2 + Workers pricing pages, Upstash Redis pricing 2026.

## 2. Vercel Edge Config deep-dive (and why it fails this use case)

| Attribute | Value | Source |
|---|---|---|
| Max store size — Hobby | **8 KB** | Vercel Edge Config Limits |
| Max store size — Pro | **64 KB** | Vercel Edge Config Limits |
| Max store size — Enterprise | **512 KB** (request more via support) | Vercel Edge Config Limits |
| Max stores per project | 1 / 3 / 3 | Vercel Edge Config Limits |
| Read latency | <1 ms typical, p99 <15 ms at edge | Vercel docs |
| Write propagation | up to 10 s globally | Vercel docs |
| Write API | REST `PATCH` to `vercel.com/api/v1/edge-config/...` | Vercel API ref |
| Pricing (Pro) | $3/M reads, $5/M writes | Vercel Edge Config Limits |
| Backups | 7 / 90 / 365 days by plan | Vercel Edge Config Limits |

### Is 5–20 MB feasible? No.
- **20 MB / 512 KB = 40× the Enterprise cap.** Even if we negotiate higher limits, the product is explicitly designed for "small config-shaped data" (feature flags, redirect tables, A/B variants).
- "Chunking" a roster across 40+ Edge Configs is a non-starter — Pro is capped at **3 stores per project total**.
- Edge Config is the wrong shape semantically: a player roster is *content*, not *config*.

### Where Edge Config DOES fit in a multi-game stack
- A `roster_version` pointer (`{ "current": "2026-05-pl-r2.json", "etag": "..." }`) at <1 ms edge latency, used by every game to know which Blob/R2 file to fetch and what cache tag to invalidate. This **complements** the Blob/R2 file approach.

## 3. Vercel Runtime Cache — when to layer it

### What it is
- Per-region, per-project KV cache shared across Functions, Routing Middleware, and Builds.
- Hard limit: **2 MB per item**, 64 tags per item, 256 B per tag.
- Tag-based invalidation propagates globally **within ~300 ms**.

### Edge Config vs Runtime Cache — different purposes

| | Edge Config | Runtime Cache |
|---|---|---|
| Source of truth? | Yes (the data lives there) | No (cache over an origin) |
| Per-region? | No (replicated globally) | **Yes (each region isolated)** |
| Write API | REST, 10 s propagation | Code-side `set()`, ~300 ms tag expire |
| Item cap | 64 KB / 512 KB store-wide | 2 MB per item |
| Best for | Tiny config | Memoized API/DB results within compute layer |

### When to layer Runtime Cache over Supabase (origin)
1. Game function calls `getCache().get('roster:pl:v2026-05')`.
2. On miss, query Supabase `players` table → `cache.set(key, json, { ttl: 86400, tags: ['roster:pl'], name: 'pl-roster' })`.
3. Admin updates a transfer → call `getCache().expireTag('roster:pl')` from a Server Action; first request per region in next ~300 ms repopulates cache.

### 2 MB chunking strategy if we use Runtime Cache as primary
- 5–20 MB JSON > 2 MB cap. Either compress (gzipped 100-player JSON ≈ 60–120 KB; even all top-5 leagues at ~5,000 players gzip-JSON should land under 2 MB), or chunk by league (`roster:pl`, `roster:laliga`, …).

### Tag-based invalidation for transfer windows
```ts
// app/admin/actions.ts
'use server'
import { getCache, invalidateByTag } from '@vercel/functions'
export async function publishRoster() {
  await getCache().expireTag('roster:pl')   // Runtime Cache only
  await invalidateByTag('roster:pl')        // also CDN + Data caches
}
```

## 4. Cloudflare KV vs R2

| Dimension | Workers KV | R2 |
|---|---|---|
| Shape | KV store, edge-cached | Object storage (S3-compatible) |
| Max value | 25 MiB (fits whole 20 MB roster as one key) | 5 TB |
| Read latency | Sub-ms when hot at PoP; 10–50 ms cold | CDN-cacheable; raw GET 30–100 ms |
| Eventual consistency | Up to ~60 s globally after write | Strong (single object) |
| Read cost | $0.50/M | $0.36/M Class B |
| Write cost | $5/M (1 write/s/key cap) | $0.36/M Class A |
| Storage | $0.50/GB-mo | **$0.015/GB-mo** (33× cheaper) |
| Egress | Free | **Free** |
| Best for | Small, hot, frequently-read keys | Large blobs that benefit from CDN cache + cheap egress |

For a 5–20 MB JSON read-heavy by many backends, **R2 wins on cost** ($0.015/GB-mo + free egress) and KV wins on latency-without-CDN. Once you front R2 with Cloudflare CDN (or any CDN via custom domain), latency converges with KV for a *cacheable* JSON file.

## 5. Cross-game reuse mechanism

The user wants ONE source of truth for footballers across MANY game projects. Three viable patterns, ranked.

### Option A — Public CDN URL (recommended for cross-vendor portability)
Publish `roster.json` to a stable URL: `https://cdn.headball.app/rosters/pl-v2026-05.json` (Vercel Blob public access, or R2 with custom domain + Cloudflare CDN). Any game backend (or even client) `fetch()`s it.

- **Versioned filenames** = immutable, infinitely cacheable (`Cache-Control: public, max-age=31536000, immutable`).
- **Latest pointer** in tiny `latest.json` (or in Edge Config) bumps as transfer windows close.
- Works for **anything** — Vercel-hosted games, future Cloudflare Workers games, mobile clients, even a static landing page.

### Option B — Shared Vercel project exposing a Route Handler
A `roster-service` Vercel project hosts `GET /api/roster/pl` backed by Supabase + `'use cache: remote'`. Other games hit it. Pros: central auth, central rate-limit. Cons: synchronous coupling, extra network hop per game cold start, harder to embed in non-Vercel surfaces.

### Option C — Shared Edge Config across team's projects (DISQUALIFIED by size)
Edge Config supports connecting one store to up to 3 projects per project (or N stores team-wide), but the 64 KB / 512 KB cap kills this for the dataset itself. Use it only for the **pointer** file (Option A's `latest.json` replacement).

### Recommendation
Option A. The dataset is content, immutable per version, and read-heavy from many surfaces — exactly what CDN-fronted blob storage is for.

## 6. Architecture sketches

### Sketch (a) — "Edge Config as the only store"
```
Admin UI → REST PATCH → Edge Config ── <1ms ──> Game Function → render
```
**Verdict: NOT VIABLE.** Capped at 512 KB Enterprise; dataset is 10–40× too big.

### Sketch (b) — "Supabase origin + Runtime Cache + tag invalidation"
```
                                          ┌─ region us-east miss → Supabase → cache.set
Game Function → getCache().get('roster') ─┤  region eu-west hit → instant
                                          └─ region ap-south miss → Supabase → cache.set

Admin publishes roster:
  Server Action → getCache().expireTag('roster:pl') → ~300ms global expire
                → invalidateByTag('roster:pl')      → CDN purge too
```
**Pros:** keeps Supabase as the editable source of truth; per-region warm cache; tag-based "new transfer window" invalidation is one line.
**Cons:** every region cold-start re-queries Supabase; 2 MB-per-item cap forces gzip or per-league chunking; **Runtime Cache is per-project**, so multi-game reuse requires each game to repopulate independently (origin shielding only).

### Sketch (c) — "R2/Blob JSON file + Next.js `'use cache: remote'`"
```
Build/Admin step:
  Supabase → bun run scripts/publish-roster.ts → write rosters/pl-v2026-05.json to Blob/R2
            → write latest.json pointer
            → invalidateByTag('roster:pl')

Game runtime (any project):
  loader() with 'use cache: remote' + cacheTag('roster:pl')
    → fetch(BLOB_URL + '/' + pointer.current)
    → parse → return; cached in Vercel Runtime Cache + CDN
```
**Pros:** truly cross-game (a public URL any backend can read); immutable versioned files = perfect cacheability; cheapest egress (R2 free, Blob $0.05/GB); Supabase role shrinks to "admin write surface + roster generator." **Cons:** publish step is a discrete pipeline, not magic-realtime; cold start in a new region pays one fetch (~10–80 ms gzipped).

## 7. Pitfalls

| Pitfall | Mitigation |
|---|---|
| **Cold-start cost of fetching 10 MB JSON** | Always gzip/brotli (10 MB → ~1.5 MB); fetch lazily with `'use cache: remote'`; consider per-league split so games that only use PL never load LaLiga; CDN cache means only the *first* function instance per region/edge pays the cost. |
| **Regional consistency lag** | Edge Config ≤10 s, Runtime Cache `expireTag` ~300 ms, KV ≤60 s, R2 strong (single object). Pick R2/Blob for "I just published, must be visible now"; pick KV only if you can tolerate up to a minute of stale roster. |
| **Vendor lock-in** | Public-URL pattern (Option A) is portable: any future game in any framework can `fetch()` it. Keeping Supabase as the editable origin means migrating storage = re-pointing the publish script. |
| **Hitting Edge Config size limit** | Don't try; use it only for tiny pointer/version data. |
| **Hitting Runtime Cache 2 MB item limit** | Gzip the JSON before `cache.set`, or shard by league/team. Keys: `roster:pl`, `roster:laliga`, etc. |
| **Stampede on cache miss** | Use `revalidateTag(tag, 'max')` (stale-while-revalidate) instead of `dangerouslyDeleteByTag` (blocks first request). Avoid `updateTag` outside Server Actions. |
| **Forgetting to invalidate** | Wire admin "publish roster" UI to call `invalidateByTag('roster:pl')` (CDN+Runtime+Data) and bump the pointer. Test by reading from a fresh region. |
| **Public Blob exposes URL pattern** | If rosters are sensitive (commercial licensing), use Vercel Blob *private* access + signed reads, or R2 with signed URLs — pay slightly higher egress but gate access. For PL Wikipedia-derived data this is fine to be public. |
| **Bundle vs fetch tradeoff** | If dataset is truly static across deploys (no transfer-window updates between releases), the static-bundled-data agent's approach may beat this one. Decision lever: how often does the roster change *between* deploys? |

## 8. Concrete recommendation for Headball

### Stack pick: **Supabase (writes) + Vercel Blob (published artifact) + Next.js Cache Components (read path)**

**Why this and not the alternatives:**
- Edge Config: too small. Hard veto.
- Cloudflare R2: cheapest but adds a vendor; only worth it once egress dominates ($0.05/GB Vercel vs $0 R2). At 5–20 MB roster × 1k–10k cold-start fetches/month per region, egress is a rounding error. Stay on Vercel platform until billing forces a move.
- Upstash Redis: Redis-shaped, not blob-shaped. Save it for actual session/realtime/rate-limit use cases later.
- Pure Supabase: works, but every game's every region pays a query on each cold function. Caching layer is mandatory.

### How multi-game reuse works
1. **Single Vercel Blob bucket** (or one per environment): `https://<id>.public.blob.vercel-storage.com/rosters/pl-v2026-05.json.gz`
2. **`latest.json` pointer** alongside it.
3. Each game project has env var `ROSTER_BASE_URL` pointing at the bucket; no cross-project Vercel coupling needed.
4. Admin "publish roster" Server Action regenerates JSON from Supabase, `put()`s to Blob, bumps pointer, calls `invalidateByTag('roster')`.

### Code sketch (the 5 lines that matter)

```ts
// lib/roster.ts
import { put } from '@vercel/blob'
import { cacheTag, cacheLife } from 'next/cache'

export async function getRoster(league: 'pl' | 'laliga' = 'pl') {
  'use cache: remote'
  cacheTag(`roster:${league}`)
  cacheLife({ expire: 60 * 60 * 24 * 7 }) // 7d, manually invalidated on publish
  const res = await fetch(`${process.env.ROSTER_BASE_URL}/rosters/${league}-latest.json.gz`)
  return res.json() as Promise<Player[]>
}

export async function publishRoster(league: string, players: Player[]) {
  const blob = await put(`rosters/${league}-v${Date.now()}.json.gz`, gzip(JSON.stringify(players)), { access: 'public' })
  await put(`rosters/${league}-latest.json`, JSON.stringify({ url: blob.url }), { access: 'public', allowOverwrite: true })
  const { invalidateByTag } = await import('@vercel/functions')
  await invalidateByTag(`roster:${league}`)
}
```

### Migration order from today's Headball
1. Keep Supabase `players` table — it's the editable origin.
2. Add `scripts/publish-roster.ts` that snapshots `players` → gzipped JSON → Vercel Blob.
3. Replace direct Supabase reads in game routes with `getRoster()`.
4. Add admin "Publish roster" button that calls `publishRoster()` + tag invalidation.
5. Future game #2 just `fetch()`es the same Blob URL — zero new infra.

---

## Sources

- [Vercel Edge Config Limits and Pricing](https://vercel.com/docs/edge-config/edge-config-limits) — last updated 2026-02-26 (8 KB / 64 KB / 512 KB caps)
- [Vercel Edge Config product page](https://vercel.com/storage/edge-config) — <1 ms / p99 <15 ms read latency
- [Vercel Blob GA pricing](https://x.com/vercel/status/1925632672488968683) — $0.023/GB-mo storage, $0.05/GB egress
- [Vercel Blob pricing docs](https://vercel.com/docs/vercel-blob/usage-and-pricing) — operations and tiers
- [Vercel Runtime Cache changelog](https://vercel.com/changelog/introducing-the-runtime-cache-api) — 2 MB items, 64 tags, ~300 ms expire propagation
- [Vercel Runtime Cache docs](https://vercel.com/docs/runtime-cache)
- [Cloudflare Workers KV Limits](https://developers.cloudflare.com/kv/platform/limits/) — 25 MiB value, 1 write/s/key
- [Cloudflare Workers KV Pricing](https://developers.cloudflare.com/kv/platform/pricing/) — $0.50/M reads, $5/M writes, $0.50/GB-mo
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/) — $0.015/GB-mo, $0.36/M Class A/B, free egress
- [Upstash Redis pricing 2026](https://upstash.com/pricing/redis) — $0.20/100K req, 200 GB free bandwidth
- Internal Vercel skills loaded this session: `vercel:vercel-storage`, `vercel:runtime-cache`, `vercel:env-vars`
- Project context: `/Users/adisakchaiyakul/project/board-game/CLAUDE.md`, `supabase/migrations/0003_seed_players.sql`
