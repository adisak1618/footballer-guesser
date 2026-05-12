// Single source of truth for the 6-tab partitioning of the V1 role catalog
// used by the customize-page Add Role sheet (US-017). Locked by Eng Review
// decision #6: derive from team + category, no new field on Role.
//
// Mapping table (precedence top-down — first match wins):
//
//   tab       | rule
//   ----------|----------------------------------------------------------------
//   wolves    | team === 'werewolf'
//   neutral   | team === 'neutral'
//   info      | category === 'info'                       (village info)
//   power     | category ∈ {'protection', 'kill', 'vote'} (village power)
//   social    | category === 'chaos'  OR  id ∈ VANILLA_SOCIAL_IDS
//   vanilla   | category === 'vanilla'  AND NOT in VANILLA_SOCIAL_IDS
//
// VANILLA_SOCIAL_IDS = {mason, spellcaster, old-hag} per design doc Premise #8:
// the village vanilla/social bucket is split so pure villager goes to the
// 'vanilla' tab while the three mechanically-social vanilla roles surface in
// 'social' alongside any 'chaos' roles a future expansion adds.
//
// The mapping IS the public contract for the Add Role sheet. Editing it
// changes which tab a role appears under. Update the JSDoc on
// mapCategoryToTab in lockstep.

import { ROLES, type Role, type RoleId } from "@social-hub/content"

export type TabKey =
  | "wolves"
  | "info"
  | "power"
  | "vanilla"
  | "social"
  | "neutral"

/** Display order for the Add Role sheet tab strip (matches prototype line 1361). */
export const TABS: readonly TabKey[] = Object.freeze([
  "wolves",
  "info",
  "power",
  "vanilla",
  "social",
  "neutral",
] as const)

/** Vanilla-team roles routed to the 'social' tab per design doc Premise #8. */
const VANILLA_SOCIAL_IDS: ReadonlySet<RoleId> = new Set<RoleId>([
  "mason",
  "spellcaster",
  "old-hag",
])

/**
 * Map a Role to the customize-page tab it surfaces under.
 *
 * Mapping (first match wins):
 *
 *   - `wolves`  ← `team === 'werewolf'`
 *   - `neutral` ← `team === 'neutral'`
 *   - `info`    ← `category === 'info'`
 *   - `power`   ← `category ∈ {'protection', 'kill', 'vote'}`
 *   - `social`  ← `category === 'chaos'` OR `id ∈ {'mason', 'spellcaster', 'old-hag'}`
 *   - `vanilla` ← `category === 'vanilla'` AND NOT in the social subset
 *
 * The 22 (enumerated 25) V1 roles partition cleanly across the 6 tabs — no
 * orphans, no duplicates. Enforced by `category-tabs.test.ts`.
 */
export function mapCategoryToTab(role: Role): TabKey {
  if (role.team === "werewolf") return "wolves"
  if (role.team === "neutral") return "neutral"

  if (VANILLA_SOCIAL_IDS.has(role.id)) return "social"

  switch (role.category) {
    case "info":
      return "info"
    case "protection":
    case "kill":
    case "vote":
      return "power"
    case "chaos":
      return "social"
    case "vanilla":
      return "vanilla"
    case "neutral":
      // Should be unreachable — neutral category is paired with team='neutral'
      // (handled above). Fall through to vanilla as a safe default rather
      // than throw, since this is a pure data-mapping function.
      return "vanilla"
  }
}

/** Filter a roles list to those that surface under `tab`. Defaults to the full V1 catalog. */
export function rolesForTab(
  tab: TabKey,
  roles: Role[] = Object.values(ROLES),
): Role[] {
  return roles.filter((r) => mapCategoryToTab(r) === tab)
}
