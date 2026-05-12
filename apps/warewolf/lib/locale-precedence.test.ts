import { describe, expect, it } from "vitest"
import { resolveLocalePrecedence } from "./locale-precedence"

const ORIGIN = "https://example.test"

function urlOf(pathAndQuery: string): URL {
  return new URL(pathAndQuery, ORIGIN)
}

describe("resolveLocalePrecedence", () => {
  it("redirects /en/setup?lang=th → /th/setup (Eng Review decision #5)", () => {
    const decision = resolveLocalePrecedence(urlOf("/en/setup?lang=th"))
    expect(decision).toEqual({ kind: "redirect", target: "/th/setup" })
  })

  it("passes /en/setup?lang=en through (segment matches; param ignored)", () => {
    const decision = resolveLocalePrecedence(urlOf("/en/setup?lang=en"))
    expect(decision).toEqual({ kind: "passthrough" })
  })

  it("redirects /th/customize?lang=en → /en/customize", () => {
    const decision = resolveLocalePrecedence(urlOf("/th/customize?lang=en"))
    expect(decision).toEqual({ kind: "redirect", target: "/en/customize" })
  })

  it("preserves other query params when redirecting", () => {
    const decision = resolveLocalePrecedence(
      urlOf("/en/customize?p=8&roles=villager,seer&lang=th"),
    )
    expect(decision.kind).toBe("redirect")
    if (decision.kind !== "redirect") return
    // lang stripped, other params preserved (order may vary by URLSearchParams)
    const parsed = new URL(decision.target, ORIGIN)
    expect(parsed.pathname).toBe("/th/customize")
    expect(parsed.searchParams.get("lang")).toBeNull()
    expect(parsed.searchParams.get("p")).toBe("8")
    expect(parsed.searchParams.get("roles")).toBe("villager,seer")
  })

  it("redirects nested path /en/rules/chapter-2?lang=th → /th/rules/chapter-2", () => {
    const decision = resolveLocalePrecedence(urlOf("/en/rules/chapter-2?lang=th"))
    expect(decision).toEqual({ kind: "redirect", target: "/th/rules/chapter-2" })
  })

  it("redirects bare /en?lang=th → /th", () => {
    const decision = resolveLocalePrecedence(urlOf("/en?lang=th"))
    expect(decision).toEqual({ kind: "redirect", target: "/th" })
  })

  it("passes /en/setup through when no lang param", () => {
    const decision = resolveLocalePrecedence(urlOf("/en/setup"))
    expect(decision).toEqual({ kind: "passthrough" })
  })

  it("passes /en/setup?lang=fr through (unknown locale treated as garbage)", () => {
    const decision = resolveLocalePrecedence(urlOf("/en/setup?lang=fr"))
    expect(decision).toEqual({ kind: "passthrough" })
  })

  it("passes /setup?lang=th through (no segment lang — next-intl handles it)", () => {
    const decision = resolveLocalePrecedence(urlOf("/setup?lang=th"))
    expect(decision).toEqual({ kind: "passthrough" })
  })

  it("passes root / through (no segment lang)", () => {
    const decision = resolveLocalePrecedence(urlOf("/"))
    expect(decision).toEqual({ kind: "passthrough" })
  })
})
