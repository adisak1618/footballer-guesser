// Per-archetype wolf allow-list + wolf-composition constraints.
// Consumed by `lib/solver.ts` (US-005) so DFS searches only valid wolf mixes
// per archetype identity. No UI depends on these directly.
//
// Sources: prototype `finalized.html:672–690`; design doc lines 376–385.
//
// `ArchetypeId` is defined here as a local literal-union so this module is
// self-contained for Lane A. US-003 (`apps/warewolf/lib/archetypes.ts`) will
// be the canonical owner of the archetype data and may re-export this type.

import type { RoleId } from "@social-hub/content"

export type ArchetypeId =
  | "classic-detective"
  | "wolf-chaos"
  | "info-heavy"
  | "beginner"
  | "power-roles"
  | "social-bluff"
  | "neutral-mayhem"
  | "balanced-power"

export const WOLF_POOLS: Record<ArchetypeId, RoleId[]> = {
  "classic-detective": ["werewolf", "wolf-cub", "sorceress", "alpha-wolf"],
  "wolf-chaos": ["wolf-cub", "werewolf", "minion", "sorceress", "alpha-wolf"],
  "info-heavy": ["werewolf", "wolf-cub", "sorceress"],
  // pure mode + 1 cub option for low counts
  beginner: ["werewolf", "wolf-cub"],
  "power-roles": ["wolf-cub", "werewolf", "alpha-wolf", "sorceress"],
  // sorceress = "wandering wolf" with no Seer to hunt; weakest -3 helps balance with no-info village
  "social-bluff": ["werewolf", "wolf-cub", "minion", "sorceress"],
  "neutral-mayhem": ["werewolf", "wolf-cub", "sorceress"],
  "balanced-power": ["wolf-cub", "werewolf", "alpha-wolf", "sorceress"],
}

// Wolves whose appearance must be capped at one per setup.
// Alpha Wolf's convert mechanic, Minion's "knows the wolves" reveal, and the
// Sorceress's Seer-hunt are each unique once-per-game effects — duplicating
// them is either incoherent or a balance break.
export const SINGLETON_WOLVES: ReadonlySet<RoleId> = new Set<RoleId>([
  "alpha-wolf",
  "minion",
  "sorceress",
])

// Hard cap on wolf-cub copies. Two cubs is the absolute ceiling because the
// "kill 2 next night" trigger can fire at most twice per game; a third would
// rarely activate before the wolves win.
export const MAX_WOLF_CUB = 2

// Wolves whose mechanic requires at least one other wolf in the pack.
// - Wolf Cub: "if killed, wolves kill 2 next night" — needs surviving wolves
// - Alpha Wolf: "convert a wolf target" — implies multiple wolves
// - Minion: "knows who the wolves are" — needs wolves to know about
// Sorceress is excluded — she hunts the Seer alone and doesn't know the pack.
export const PACK_REQUIRED: ReadonlySet<RoleId> = new Set<RoleId>([
  "wolf-cub",
  "alpha-wolf",
  "minion",
])
