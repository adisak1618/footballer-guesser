import { describe, expect, it } from "vitest"
import { findPrefixMatches, PLAYER_NAMES } from "@/lib/player-names"

describe("findPrefixMatches", () => {
  it("returns prefix-matched names (case-insensitive)", () => {
    const matches = findPrefixMatches("ger", 3)
    expect(matches).toContain("Steven Gerrard")
  })

  it("returns [] for empty input", () => {
    expect(findPrefixMatches("", 3)).toEqual([])
    expect(findPrefixMatches("   ", 3)).toEqual([])
  })

  it("caps results at max", () => {
    const matches = findPrefixMatches("a", 3)
    expect(matches.length).toBeLessThanOrEqual(3)
  })

  it("matches case-insensitively", () => {
    const lower = findPrefixMatches("steven g", 3)
    const upper = findPrefixMatches("STEVEN G", 3)
    const mixed = findPrefixMatches("SteVen G", 3)
    expect(lower).toEqual(upper)
    expect(lower).toEqual(mixed)
    expect(lower).toContain("Steven Gerrard")
  })

  it("returns [] when no prefix matches", () => {
    expect(findPrefixMatches("zzzzz_no_match", 3)).toEqual([])
  })

  it("default max is 3", () => {
    const matches = findPrefixMatches("a")
    expect(matches.length).toBeLessThanOrEqual(3)
  })

  it("returns [] for non-positive max", () => {
    expect(findPrefixMatches("ger", 0)).toEqual([])
    expect(findPrefixMatches("ger", -1)).toEqual([])
  })

  it("PLAYER_NAMES bundles all 100 names", () => {
    expect(PLAYER_NAMES.length).toBe(100)
  })
})
