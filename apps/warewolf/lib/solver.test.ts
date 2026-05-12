import { describe, expect, it } from "vitest"
import { ROLES, type RoleId } from "@social-hub/content"
import {
  communityWolfCount,
  computeSetupList,
  generateVariations,
  isSolverError,
  pickWolvesForBalance,
} from "./solver"
import { ARCHETYPES } from "./archetypes"
import type { ArchetypeId } from "./wolf-pools"
import { MAX_WOLF_CUB, PACK_REQUIRED, SINGLETON_WOLVES } from "./wolf-pools"

const ALL_ARCHETYPES: ArchetypeId[] = Object.keys(ARCHETYPES) as ArchetypeId[]

describe("communityWolfCount", () => {
  it("returns 1 for n=4 (boundary)", () => {
    expect(communityWolfCount(4)).toBe(1)
  })
  it("returns 1 for n=5", () => {
    expect(communityWolfCount(5)).toBe(1)
  })
  it("returns 2 for n=6", () => {
    expect(communityWolfCount(6)).toBe(2)
  })
  it("returns 2 for n=9", () => {
    expect(communityWolfCount(9)).toBe(2)
  })
  it("returns 3 for n=10", () => {
    expect(communityWolfCount(10)).toBe(3)
  })
  it("returns 3 for n=13", () => {
    expect(communityWolfCount(13)).toBe(3)
  })
  it("returns 4 for n=14", () => {
    expect(communityWolfCount(14)).toBe(4)
  })
  it("returns 4 for n=20", () => {
    expect(communityWolfCount(20)).toBe(4)
  })
})

describe("pickWolvesForBalance", () => {
  it("filters PACK_REQUIRED roles when count === 1", () => {
    // 'beginner' pool is ['werewolf','wolf-cub']; wolf-cub is PACK_REQUIRED.
    // With count=1 the filter must drop wolf-cub, leaving only werewolf.
    const picks = pickWolvesForBalance("beginner", 1, -6)
    expect(picks).toEqual(["werewolf"])
    expect(picks).toHaveLength(1)
    for (const id of picks) {
      expect(PACK_REQUIRED.has(id)).toBe(false)
    }
  })

  it("never picks SINGLETON_WOLVES more than once", () => {
    const picks = pickWolvesForBalance("wolf-chaos", 4, -50)
    const counts = new Map<RoleId, number>()
    for (const id of picks) counts.set(id, (counts.get(id) ?? 0) + 1)
    for (const id of SINGLETON_WOLVES) {
      const c = counts.get(id) ?? 0
      expect(c).toBeLessThanOrEqual(1)
    }
  })

  it("caps wolf-cub at MAX_WOLF_CUB (=2)", () => {
    // Drive selection to want as many cubs as possible by asking for a very
    // negative target (cubs are -8, the most negative wolf).
    const picks = pickWolvesForBalance("beginner", 4, -1000)
    const cubCount = picks.filter((r) => r === "wolf-cub").length
    expect(cubCount).toBeLessThanOrEqual(MAX_WOLF_CUB)
  })

  it("throws when filtered pool is empty (Eng Review decision #2)", () => {
    // Construct a fake archetype with no entries by aiming count=1 at an
    // archetype whose pool is entirely PACK_REQUIRED roles. None of the V1
    // archetypes happen to be all-pack — so use the runtime by passing a
    // bogus id, which yields an empty pool.
    expect(() =>
      pickWolvesForBalance("__bogus__" as ArchetypeId, 1, 0),
    ).toThrowError(/Solver pool exhausted for __bogus__ \(count=1\)/)
  })

  it("is deterministic — same args produce the same composition", () => {
    const a = pickWolvesForBalance("classic-detective", 3, -20)
    const b = pickWolvesForBalance("classic-detective", 3, -20)
    expect(a).toEqual(b)
  })

  it("returns [] safely for count=0", () => {
    expect(pickWolvesForBalance("classic-detective", 0, 0)).toEqual([])
  })

  it("returns array of length exactly `count`", () => {
    for (const count of [1, 2, 3, 4]) {
      const picks = pickWolvesForBalance("classic-detective", count, -20)
      expect(picks).toHaveLength(count)
    }
  })
})

