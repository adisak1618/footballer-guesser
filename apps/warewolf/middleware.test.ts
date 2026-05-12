// Acceptance-criteria test for US-011 (Eng Review decision #5).
// Asserts the middleware emits a 301 for `?lang=` mismatches against the
// canonical `/[lang]/` segment, and passes matching requests through to
// next-intl. Driven through the real `middleware.ts` (we mock the next-intl
// delegate so the suite runs in Node without booting a Next server).

import { describe, expect, it, vi } from "vitest"
import { NextRequest, NextResponse } from "next/server"

// Stub next-intl's middleware: any request that survives the locale-precedence
// pre-check should reach this stub. We capture the call so we can assert
// "passthrough" cases reached it.
const intlSpy = vi.fn(() => NextResponse.next())
vi.mock("next-intl/middleware", () => ({
  default: () => intlSpy,
}))

const ORIGIN = "https://example.test"

function buildRequest(pathAndQuery: string): NextRequest {
  return new NextRequest(new URL(pathAndQuery, ORIGIN))
}

describe("middleware (locale precedence — Eng Review decision #5)", () => {
  it("301-redirects /en/setup?lang=th to /th/setup", async () => {
    intlSpy.mockClear()
    const { default: middleware } = await import("./middleware")
    const res = middleware(buildRequest("/en/setup?lang=th"))
    expect(res.status).toBe(301)
    const location = res.headers.get("location")
    expect(location).not.toBeNull()
    const dest = new URL(location as string)
    expect(dest.pathname).toBe("/th/setup")
    expect(dest.searchParams.get("lang")).toBeNull()
    expect(intlSpy).not.toHaveBeenCalled()
  })

  it("passes /en/setup?lang=en through (segment matches; no 301)", async () => {
    intlSpy.mockClear()
    const { default: middleware } = await import("./middleware")
    const res = middleware(buildRequest("/en/setup?lang=en"))
    expect(res.status).toBe(200)
    expect(res.headers.get("location")).toBeNull()
    expect(intlSpy).toHaveBeenCalledTimes(1)
  })

  it("301-redirects /th/customize?lang=en?p=8 with other query params preserved", async () => {
    intlSpy.mockClear()
    const { default: middleware } = await import("./middleware")
    const res = middleware(buildRequest("/th/customize?p=8&roles=villager,seer&lang=en"))
    expect(res.status).toBe(301)
    const dest = new URL(res.headers.get("location") as string)
    expect(dest.pathname).toBe("/en/customize")
    expect(dest.searchParams.get("p")).toBe("8")
    expect(dest.searchParams.get("roles")).toBe("villager,seer")
    expect(dest.searchParams.get("lang")).toBeNull()
  })
})
