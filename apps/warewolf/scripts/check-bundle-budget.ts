// Bundle-budget gate for /setup/customize.
//
// Per Eng Review locked perf decision: /setup/customize route-specific JS
// must stay at or below 80KB gzipped (target) with a +20% hard ceiling at
// 96KB (CI fails on regression beyond the margin).
//
// "Route-specific JS" is the set of static chunks that the prerendered
// /setup/customize HTML loads MINUS the chunks that the lightest baseline
// route (/en, the landing page) also loads. Under Turbopack the per-route
// build manifest only lists root-main + polyfills, so we read the actual
// chunk references from each route's prerendered HTML. This matches the
// spirit of the old webpack `next build` "Size" column (the cost ADDED by
// navigating to this route, not the always-shared baseline).
//
// Exit code 1 on overage. Usage: `bun run check:bundle`.

import { readFileSync } from "node:fs"
import { gzipSync } from "node:zlib"
import path from "node:path"
import { fileURLToPath } from "node:url"

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const NEXT_DIR = path.join(APP_ROOT, ".next")

const BUDGET_BYTES = 96 * 1024 // 96KB hard ceiling (80KB target + 20%)
const TARGET_BYTES = 80 * 1024 // 80KB target — over this warns; over BUDGET fails

const ROUTE = "/setup/customize"
const ROUTE_HTML = path.join(NEXT_DIR, "server/app/en/setup/customize.html")
const BASELINE_HTML = path.join(NEXT_DIR, "server/app/en.html")

function extractChunks(html: string): Set<string> {
  const chunks = new Set<string>()
  const re = /\/_next\/static\/chunks\/[A-Za-z0-9~_.-]+\.js/g
  for (const match of html.matchAll(re)) {
    chunks.add(match[0])
  }
  return chunks
}

function gzippedSize(chunkUrl: string): number {
  // chunkUrl looks like "/_next/static/chunks/abc.js" — map to .next/static/chunks/abc.js
  const rel = chunkUrl.replace(/^\/_next\//, "")
  const fullPath = path.join(NEXT_DIR, rel)
  const buf = readFileSync(fullPath)
  return gzipSync(buf).byteLength
}

function readOrDie(p: string): string {
  try {
    return readFileSync(p, "utf8")
  } catch (err) {
    console.error(`✗ check:bundle: missing build artifact ${p}`)
    console.error(`  Run \`next build\` (or \`bunx turbo run build --filter=@social-hub/warewolf\`) first.`)
    console.error(`  Underlying error: ${(err as Error).message}`)
    process.exit(1)
  }
}

const routeHtml = readOrDie(ROUTE_HTML)
const baselineHtml = readOrDie(BASELINE_HTML)

const routeChunks = extractChunks(routeHtml)
const baselineChunks = extractChunks(baselineHtml)

if (routeChunks.size === 0) {
  console.error(`✗ check:bundle: no chunks found in ${ROUTE_HTML}`)
  console.error(`  This suggests the route did not prerender correctly.`)
  process.exit(1)
}

// Route-specific chunks: in route, not in baseline.
const specific = [...routeChunks].filter((c) => !baselineChunks.has(c)).sort()

let total = 0
const breakdown: Array<{ chunk: string; gz: number }> = []
for (const chunk of specific) {
  const gz = gzippedSize(chunk)
  total += gz
  breakdown.push({ chunk, gz })
}

const fmt = (n: number) => `${(n / 1024).toFixed(2)}KB`

console.log(`Bundle budget check — route: ${ROUTE}`)
console.log(`  baseline route: /en (${baselineChunks.size} shared chunks)`)
console.log(`  route-specific chunks (${specific.length}):`)
for (const { chunk, gz } of breakdown) {
  console.log(`    ${fmt(gz).padStart(8)}  ${chunk}`)
}
console.log(`  -----`)
console.log(`  total gzipped: ${fmt(total)}`)
console.log(`  target:        ${fmt(TARGET_BYTES)}`)
console.log(`  hard budget:   ${fmt(BUDGET_BYTES)} (target + 20%)`)

if (total > BUDGET_BYTES) {
  console.error(``)
  console.error(`✗ check:bundle FAILED — route ${ROUTE}`)
  console.error(`  actual gzipped JS: ${fmt(total)} (${total} bytes)`)
  console.error(`  budget:            ${fmt(BUDGET_BYTES)} (${BUDGET_BYTES} bytes)`)
  console.error(`  overage:           ${fmt(total - BUDGET_BYTES)}`)
  console.error(``)
  console.error(`  Per Eng Review locked decision the customize page must stay`)
  console.error(`  within 80KB +20% gzipped. Fix at the source (split components,`)
  console.error(`  lazy-load, prune deps) — do NOT raise the budget without a`)
  console.error(`  design-doc amendment.`)
  process.exit(1)
}

if (total > TARGET_BYTES) {
  console.warn(``)
  console.warn(`⚠ check:bundle WARNING — route ${ROUTE}`)
  console.warn(`  ${fmt(total)} is above the 80KB target but within the +20% margin.`)
  console.warn(`  Plan a follow-up to reduce; CI will fail at ${fmt(BUDGET_BYTES)}.`)
}

console.log(``)
console.log(`✓ check:bundle OK — ${fmt(total)} ≤ ${fmt(BUDGET_BYTES)}`)
process.exit(0)
