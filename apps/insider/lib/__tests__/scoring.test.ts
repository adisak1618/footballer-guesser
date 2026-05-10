// Issue #17 — covers all 9 outcome × role combinations of the matrix.
//
// The 3×3 grid is enumerated explicitly rather than via a parametric loop
// so a regression on any single cell shows up as a single named failure
// (e.g. `scoreRound > INSIDER_ESCAPED > INSIDER scores +3`) instead of a
// generic "case 7 of 9 failed" that would force a reader to count rows.

import { describe, expect, it } from "vitest"
import {
  dbRoleToScoringRole,
  scoreRound,
  type RoundOutcome,
  type ScoringRole,
} from "../scoring"

describe("scoreRound", () => {
  describe("WORD_NOT_GUESSED", () => {
    const outcome: RoundOutcome = "WORD_NOT_GUESSED"
    it("MASTER scores 0", () => {
      expect(scoreRound(outcome, "MASTER")).toBe(0)
    })
    it("COMMON scores 0", () => {
      expect(scoreRound(outcome, "COMMON")).toBe(0)
    })
    it("INSIDER scores 0", () => {
      expect(scoreRound(outcome, "INSIDER")).toBe(0)
    })
  })

  describe("INSIDER_CAUGHT", () => {
    const outcome: RoundOutcome = "INSIDER_CAUGHT"
    it("MASTER scores +2", () => {
      expect(scoreRound(outcome, "MASTER")).toBe(2)
    })
    it("COMMON scores +2", () => {
      expect(scoreRound(outcome, "COMMON")).toBe(2)
    })
    it("INSIDER scores 0", () => {
      expect(scoreRound(outcome, "INSIDER")).toBe(0)
    })
  })

  describe("INSIDER_ESCAPED", () => {
    const outcome: RoundOutcome = "INSIDER_ESCAPED"
    it("MASTER scores 0", () => {
      expect(scoreRound(outcome, "MASTER")).toBe(0)
    })
    it("COMMON scores 0", () => {
      expect(scoreRound(outcome, "COMMON")).toBe(0)
    })
    it("INSIDER scores +3", () => {
      expect(scoreRound(outcome, "INSIDER")).toBe(3)
    })
  })

  it("matches the published matrix exactly", () => {
    const matrix: Record<RoundOutcome, Record<ScoringRole, number>> = {
      WORD_NOT_GUESSED: { MASTER: 0, COMMON: 0, INSIDER: 0 },
      INSIDER_CAUGHT: { MASTER: 2, COMMON: 2, INSIDER: 0 },
      INSIDER_ESCAPED: { MASTER: 0, COMMON: 0, INSIDER: 3 },
    }
    for (const outcome of Object.keys(matrix) as RoundOutcome[]) {
      for (const role of Object.keys(matrix[outcome]) as ScoringRole[]) {
        expect(scoreRound(outcome, role)).toBe(matrix[outcome][role])
      }
    }
  })
})

describe("dbRoleToScoringRole", () => {
  it("maps DB role strings to ScoringRole", () => {
    expect(dbRoleToScoringRole("master")).toBe("MASTER")
    expect(dbRoleToScoringRole("player")).toBe("COMMON")
    expect(dbRoleToScoringRole("insider")).toBe("INSIDER")
  })

  it("returns null for unknown role strings", () => {
    expect(dbRoleToScoringRole("spectator")).toBeNull()
    expect(dbRoleToScoringRole("")).toBeNull()
  })
})
