import { describe, expect, it } from "vitest"

import { ROLES, type RoleId } from "@social-hub/content"

import { ARCHETYPES } from "./archetypes"
import { VILLAGE_SEEDS } from "./village-seeds"
import type { ArchetypeId } from "./wolf-pools"

const ARCHETYPE_IDS = Object.keys(ARCHETYPES) as ArchetypeId[]

describe("VILLAGE_SEEDS", () => {
  it("has an entry for every archetype", () => {
    for (const id of ARCHETYPE_IDS) {
      expect(VILLAGE_SEEDS[id], `missing seeds for archetype ${id}`).toBeDefined()
    }
  })

  it("provides exactly 3 variations per archetype (8 × 3 = 24 total)", () => {
    let total = 0
    for (const id of ARCHETYPE_IDS) {
      expect(VILLAGE_SEEDS[id]).toHaveLength(3)
      total += VILLAGE_SEEDS[id].length
    }
    expect(total).toBe(24)
  })

  it("references only role ids that exist in ROLES", () => {
    for (const id of ARCHETYPE_IDS) {
      for (const seed of VILLAGE_SEEDS[id]) {
        for (const roleId of seed.village) {
          expect(ROLES[roleId as RoleId], `village role ${roleId} not in ROLES (${id})`).toBeDefined()
        }
        for (const roleId of seed.neutrals ?? []) {
          expect(ROLES[roleId as RoleId], `neutral role ${roleId} not in ROLES (${id})`).toBeDefined()
        }
      }
    }
  })

  it("provides en + th vibe text on every variation", () => {
    for (const id of ARCHETYPE_IDS) {
      for (const seed of VILLAGE_SEEDS[id]) {
        expect(seed.vibe.en.trim().length).toBeGreaterThan(0)
        expect(seed.vibe.th.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it("only places team: 'neutral' roles in the neutrals array (when present)", () => {
    for (const id of ARCHETYPE_IDS) {
      for (const seed of VILLAGE_SEEDS[id]) {
        if (!seed.neutrals) continue
        for (const roleId of seed.neutrals) {
          expect(ROLES[roleId as RoleId].team, `${roleId} should be neutral (${id})`).toBe("neutral")
        }
      }
    }
  })
})
