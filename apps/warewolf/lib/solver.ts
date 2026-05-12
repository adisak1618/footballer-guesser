/**
 * Pure-function solver — the math core of the warewolf balance recommender.
 *
 * Picks wolf compositions per archetype via DFS over the per-archetype wolf
 * pool, satisfying SINGLETON_WOLVES (max 1 each), MAX_WOLF_CUB (=2), and
 * PACK_REQUIRED (excluded when count===1) constraints, and emits the
 * composition whose balance sum is closest to a target.
 *
 * No DOM/browser APIs — isomorphic, safe for `generateMetadata` use.
 *
 * Source: prototype `finalized.html` lines 660–800 (algorithm), fixed per
 * Eng Review decision #2 (throw on empty pool, never return ['werewolf']
 * silently), design doc lines 409–443.
 */

import { ROLES, type RoleId } from "@social-hub/content"

import { ARCHETYPES } from "./archetypes"
import type { ArchetypeId } from "./wolf-pools"
import {
  MAX_WOLF_CUB,
  PACK_REQUIRED,
  SINGLETON_WOLVES,
  WOLF_POOLS,
} from "./wolf-pools"
import { VILLAGE_SEEDS, type VillageSeedVibe } from "./village-seeds"

export interface Setup {
  archetypeId: ArchetypeId
  variationIdx: 0 | 1 | 2
  roman: "I" | "II" | "III"
  roles: RoleId[]
  /** Signed integer = sum of role.balance across roles. 0 = perfectly balanced. */
  balance: number
  vibe: VillageSeedVibe
}

/**
 * Marker row emitted by `computeSetupList` when `pickWolvesForBalance` throws
 * for a given archetype/playerCount pair. The UI renders this as
 * `<SolverErrorRow archetype playerCount>` (US-014). Eng Review decision #2.
 */
export interface SolverError {
  kind: "solver-error"
  archetypeId: ArchetypeId
  playerCount: number
}

export type SetupListItem = Setup | SolverError

export const isSolverError = (item: SetupListItem): item is SolverError =>
  (item as SolverError).kind === "solver-error"

const ROMAN = ["I", "II", "III"] as const

/**
 * Community-standard wolf count (~1 wolf per 3.5–4 players).
 *
 *  | players | wolves |
 *  | ≤ 5     | 1      |
 *  | 6 – 9   | 2      |
 *  | 10 – 13 | 3      |
 *  | 14 – 20 | 4      |
 *
 * The prototype called this `bookletWolfCount`; the V1 catalog diverges from
 * the Ultimate Werewolf booklet at low counts in favor of community standards
 * — hence the rename to `communityWolfCount`.
 */
export function communityWolfCount(n: number): number {
  if (n <= 5) return 1
  if (n <= 9) return 2
  if (n <= 13) return 3
  return 4
}

/**
 * Pick `count` wolves from `WOLF_POOLS[archetypeId]` whose sum-of-balance is
 * closest to `targetSum`. DFS with replacement, respecting SINGLETON_WOLVES
 * (max 1 each), MAX_WOLF_CUB (=2), and PACK_REQUIRED (excluded for count=1).
 *
 * Deterministic — no PRNG. Ties broken by DFS order (first composition seen
 * for a given diff wins).
 *
 * THROWS `Solver pool exhausted for ${archetypeId} (count=${count})` when the
 * filtered pool is empty per Eng Review decision #2.
 */
export function pickWolvesForBalance(
  archetypeId: ArchetypeId,
  count: number,
  targetSum: number,
): RoleId[] {
  if (count === 0) return []

  const fullPool = WOLF_POOLS[archetypeId] ?? []
  const pool =
    count === 1 ? fullPool.filter((id) => !PACK_REQUIRED.has(id)) : fullPool

  if (pool.length === 0) {
    throw new Error(
      `Solver pool exhausted for ${archetypeId} (count=${count})`,
    )
  }

  let best: RoleId[] | null = null
  let bestDiff = Number.POSITIVE_INFINITY
  const picks: RoleId[] = []

  const dfs = (remaining: number, sum: number, startIdx: number): void => {
    if (remaining === 0) {
      const diff = Math.abs(sum - targetSum)
      if (diff < bestDiff) {
        bestDiff = diff
        best = picks.slice()
      }
      return
    }
    for (let i = startIdx; i < pool.length; i++) {
      const id = pool[i]!
      const have = picks.reduce((acc, x) => (x === id ? acc + 1 : acc), 0)
      if (SINGLETON_WOLVES.has(id) && have >= 1) continue
      if (id === "wolf-cub" && have >= MAX_WOLF_CUB) continue
      picks.push(id)
      dfs(remaining - 1, sum + ROLES[id].balance, i)
      picks.pop()
    }
  }

  dfs(count, 0, 0)

  // If DFS could not produce any composition (e.g. count=2 but pool has only
  // singletons and the constraints fully exclude size-2 combos), surface the
  // same exhaustion error — UI treats it identically.
  if (best === null) {
    throw new Error(
      `Solver pool exhausted for ${archetypeId} (count=${count})`,
    )
  }
  return best
}

