import { describe, expect, it } from "vitest"
import { ROLES, type RoleId } from "@social-hub/content"
import {
  MAX_WOLF_CUB,
  PACK_REQUIRED,
  SINGLETON_WOLVES,
  WOLF_POOLS,
  type ArchetypeId,
} from "./wolf-pools"

const EXPECTED_ARCHETYPE_KEYS: ArchetypeId[] = [
  "classic-detective",
  "wolf-chaos",
  "info-heavy",
  "beginner",
  "power-roles",
  "social-bluff",
  "neutral-mayhem",
  "balanced-power",
]

describe("WOLF_POOLS", () => {
  it("contains all 8 archetype keys", () => {
    const keys = Object.keys(WOLF_POOLS).sort()
    expect(keys).toEqual([...EXPECTED_ARCHETYPE_KEYS].sort())
    expect(keys).toHaveLength(8)
  })

  it("every role id in every pool exists in ROLES", () => {
    for (const [archetype, pool] of Object.entries(WOLF_POOLS)) {
      for (const roleId of pool) {
        expect(
          ROLES[roleId as RoleId],
          `archetype "${archetype}" references unknown role "${roleId}"`,
        ).toBeDefined()
      }
    }
  })
})

describe("SINGLETON_WOLVES", () => {
  it("is a subset of the union of all wolf pools", () => {
    const union = new Set<string>()
    for (const pool of Object.values(WOLF_POOLS)) {
      for (const roleId of pool) union.add(roleId)
    }
    for (const w of SINGLETON_WOLVES) {
      expect(union.has(w), `singleton wolf "${w}" not in any pool`).toBe(true)
    }
  })

  it("contains alpha-wolf, minion, sorceress", () => {
    expect(SINGLETON_WOLVES.has("alpha-wolf")).toBe(true)
    expect(SINGLETON_WOLVES.has("minion")).toBe(true)
    expect(SINGLETON_WOLVES.has("sorceress")).toBe(true)
    expect(SINGLETON_WOLVES.size).toBe(3)
  })
})

describe("PACK_REQUIRED", () => {
  it("contains wolf-cub, alpha-wolf, minion", () => {
    expect(PACK_REQUIRED.has("wolf-cub")).toBe(true)
    expect(PACK_REQUIRED.has("alpha-wolf")).toBe(true)
    expect(PACK_REQUIRED.has("minion")).toBe(true)
    expect(PACK_REQUIRED.size).toBe(3)
  })

  it("excludes sorceress (she hunts the Seer alone)", () => {
    expect(PACK_REQUIRED.has("sorceress")).toBe(false)
  })
})

describe("MAX_WOLF_CUB", () => {
  it("equals 2", () => {
    expect(MAX_WOLF_CUB).toBe(2)
  })
})