describe("generateVariations", () => {
  it("returns 3 entries (one per village seed)", () => {
    const variations = generateVariations("classic-detective", 8)
    expect(variations).toHaveLength(3)
    expect(variations.map((v) => v.roman)).toEqual(["I", "II", "III"])
  })

  it("each variation has roles.length === playerCount", () => {
    const playerCount = 10
    const variations = generateVariations("classic-detective", playerCount)
    for (const v of variations) {
      expect(v.roles).toHaveLength(playerCount)
    }
  })

  it("wolfDelta is applied (wolf-chaos has +1 wolf vs community count)", () => {
    const playerCount = 7
    const baseWolves = communityWolfCount(playerCount)
    const chaos = generateVariations("wolf-chaos", playerCount)
    for (const v of chaos) {
      const wolves = v.roles.filter((r) => ROLES[r].team === "werewolf").length
      expect(wolves).toBe(baseWolves + 1)
    }
  })

  it("balance is the sum of role.balance across roles", () => {
    const variations = generateVariations("classic-detective", 8)
    for (const v of variations) {
      const expected = v.roles.reduce((acc, id) => acc + ROLES[id].balance, 0)
      expect(v.balance).toBe(expected)
    }
  })

  it("carries archetypeId, variationIdx, vibe from inputs", () => {
    const variations = generateVariations("classic-detective", 8)
    variations.forEach((v, i) => {
      expect(v.archetypeId).toBe("classic-detective")
      expect(v.variationIdx).toBe(i)
      expect(v.vibe).toBeDefined()
      expect(typeof v.vibe.en).toBe("string")
      expect(typeof v.vibe.th).toBe("string")
    })
  })
})

describe("computeSetupList", () => {
  it("hides archetypes whose [minPlayers,maxPlayers] excludes the count", () => {
    // 'wolf-chaos' is 5–9 players; at 14 players it must be excluded.
    const list = computeSetupList(14)
    const ids = new Set(list.map((s) => s.archetypeId))
    expect(ids.has("wolf-chaos")).toBe(false)
  })

  it("filter narrows the list to the selected archetypes", () => {
    const filter = new Set<ArchetypeId>(["classic-detective"])
    const list = computeSetupList(8, filter)
    const archetypes = new Set(list.map((s) => s.archetypeId))
    expect(archetypes.size).toBe(1)
    expect(archetypes.has("classic-detective")).toBe(true)
    // 3 variations of the only archetype
    expect(list).toHaveLength(3)
  })

  it("empty result for a nonsense player count", () => {
    expect(computeSetupList(1)).toEqual([])
    expect(computeSetupList(100)).toEqual([])
  })

  it("non-error rows are sorted by |balance| ASCENDING", () => {
    const list = computeSetupList(8)
    const setups = list.filter(
      (s): s is Exclude<typeof s, { kind: "solver-error" }> =>
        !isSolverError(s),
    )
    const balances = setups.map((s) => Math.abs(s.balance))
    for (let i = 1; i < balances.length; i++) {
      expect(balances[i]).toBeGreaterThanOrEqual(balances[i - 1])
    }
  })

  it("shows all valid archetypes when activeFilters is empty/undefined", () => {
    // 8 players is in-range for all 8 archetypes — list must contain
    // 8 × 3 = 24 entries.
    const all = computeSetupList(8)
    expect(all).toHaveLength(24)
    const withEmptyFilter = computeSetupList(8, new Set())
    expect(withEmptyFilter).toHaveLength(24)
  })

  it("perf: computeSetupList(20) completes in < 50ms (Eng Review perf gate)", () => {
    const start = performance.now()
    computeSetupList(20)
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(50)
  })
})
