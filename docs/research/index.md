---
title: Research Index
slug: index
category: meta
tags: [index, catalog, navigation]
date: 2026-05-02
status: living-document
---

# Research Index

Durable architectural research for the Headball game family. Each entry is one self-contained markdown file with structured frontmatter (`category`, `tags`, `problem-domain`, `status`) so future sessions can grep, filter, and cite without re-reading every doc.

## How this folder is organized

- **One topic per file.** No multi-topic dumps. Filename = `slug` from frontmatter.
- **Frontmatter is the metadata contract.** Every research doc must have `title`, `slug`, `category`, `tags`, `problem-domain`, `date`, `status`. Optional: `approach`, `dataset-size`, `read-write-ratio`, `related`.
- **`status` values:** `research` (exploring), `recommended` (we picked this), `rejected` (we evaluated and chose not to), `superseded` (newer doc replaces it — link via `related`), `living-document` (continuously updated).
- **`related` is bidirectional.** When you add a new doc, edit the related docs to point back.
- **Index entries are one line.** This file is a catalog, not a summary. Read the doc itself.
- **Filing rule for future research:** if it's a *general pattern* (cross-project), file into `~/llm-wiki/wiki/` instead. This folder is for Headball-family-specific architectural decisions.

## Catalog

### Category: data-architecture

Problem domain: **footballer-data-reuse** — the dataset (5–20 MB of player records) needs to be shared across many sibling football games with very fast reads and infrequent writes.

| Slug | Approach | Recommendation | Tags |
|---|---|---|---|
| [static-bundled-data](./static-bundled-data.md) | Static files (JSON / npm package / CDN) | Plain JSON in private npm workspace package, MiniSearch index at boot, Vercel Blob CDN escape hatch | `json` `npm-package` `bundled` `in-memory` `multi-game-reuse` |
| [edge-data-services](./edge-data-services.md) | Managed edge/CDN store | Supabase (writes) → Vercel Blob versioned JSON → Next.js `'use cache: remote'` w/ `cacheTag('roster:pl')` | `vercel-blob` `vercel-runtime-cache` `cloudflare-r2` `cdn-cache` `multi-game-reuse` |
| [embedded-distributed-db](./embedded-distributed-db.md) | Embedded / distributed SQL | `better-sqlite3` reading a `.db` file shipped in private `@headball/players-db` npm package | `sqlite` `better-sqlite3` `turso` `pglite` `duckdb` `multi-game-reuse` |

### Comparison matrix — footballer-data-reuse

| Dimension | static-bundled-data | edge-data-services | embedded-distributed-db |
|---|---|---|---|
| **Read latency** | 0 ms (in-memory) after one-time parse | ~1–10 ms (CDN edge) | μs (in-process SQLite) |
| **Cold start cost** | parse 5–20 MB JSON once (~50–200 ms) | first fetch + decompress | open `.db` file (~5–20 ms) |
| **Update latency (transfer window)** | redeploy every game OR bump npm version | ~300 ms global (`invalidateByTag`) | redeploy / republish npm |
| **Mid-week roster swap without redeploy** | ❌ (or escape-hatch CDN fetch) | ✅ native | ❌ (or lazy-download `.db` from Blob) |
| **Query ergonomics** | JS `.filter()` + MiniSearch | JS over fetched JSON | full SQL + indexes |
| **Cross-game share mechanism** | npm workspace package | shared CDN URL (`ROSTER_BASE_URL`) | npm workspace package |
| **Vendor lock** | none | Vercel-leaning (Blob + Runtime Cache) | none (SQLite is portable) |
| **Cost at our scale** | $0 | ~rounding error | $0 |
| **Best when** | rosters change with code releases | rosters change independently of releases | needs SQL joins / many query shapes |
| **Status** | research | research | research |

### Decision lever

The three recommendations diverge on **one question**:

> **How often does the roster need to update independently of a code deploy?**

- **Almost never** (transfer windows = release windows) → `static-bundled-data` (npm package). Simplest, cheapest, $0 ops.
- **Often / unpredictable** (admin can swap mid-week, push to all N games at once) → `edge-data-services` (Supabase + Blob + cache tags).
- **Rarely, but you want SQL** (complex queries: "top scorers from clubs founded before 1900 who play left-back") → `embedded-distributed-db` (`better-sqlite3` in npm package).

All three solve cross-game reuse. None hit our scale's cost ceiling. Pick based on the update-cadence question above, not on cost or performance.

### Open questions to resolve before locking a choice

- How frequently will the roster actually change? (Transfer windows are 2×/year; injury/captain updates could be weekly.)
- Will any future game *write* into the shared dataset? (If yes, `static-bundled-data` and the npm-package variant of `embedded-distributed-db` are out — promote `edge-data-services` or upgrade to Turso.)
- Do any future games need offline play? (Bundled approaches win.)
- Is the photo asset pipeline separate from the JSON? (All three docs assume yes — photos go to a CDN folder with stable URLs in the data record.)

## Tag glossary

Tags are deliberately uncontrolled — add new ones as needed. Current tag groups:

- **Format**: `json`, `messagepack`, `flatbuffers`, `parquet`, `sqlite`
- **Distribution**: `npm-package`, `bundled`, `cdn-cache`, `multi-game-reuse`
- **Vendor**: `vercel-blob`, `vercel-edge-config`, `vercel-runtime-cache`, `cloudflare-r2`, `cloudflare-kv`, `upstash`, `turso`, `pglite`, `duckdb`, `supabase-replica`
- **Runtime**: `in-memory`, `edge-replica`, `embedded-sql`
- **Library**: `better-sqlite3`, `bun-sqlite`, `libsql`

When adding a new doc, prefer existing tags before inventing new ones. Grep this glossary first.

## Adding a new research doc

1. Create `docs/research/<slug>.md` with the frontmatter contract above.
2. Add a one-line row to the relevant category table in this index.
3. If it relates to existing docs, edit their `related:` frontmatter to point back.
4. If the topic is *general* (would be useful in another project), also file a copy or summary into `~/llm-wiki/wiki/`.
