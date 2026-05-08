import { describe, expect, it } from "vitest"
import { calculateGuessScore } from "@/lib/scoring"

describe("calculateGuessScore", () => {
  it("returns N for position 1 when score_positions = N", () => {
    expect(calculateGuessScore(1, 3)).toBe(3)
    expect(calculateGuessScore(1, 5)).toBe(5)
    expect(calculateGuessScore(1, 1)).toBe(1)
  })

  it("returns 1 for position N when score_positions = N", () => {
    expect(calculateGuessScore(3, 3)).toBe(1)
    expect(calculateGuessScore(5, 5)).toBe(1)
  })

  it("returns 0 for position N+1 when score_positions = N", () => {
    expect(calculateGuessScore(4, 3)).toBe(0)
    expect(calculateGuessScore(6, 5)).toBe(0)
  })

  it("descends linearly across positions 1..N", () => {
    const scorePositions = 3
    expect(calculateGuessScore(1, scorePositions)).toBe(3)
    expect(calculateGuessScore(2, scorePositions)).toBe(2)
    expect(calculateGuessScore(3, scorePositions)).toBe(1)
    expect(calculateGuessScore(4, scorePositions)).toBe(0)
  })

  it("rejects invalid inputs by returning 0", () => {
    expect(calculateGuessScore(0, 3)).toBe(0)
    expect(calculateGuessScore(-1, 3)).toBe(0)
    expect(calculateGuessScore(1, 0)).toBe(0)
    expect(calculateGuessScore(1.5, 3)).toBe(0)
    expect(calculateGuessScore(1, 3.5)).toBe(0)
  })
})