/**
 * Generate the 3 hardcoded village-seed variations for `archetypeId` at
 * `playerCount`. Each variation's wolf count = `communityWolfCount(playerCount)
 * + ARCHETYPES[archetypeId].wolfDelta`. Targets total balance = 0 by picking
 * wolves whose sum cancels (village + neutrals + filler-villagers).
 *
 * Throws if `pickWolvesForBalance` throws for an unrecoverable archetype, or
 * if the village + neutrals identity already exceeds `playerCount` (config
 * error — should not happen if the archetype's minPlayers is correct).
 */
export function generateVariations(
  archetypeId: ArchetypeId,
  playerCount: number,
): Setup[] {
  const arch = ARCHETYPES[archetypeId]
  const wolfCount = communityWolfCount(playerCount) + arch.wolfDelta
  const seeds = VILLAGE_SEEDS[archetypeId]
  const villagerBalance = ROLES.villager.balance

  return seeds.map((seed, idx): Setup => {
    const village = seed.village
    const neutrals = seed.neutrals ?? []
    const fillers = playerCount - wolfCount - village.length - neutrals.length
    if (fillers < 0) {
      throw new Error(
        `Village identity for ${archetypeId} variation ${idx} exceeds playerCount=${playerCount}`,
      )
    }
    const villageSum = village.reduce((acc, id) => acc + ROLES[id].balance, 0)
    const neutralSum = neutrals.reduce((acc, id) => acc + ROLES[id].balance, 0)
    const fillerSum = fillers * villagerBalance
    const targetWolfSum = -(villageSum + neutralSum + fillerSum)
    const wolves = pickWolvesForBalance(archetypeId, wolfCount, targetWolfSum)
    const filler = Array<RoleId>(fillers).fill("villager")
    const roles: RoleId[] = [...wolves, ...village, ...neutrals, ...filler]
    const balance = roles.reduce((acc, id) => acc + ROLES[id].balance, 0)
    return {
      archetypeId,
      variationIdx: idx as 0 | 1 | 2,
      roman: ROMAN[idx]!,
      roles,
      balance,
      vibe: seed.vibe,
    }
  })
}

/**
 * Build the full list of suggested setups for `playerCount`, optionally
 * narrowed to `activeFilters`. Catches per-archetype solver failures and
 * substitutes a `SolverError` marker that the UI renders as
 * `<SolverErrorRow>` (US-014) per Eng Review decision #2.
 *
 * Non-error rows sort by `|balance|` ascending (most balanced first); error
 * rows sort to the bottom in archetype-declaration order.
 */
export function computeSetupList(
  playerCount: number,
  activeFilters?: Set<ArchetypeId>,
): SetupListItem[] {
  const filterActive = activeFilters !== undefined && activeFilters.size > 0
  const inRange: ArchetypeId[] = (Object.keys(ARCHETYPES) as ArchetypeId[]).filter(
    (id) => {
      const a = ARCHETYPES[id]
      if (playerCount < a.minPlayers || playerCount > a.maxPlayers) return false
      if (filterActive && !activeFilters!.has(id)) return false
      return true
    },
  )

  const setups: Setup[] = []
  const errors: SolverError[] = []

  for (const id of inRange) {
    try {
      setups.push(...generateVariations(id, playerCount))
    } catch {
      errors.push({ kind: "solver-error", archetypeId: id, playerCount })
    }
  }

  setups.sort((a, b) => Math.abs(a.balance) - Math.abs(b.balance))
  return [...setups, ...errors]
}
