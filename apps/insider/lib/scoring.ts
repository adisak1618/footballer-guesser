// Issue #17 — pure scoring matrix for the multi-round Insider game.
//
// The function is the canonical contract between the server-side scoring in
// supabase/migrations/0028 + 0035 and the client-side per-round delta badges
// rendered on the reveal/scoreboard screen. Keeping it pure (no IO, no
// React) lets Vitest cover all 9 outcome × role combinations without
// spinning up Postgres, and lets the UI compute the same +pts label the
// server applied to players.total_score.
//
// Numbers are the rubric matrix:
//
//   Outcome           MASTER  COMMON  INSIDER
//   WORD_NOT_GUESSED      0       0        0
//   INSIDER_CAUGHT       +2      +2        0
//   INSIDER_ESCAPED       0       0       +3
//
// COMMON corresponds to the `'player'` role string used in the
// game_insider_roles table.

export type RoundOutcome =
  | "WORD_NOT_GUESSED"
  | "INSIDER_CAUGHT"
  | "INSIDER_ESCAPED"

export type ScoringRole = "MASTER" | "COMMON" | "INSIDER"

export function scoreRound(outcome: RoundOutcome, role: ScoringRole): number {
  if (outcome === "WORD_NOT_GUESSED") return 0
  if (outcome === "INSIDER_CAUGHT") {
    return role === "MASTER" || role === "COMMON" ? 2 : 0
  }
  if (outcome === "INSIDER_ESCAPED") {
    return role === "INSIDER" ? 3 : 0
  }
  return 0
}

const DB_ROLE_TO_SCORING: Record<string, ScoringRole> = {
  master: "MASTER",
  player: "COMMON",
  insider: "INSIDER",
}

export function dbRoleToScoringRole(role: string): ScoringRole | null {
  return DB_ROLE_TO_SCORING[role] ?? null
}
