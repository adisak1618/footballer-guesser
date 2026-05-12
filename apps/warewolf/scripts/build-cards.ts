// Card-art build pipeline — Sharp JPG → WebP @ 512×768@85.
//
// Per Eng Review decision #1: V1 ships existing photos of Bezier Games Ultimate
// Werewolf cards from `apps/warewolf/source/processed/warewolf-card-cropped/`.
// User accepted IP risk; no watermarking, no attribution overlay.
//
// Output strategy: option (a) symlink. WebPs are written to
// `packages/content/card-art/<roleId>.webp` (single source of truth, importable
// from any future app in the monorepo). For runtime serving by `next/image`,
// `apps/warewolf/public/cards` is ensured to be a symlink pointing at
// `../../../packages/content/card-art`, so the assets are reachable under the
// stable URL `/cards/<roleId>.webp`. The matching public-URL helper is
// `cardArtPath(roleId)` exported from `@social-hub/content`.
//
// Idempotency: a destination is rewritten only when its source JPG is missing
// from the dest or its mtime is newer than the existing WebP.
//
// Usage:
//   bun run build:cards                # rebuilds anything stale, symlinks public/cards
//   bunx tsx scripts/build-cards.ts    # same, direct entry
//
// Tested in `scripts/build-cards.test.ts` against a temp dir.

import { mkdir, readlink, stat, symlink, unlink } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

import { ROLE_IDS } from "@social-hub/content"

export interface BuildCardsOptions {
  sourceDir: string
  destDir: string
  roleIds: readonly string[]
  width?: number
  height?: number
  quality?: number
}

export interface BuildCardsResult {
  built: number
  skipped: number
  missingSources: string[]
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

async function isUpToDate(srcFile: string, destFile: string): Promise<boolean> {
  try {
    const [srcStat, destStat] = await Promise.all([
      stat(srcFile),
      stat(destFile),
    ])
    return destStat.mtimeMs >= srcStat.mtimeMs
  } catch {
    return false
  }
}

export async function buildCards(
  opts: BuildCardsOptions,
): Promise<BuildCardsResult> {
  const width = opts.width ?? 512
  const height = opts.height ?? 768
  const quality = opts.quality ?? 85

  await mkdir(opts.destDir, { recursive: true })

  let built = 0
  let skipped = 0
  const missingSources: string[] = []

  for (const id of opts.roleIds) {
    const srcFile = path.join(opts.sourceDir, `${id}.jpg`)
    const destFile = path.join(opts.destDir, `${id}.webp`)

    if (!(await fileExists(srcFile))) {
      missingSources.push(id)
      continue
    }

    if (await isUpToDate(srcFile, destFile)) {
      skipped++
      continue
    }

    await sharp(srcFile)
      .resize(width, height, { fit: "cover", position: "centre" })
      .webp({ quality })
      .toFile(destFile)
    built++
  }

  return { built, skipped, missingSources }
}

async function ensurePublicSymlink(
  publicCardsDir: string,
  cardArtDir: string,
): Promise<void> {
  const target = path.relative(path.dirname(publicCardsDir), cardArtDir)
  try {
    const existing = await readlink(publicCardsDir)
    if (existing === target) return
    await unlink(publicCardsDir)
  } catch {
    // Either doesn't exist, or isn't a symlink — if it's a real dir we'll
    // surface that as an error on symlink(). Recover by unlinking if possible.
    if (await fileExists(publicCardsDir)) {
      await unlink(publicCardsDir).catch(() => {
        /* ignore — symlink() below will fail with a clear message */
      })
    }
  }
  await mkdir(path.dirname(publicCardsDir), { recursive: true })
  await symlink(target, publicCardsDir, "dir")
}

async function main(): Promise<void> {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const appRoot = path.resolve(here, "..")
  const workspaceRoot = path.resolve(appRoot, "..", "..")

  const sourceDir = path.join(
    appRoot,
    "source",
    "processed",
    "warewolf-card-cropped",
  )
  const destDir = path.join(workspaceRoot, "packages", "content", "card-art")
  const publicCardsDir = path.join(appRoot, "public", "cards")

  const result = await buildCards({
    sourceDir,
    destDir,
    roleIds: ROLE_IDS,
  })

  await ensurePublicSymlink(publicCardsDir, destDir)

  const summary = [
    `built=${result.built}`,
    `skipped=${result.skipped}`,
    `total=${ROLE_IDS.length}`,
  ].join(" ")
  // eslint-disable-next-line no-console
  console.log(`[build-cards] ${summary}`)

  if (result.missingSources.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      `[build-cards] missing source JPGs for: ${result.missingSources.join(", ")}`,
    )
    process.exit(1)
  }
}

const invokedAsScript =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("build-cards.ts") === true

if (invokedAsScript) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err)
    process.exit(1)
  })
}
