import { describe, expect, it } from "vitest"
import fc from "fast-check"
import { ROLES, ROLE_IDS, type RoleId } from "@social-hub/content"

import { validate } from "./validator"

const WOLF_IDS = ROLE_IDS.filter((id) => ROLES[id].team === "werewolf")
const VILLAGE_IDS = ROLE_IDS.filter((id) => ROLES[id].team === "village")
const NEUTRAL_IDS = ROLE_IDS.filter((id) => ROLES[id].team === "neutral")

describe("validate — blockers", () => {
  it("fires `no-wolves` on an all-village setup", () => {
    const setup: RoleId[] = ["villager", "villager", "villager", "seer"]
    const result = validate(setup, setup.length)
    expect(result.ok).toBe(false)
    expect(result.blockers).toContain("no-wolves")
    expect(result.wolfCount).toBe(0)
  })

  it("fires `wolves-gte-village` when wolves equal village (neutrals excluded)", () => {
    // 2 wolves, 2 village, 1 neutral — wolves >= village even though neutral pads count
    const setup: RoleId[] = [
      "werewolf",
      "alpha-wolf",
      "villager",
      "seer",
      "tanner",
    ]
    const result = validate(setup, setup.length)
    expect(result.ok).toBe(false)
    expect(result.blockers).toContain("wolves-gte-village")
    expect(result.wolfCount).toBe(2)
    expect(result.villageCount).toBe(2)
    expect(result.neutralCount).toBe(1)
  })

  it("fires `wolves-gte-village` when wolves exceed village", () => {
    const setup: RoleId[] = ["werewolf", "alpha-wolf", "sorceress", "villager"]
    const result = validate(setup, setup.length)
    expect(result.blockers).toContain("wolves-gte-village")
  })

  it("fires `role-count-mismatch` when length !== playerCount", () => {
    const setup: RoleId[] = ["werewolf", "villager", "seer"]
    const result = validate(setup, 8)
    expect(result.ok).toBe(false)
    expect(result.blockers).toContain("role-count-mismatch")
  })

  it("fires `unknown-role` when a role id is not in ROLES (strict, decision #3)", () => {
    const setup = ["werewolf", "not-a-real-role", "seer", "villager"] as RoleId[]
    const result = validate(setup, setup.length)
    expect(result.ok).toBe(false)
    expect(result.blockers).toContain("unknown-role")
  })

  it("returns ok:true on a balanced happy-path setup", () => {
    // 8 players: 2 wolves, 5 village, 1 neutral.
    const setup: RoleId[] = [
      "werewolf",
      "alpha-wolf",
      "seer",
      "bodyguard",
      "villager",
      "villager",
      "mason",
      "tanner",
    ]
    const result = validate(setup, setup.length)
    expect(result.ok).toBe(true)
    expect(result.blockers).toEqual([])
    expect(result.wolfCount).toBe(2)
    expect(result.villageCount).toBe(5)
    expect(result.neutralCount).toBe(1)
    const expectedBalance = setup.reduce((a, id) => a + ROLES[id].balance, 0)
    expect(result.balance).toBe(expectedBalance)
    const expectedWolfSum = setup
      .filter((id) => ROLES[id].balance < 0)
      .reduce((a, id) => a + ROLES[id].balance, 0)
    const expectedVillageSum = setup
      .filter((id) => ROLES[id].balance > 0)
      .reduce((a, id) => a + ROLES[id].balance, 0)
    expect(result.wolfSum).toBe(expectedWolfSum)
    expect(result.villageSum).toBe(expectedVillageSum)
  })

  it("computes balance/wolfSum/villageSum correctly with mixed roles", () => {
    const setup: RoleId[] = ["werewolf", "werewolf", "seer", "villager"]
    const result = validate(setup, setup.length)
    expect(result.balance).toBe(
      setup.reduce((a, id) => a + ROLES[id].balance, 0),
    )
    // wolfSum = sum of strictly negative balances; villageSum = sum of strictly positive.
    expect(result.wolfSum).toBeLessThanOrEqual(0)
    expect(result.villageSum).toBeGreaterThanOrEqual(0)
  })
})

describe("validate — property tests", () => {
  it("any valid setup (>=1 wolf, wolves < village, no unknown) passes", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...WOLF_IDS),
        fc.array(fc.constantFrom(...WOLF_IDS), { minLength: 0, maxLength: 2 }),
        fc.array(fc.constantFrom(...VILLAGE_IDS), {
          minLength: 3,
          maxLength: 12,
        }),
        fc.array(fc.constantFrom(...NEUTRAL_IDS), {
          minLength: 0,
          maxLength: 2,
        }),
        (anchorWolf, extraWolves, villageRoles, neutralRoles) => {
          const wolves: RoleId[] = [anchorWolf, ...extraWolves]
          if (wolves.length >= villageRoles.length) {
            // skew toward a valid setup by trimming wolves
            wolves.length = Math.max(1, villageRoles.length - 1)
          }
          const setup: RoleId[] = [...wolves, ...villageRoles, ...neutralRoles]
          const result = validate(setup, setup.length)
          // Setup is guaranteed valid by construction.
          return result.ok === true && result.blockers.length === 0
        },
      ),
      { numRuns: 100 },
    )
  })

  it("any all-village random setup returns `no-wolves` blocker", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...VILLAGE_IDS), {
          minLength: 1,
          maxLength: 20,
        }),
        (villageRoles) => {
          const result = validate(villageRoles, villageRoles.length)
          return result.blockers.includes("no-wolves")
        },
      ),
      { numRuns: 100 },
    )
  })
})
