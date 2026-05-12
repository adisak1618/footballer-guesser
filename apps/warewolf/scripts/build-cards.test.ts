import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import sharp from "sharp"

import { buildCards } from "./build-cards"

const SAMPLE_IDS = ["werewolf", "seer", "villager"] as const

async function makeSourceJpg(file: string): Promise<void> {
  // 735x1000 red rectangle — matches the real source dimensions
  await sharp({
    create: {
      width: 735,
      height: 1000,
      channels: 3,
      background: { r: 200, g: 50, b: 50 },
    },
  })
    .jpeg({ quality: 90 })
    .toFile(file)
}

describe("buildCards", () => {
  let srcDir: string
  let destDir: string

  beforeEach(async () => {
    srcDir = await mkdtemp(path.join(tmpdir(), "warewolf-src-"))
    destDir = await mkdtemp(path.join(tmpdir(), "warewolf-dest-"))
    for (const id of SAMPLE_IDS) {
      await makeSourceJpg(path.join(srcDir, `${id}.jpg`))
    }
  })

  afterEach(async () => {
    await rm(srcDir, { recursive: true, force: true })
    await rm(destDir, { recursive: true, force: true })
  })

  it("produces WebP files at 512x768 from JPG sources", async () => {
    const result = await buildCards({
      sourceDir: srcDir,
      destDir,
      roleIds: SAMPLE_IDS as unknown as readonly string[],
    })

    expect(result.built).toBe(SAMPLE_IDS.length)
    expect(result.skipped).toBe(0)

    for (const id of SAMPLE_IDS) {
      const out = path.join(destDir, `${id}.webp`)
      const meta = await sharp(out).metadata()
      expect(meta.format).toBe("webp")
      expect(meta.width).toBe(512)
      expect(meta.height).toBe(768)
    }
  })

  it("is idempotent — second run skips up-to-date outputs", async () => {
    const first = await buildCards({
      sourceDir: srcDir,
      destDir,
      roleIds: SAMPLE_IDS as unknown as readonly string[],
    })
    expect(first.built).toBe(SAMPLE_IDS.length)

    const second = await buildCards({
      sourceDir: srcDir,
      destDir,
      roleIds: SAMPLE_IDS as unknown as readonly string[],
    })
    expect(second.built).toBe(0)
    expect(second.skipped).toBe(SAMPLE_IDS.length)
  })

  it("rebuilds when source is newer than dest", async () => {
    await buildCards({
      sourceDir: srcDir,
      destDir,
      roleIds: SAMPLE_IDS as unknown as readonly string[],
    })
    // Touch a source to bump mtime past the dest mtime
    const target = SAMPLE_IDS[0]
    const srcFile = path.join(srcDir, `${target}.jpg`)
    const destFile = path.join(destDir, `${target}.webp`)
    const destStat = await stat(destFile)
    const newer = new Date(destStat.mtimeMs + 2000)
    await writeFile(srcFile, await sharp({
      create: {
        width: 735,
        height: 1000,
        channels: 3,
        background: { r: 10, g: 200, b: 10 },
      },
    }).jpeg({ quality: 90 }).toBuffer())
    await import("node:fs/promises").then((fs) =>
      fs.utimes(srcFile, newer, newer),
    )

    const result = await buildCards({
      sourceDir: srcDir,
      destDir,
      roleIds: SAMPLE_IDS as unknown as readonly string[],
    })
    expect(result.built).toBe(1)
    expect(result.skipped).toBe(SAMPLE_IDS.length - 1)
  })
})
