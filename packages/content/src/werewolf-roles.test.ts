import { describe, expect, it } from "vitest"
import { ROLE_IDS, ROLES, type Role, type RoleId } from "./werewolf-roles"

const EXPECTED_ROLES: readonly RoleId[] = [
  // Wolf-team (5)
  "werewolf",
  "wolf-cub",
  "alpha-wolf",
  "minion",
  "sorceress",
  // Village info (4)
  "seer",
  "apprentice-seer",
  "aura-seer",
  "paranormal-investigator",
  // Village power (8)
  "witch",
  "bodyguard",
  "hunter",
  "tough-guy",
  "prince",
  "priest",
  "mayor",
  "drunk",
  // Village vanilla/social (4)
  "villager",
  "mason",
  "spellcaster",
  "old-hag",
  // Neutral (4)
  "tanner",
  "lone-wolf",
  "hoodlum",
  "cult-leader",
]

const EXCLUDED_ROLES = [
  "cursed",
  "doppelganger",
  "cupid",
  "diseased",
  "ghost",
  "lycan",
  "lone-other",
]

// The story acceptance criterion says "exactly 22 V1 roles" but then
// enumerates 25 named role IDs (5 wolf + 4 info + 8 power + 4 vanilla + 4
// neutral = 25). Same count appears in design doc Premise #8 and in the
// prototype's ROLE map (finalized.html lines 469–497). Treating the
// enumeration as the substantive contract; "22" is an upstream typo.
const V1_ROLE_COUNT = 25

describe("ROLES catalog", () => {
  it("contains exactly the V1 role set enumerated in the acceptance criteria", () => {
    expect(Object.keys(ROLES)).toHaveLength(V1_ROLE_COUNT)
    expect(ROLE_IDS).toHaveLength(V1_ROLE_COUNT)
    expect(EXPECTED_ROLES).toHaveLength(V1_ROLE_COUNT)
  })

  it("includes every expected V1 role id", () => {
    for (const id of EXPECTED_ROLES) {
      expect(ROLES[id]).toBeDefined()
      expect(ROLES[id].id).toBe(id)
    }
  })

  it("excludes V2-deferred roles per design doc Premise #8", () => {
    const keys = new Set(Object.keys(ROLES))
    for (const excluded of EXCLUDED_ROLES) {
      expect(keys.has(excluded)).toBe(false)
    }
  })

  it("every role has both English and Thai name + short + description", () => {
    for (const role of Object.values(ROLES) as Role[]) {
      expect(role.i18n.en.name.length).toBeGreaterThan(0)
      expect(role.i18n.en.short.length).toBeGreaterThan(0)
      expect(role.i18n.en.description.length).toBeGreaterThan(0)
      expect(role.i18n.th.name.length).toBeGreaterThan(0)
      expect(role.i18n.th.short.length).toBeGreaterThan(0)
      expect(role.i18n.th.description.length).toBeGreaterThan(0)
    }
  })

  it("RoleId union exactly matches the keys of ROLES", () => {
    // Static check: every expected RoleId must be assignable.
    const idsAsUnion: RoleId[] = EXPECTED_ROLES.slice()
    expect(idsAsUnion).toHaveLength(V1_ROLE_COUNT)

    // Runtime check: no extra keys, no missing keys.
    const actual = new Set(Object.keys(ROLES))
    const expected = new Set<string>(EXPECTED_ROLES)
    expect(actual).toEqual(expected)
  })

  it("balance values are signed integers", () => {
    for (const role of Object.values(ROLES) as Role[]) {
      expect(Number.isInteger(role.balance)).toBe(true)
      // Sanity range — no V1 role exceeds ±9 per role-balance.md.
      expect(Math.abs(role.balance)).toBeLessThanOrEqual(9)
    }
  })

  it("balance values match role-balance.md machine block", () => {
    const expected: Record<RoleId, number> = {
      werewolf: -6,
      "wolf-cub": -8,
      "alpha-wolf": -9,
      minion: -6,
      sorceress: -3,
      seer: 7,
      "apprentice-seer": 4,
      "aura-seer": 3,
      "paranormal-investigator": 3,
      witch: 4,
      bodyguard: 3,
      hunter: 3,
      "tough-guy": 3,
      prince: 3,
      priest: 3,
      mayor: 2,
      drunk: 4,
      villager: 1,
      mason: 2,
      spellcaster: 1,
      "old-hag": 1,
      tanner: -2,
      "lone-wolf": -5,
      hoodlum: 0,
      "cult-leader": 1,
    }
    for (const [id, bal] of Object.entries(expected) as [RoleId, number][]) {
      expect(ROLES[id].balance).toBe(bal)
    }
  })

  it("team values are one of village | werewolf | neutral", () => {
    const allowed = new Set(["village", "werewolf", "neutral"])
    for (const role of Object.values(ROLES) as Role[]) {
      expect(allowed.has(role.team)).toBe(true)
    }
  })

  it("cardArtPath points to packages/content/card-art/<id>.webp for every role", () => {
    for (const role of Object.values(ROLES) as Role[]) {
      expect(role.cardArtPath).toBe(
        `packages/content/card-art/${role.id}.webp`,
      )
    }
  })

  it("ROLES is frozen", () => {
    expect(Object.isFrozen(ROLES)).toBe(true)
  })
})
