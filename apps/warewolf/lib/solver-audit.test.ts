/**
 * Balance audit — exhaustively walks every visible `(archetype × playerCount ×
 * variationIdx)` cell and asserts `|balance| <= 5`. This is the V1 regression
 * net: if a seed (US-004) or wolf pool (US-002) drifts, this test fails loudly
 * and names the offending tuple so the fix is obvious. The threshold itself is
 * the contract — if a cell exceeds it, fix the data, not this test (per story
 * US-023 Technical Notes).
 *
 * A cell is "visible" iff `archetype.minPlayers <= playerCount <= maxPlayers`.
 * Out-of-range cells are skipped silently (the customize page hides them too).
 *
 * Cell count: 8 archetypes × span(min..max) × 3 variations. Spans vary per
 * archetype, so the live total lands around ~300; the spec doc cited up to
 * 384 as an upper bound across the catalog.
 *
 * Separate perf test asserts `computeSetupList(20)` runs in < 50ms per Eng
 * Review perf gate.
 */

import { describe, expect, it } from "vitest"

import { ARCHETYPES } from "./archetypes"
import { computeSetupList, generateVariations } from "./solver"
import type { ArchetypeId } from "./wolf-pools"

const MAX_ABS_BALANCE = 5
const ALL_ARCHETYPES: ArchetypeId[] = Object.keys(ARCHETYPES) as ArchetypeId[]

describe("balance audit (every visible archetype × playerCount × variation cell)", () => {
  it("every visible cell has |balance| <= 5", () => {
    const failures: string[] = []
    let cellsChecked = 0

    for (const archetypeId of ALL_ARCHETYPES) {
      const arch = ARCHETYPES[archetypeId]
      for (let playerCount = arch.minPlayers; playerCount <= arch.maxPlayers; playerCount++) {
        let variations
        try {
          variations = generateVariations(archetypeId, playerCount)
        } catch (err) {
          // Solver throws (Eng Review #2) are NOT audit failures — UI renders
          // <SolverErrorRow>. Skip and continue auditing other cells.
          continue
        }
        for (let variationIdx = 0; variationIdx < variations.length; variationIdx++) {
          const cell = variations[variationIdx]!
          cellsChecked++
          if (Math.abs(cell.balance) > MAX_ABS_BALANCE) {
            failures.push(
              `(${archetypeId}, players=${playerCount}, variation=${variationIdx}) ` +
                `balance=${cell.balance} (|balance|=${Math.abs(cell.balance)} > ${MAX_ABS_BALANCE})`,
            )
          }
        }
      }
    }

    // Sanity: catalog produces ~300+ visible cells. If this drops dramatically
    // a future refactor probably broke generateVariations silently — fail
    // loudly rather than silently passing on an empty audit.
    expect(cellsChecked).toBeGreaterThan(200)

    if (failures.length > 0) {
      throw new Error(
        `Balance audit found ${failures.length} cell(s) exceeding |balance|<=${MAX_ABS_BALANCE}:\n` +
          failures.join("\n"),
      )
    }
  })
})

describe("solver perf gate", () => {
  it("computeSetupList(20) completes in < 50ms", () => {
    // Warm the V8 inline caches once so the measured run reflects steady-state
    // cost, not first-call JIT overhead.
    computeSetupList(20)

    const start = performance.now()
    computeSetupList(20)
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(50)
  })
})
