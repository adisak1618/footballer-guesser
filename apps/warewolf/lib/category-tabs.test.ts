import { describe, expect, it } from "vitest"
import { ROLES, ROLE_IDS, type Role, type RoleId } from "@social-hub/content"
import {
  TABS,
  type TabKey,
  mapCategoryToTab,
  rolesForTab,
} from "./category-tabs"

const ALL_ROLES: Role[] = Object.values(ROLES)

describe("TABS", () => {
  it("declares the 6 tabs in display order matching the prototype", () => {
    expect(TABS).toEqual([
      "wolves",
      "info",
      "power",
      "vanilla",
      "social",
      "neutral",
    ])
  })
})

describe("mapCategoryToTab", () => {
  it("maps every wolf-team role to 'wolves' regardless of fine-grained category", () => {
    const wolfRoles = ALL_ROLES.filter((r) => r.team === "werewolf")
    expect(wolfRoles).toHaveLength(5)
    for (const r of wolfRoles) {
      expect(mapCategoryToTab(r)).toBe("wolves")
    }
  })

  it("maps every neutral-team role to 'neutral'", () => {
    const neutrals = ALL_ROLES.filter((r) => r.team === "neutral")
    expect(neutrals).toHaveLength(4)
    for (const r of neutrals) {
      expect(mapCategoryToTab(r)).toBe("neutral")
    }
  })

  it("maps village info roles to 'info'", () => {
    expect(mapCategoryToTab(ROLES.seer)).toBe("info")
    expect(mapCategoryToTab(ROLES["apprentice-seer"])).toBe("info")
    expect(mapCategoryToTab(ROLES["aura-seer"])).toBe("info")
    expect(mapCategoryToTab(ROLES["paranormal-investigator"])).toBe("info")
  })

  it("maps village protection/kill/vote roles to 'power'", () => {
    expect(mapCategoryToTab(ROLES.witch)).toBe("power")
    expect(mapCategoryToTab(ROLES.bodyguard)).toBe("power")
    expect(mapCategoryToTab(ROLES.hunter)).toBe("power")
    expect(mapCategoryToTab(ROLES["tough-guy"])).toBe("power")
    expect(mapCategoryToTab(ROLES.prince)).toBe("power")
    expect(mapCategoryToTab(ROLES.priest)).toBe("power")
    expect(mapCategoryToTab(ROLES.mayor)).toBe("power")
    expect(mapCategoryToTab(ROLES.drunk)).toBe("power")
  })

  it("maps the vanilla-social subset {mason, spellcaster, old-hag} to 'social'", () => {
    expect(mapCategoryToTab(ROLES.mason)).toBe("social")
    expect(mapCategoryToTab(ROLES.spellcaster)).toBe("social")
    expect(mapCategoryToTab(ROLES["old-hag"])).toBe("social")
  })

  it("maps pure villager (vanilla, not in social subset) to 'vanilla'", () => {
    expect(mapCategoryToTab(ROLES.villager)).toBe("vanilla")
  })
})

describe("partition invariant — every role belongs to exactly one tab", () => {
  it("covers all roles across the 6 tabs with no orphans and no duplicates", () => {
    const seen = new Map<RoleId, TabKey[]>()
    for (const id of ROLE_IDS) {
      seen.set(id, [])
    }
    for (const tab of TABS) {
      const matches = rolesForTab(tab)
      for (const r of matches) {
        seen.get(r.id)?.push(tab)
      }
    }
    const orphans: RoleId[] = []
    const duplicates: Array<{ id: RoleId; tabs: TabKey[] }> = []
    for (const [id, tabs] of seen) {
      if (tabs.length === 0) orphans.push(id)
      if (tabs.length > 1) duplicates.push({ id, tabs })
    }
    expect(orphans).toEqual([])
    expect(duplicates).toEqual([])
  })

  it("the 6 tab counts sum to the full role catalog", () => {
    const total = TABS.reduce((acc, t) => acc + rolesForTab(t).length, 0)
    expect(total).toBe(ROLE_IDS.length)
  })
})

describe("rolesForTab", () => {
  it("'wolves' returns the 5 wolf-team roles", () => {
    const wolves = rolesForTab("wolves")
    expect(wolves).toHaveLength(5)
    for (const r of wolves) expect(r.team).toBe("werewolf")
  })

  it("'neutral' returns the 4 neutral-team roles", () => {
    const neutrals = rolesForTab("neutral")
    expect(neutrals).toHaveLength(4)
    for (const r of neutrals) expect(r.team).toBe("neutral")
  })

  it("accepts a custom roles array", () => {
    const subset: Role[] = [ROLES.werewolf, ROLES.seer]
    expect(rolesForTab("wolves", subset)).toEqual([ROLES.werewolf])
    expect(rolesForTab("info", subset)).toEqual([ROLES.seer])
    expect(rolesForTab("power", subset)).toEqual([])
  })
})
