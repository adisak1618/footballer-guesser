/**
 * Pure-function validator — determines whether a setup is Playable.
 *
 * Returns blocker codes, balance, and per-team sums for the Playable banner
 * and balance scale to render.
 *
 * Strict line of defense per Eng Review decision #3: unknown role ids ARE
 * blockers here. The parser (`lib/share-url.ts`, US-007) is the sole place
 * that silently substitutes unknowns to `villager`, so in production the
 * `unknown-role` blocker is unreachable from URL state — but the validator
 * must still reject as a type-contract guarantee.
 *
 * Single-pass implementation per Eng Review code-quality fix (replaces the
 * prototype's three loops at `finalized.html:792–818`).
 *
 * Source: design doc lines 528–551.
 */

import { ROLES, type Role, type RoleId } from "@social-hub/content"

export type BlockerCode =
  | "no-wolves"
  | "wolves-gte-village"
  | "role-count-mismatch"
  | "unknown-role"

export interface ValidateResult {
  ok: boolean
  blockers: BlockerCode[]
  /** Sum of `role.balance` across all known roles (signed). 0 = perfectly balanced. */
  balance: number
  /** Sum of strictly-negative balances across known roles. */
  wolfSum: number
  /** Sum of strictly-positive balances across known roles. */
  villageSum: number
  wolfCount: number
  villageCount: number
  neutralCount: number
}

export function validate(
  setup: RoleId[],
  playerCount: number,
): ValidateResult {
  const blockers: BlockerCode[] = []
  let balance = 0
  let wolfSum = 0
  let villageSum = 0
  let wolfCount = 0
  let villageCount = 0
  let neutralCount = 0
  let hasUnknown = false

  for (const id of setup) {
    const role: Role | undefined = ROLES[id]
    if (!role) {
      hasUnknown = true
      continue
    }
    balance += role.balance
    if (role.balance < 0) wolfSum += role.balance
    else if (role.balance > 0) villageSum += role.balance
    switch (role.team) {
      case "werewolf":
        wolfCount++
        break
      case "village":
        villageCount++
        break
      case "neutral":
        neutralCount++
        break
    }
  }

  if (hasUnknown) blockers.push("unknown-role")
  if (wolfCount === 0) blockers.push("no-wolves")
  // Neutrals EXCLUDED from parity check per design doc Premise #3.
  if (wolfCount > 0 && wolfCount >= villageCount) {
    blockers.push("wolves-gte-village")
  }
  if (setup.length !== playerCount) blockers.push("role-count-mismatch")

  return {
    ok: blockers.length === 0,
    blockers,
    balance,
    wolfSum,
    villageSum,
    wolfCount,
    villageCount,
    neutralCount,
  }
}
