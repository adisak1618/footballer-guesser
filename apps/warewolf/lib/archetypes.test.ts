import { describe, expect, it } from "vitest"
import { ARCHETYPES, type ArchetypeId } from "./archetypes"

const EXPECTED_IDS: ArchetypeId[] = [
  "classic-detective",
  "wolf-chaos",
  "info-heavy",
  "beginner",
  "power-roles",
  "social-bluff",
  "neutral-mayhem",
  "balanced-power",
]

describe("ARCHETYPES", () => {
  it("has 8 entries", () => {
    const keys = Object.keys(ARCHETYPES).sort()
    expect(keys).toEqual([...EXPECTED_IDS].sort())
    expect(keys).toHaveLength(8)
  })

  it("every entry has minPlayers <= maxPlayers", () => {
    for (const [id, arch] of Object.entries(ARCHETYPES)) {
      expect(
        arch.minPlayers,
        `archetype "${id}" minPlayers > maxPlayers`,
      ).toBeLessThanOrEqual(arch.maxPlayers)
    }
  })

  it("every entry has en + th name + vibe", () => {
    for (const [id, arch] of Object.entries(ARCHETYPES)) {
      expect(arch.i18n.en.name, `${id} missing en.name`).toBeTruthy()
      expect(arch.i18n.en.vibe, `${id} missing en.vibe`).toBeTruthy()
      expect(arch.i18n.th.name, `${id} missing th.name`).toBeTruthy()
      expect(arch.i18n.th.vibe, `${id} missing th.vibe`).toBeTruthy()
    }
  })

  it("only wolf-chaos has wolfDelta === 1", () => {
    for (const [id, arch] of Object.entries(ARCHETYPES)) {
      if (id === "wolf-chaos") {
        expect(arch.wolfDelta).toBe(1)
      } else {
        expect(arch.wolfDelta, `${id} should have wolfDelta 0`).toBe(0)
      }
    }
  })

  it("matches final caps from design doc lines 574-582", () => {
    expect(ARCHETYPES["classic-detective"].minPlayers).toBe(6)
    expect(ARCHETYPES["classic-detective"].maxPlayers).toBe(20)
    expect(ARCHETYPES["wolf-chaos"].minPlayers).toBe(5)
    expect(ARCHETYPES["wolf-chaos"].maxPlayers).toBe(9)
    expect(ARCHETYPES["info-heavy"].minPlayers).toBe(7)
    expect(ARCHETYPES["info-heavy"].maxPlayers).toBe(20)
    expect(ARCHETYPES["beginner"].minPlayers).toBe(6)
    expect(ARCHETYPES["beginner"].maxPlayers).toBe(13)
    expect(ARCHETYPES["power-roles"].minPlayers).toBe(6)
    expect(ARCHETYPES["power-roles"].maxPlayers).toBe(20)
    expect(ARCHETYPES["social-bluff"].minPlayers).toBe(5)
    expect(ARCHETYPES["social-bluff"].maxPlayers).toBe(13)
    expect(ARCHETYPES["neutral-mayhem"].minPlayers).toBe(7)
    expect(ARCHETYPES["neutral-mayhem"].maxPlayers).toBe(13)
    expect(ARCHETYPES["balanced-power"].minPlayers).toBe(7)
    expect(ARCHETYPES["balanced-power"].maxPlayers).toBe(20)
  })
})
