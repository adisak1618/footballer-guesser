import { describe, expect, it } from "vitest"
import { ROLE_IDS, type RoleId } from "@social-hub/content"

import { ShareUrlSchema, decodeSetup, encodeSetup } from "./share-url"

describe("ShareUrlSchema", () => {
  it("coerces p, splits roles csv, defaults lang", () => {
    const parsed = ShareUrlSchema.parse({
      p: "8",
      roles: "werewolf,seer,villager",
    })
    expect(parsed.p).toBe(8)
    expect(parsed.roles).toEqual(["werewolf", "seer", "villager"])
    expect(parsed.lang).toBe("en")
  })

  it("falls back to 8 when p out of range (catch)", () => {
    expect(ShareUrlSchema.parse({ p: "25", roles: "villager" }).p).toBe(8)
    expect(ShareUrlSchema.parse({ p: "3", roles: "villager" }).p).toBe(8)
    expect(ShareUrlSchema.parse({ p: "foo", roles: "villager" }).p).toBe(8)
  })

  it("substitutes unknown role ids with villager", () => {
    expect(ShareUrlSchema.parse({ p: "8", roles: "foo,bar" }).roles).toEqual([
      "villager",
      "villager",
    ])
  })
})

describe("encodeSetup / decodeSetup round-trip", () => {
  it("round-trips a valid setup", () => {
    const input = {
      playerCount: 10,
      roles: ["werewolf", "wolf-cub", "seer", "villager"] as RoleId[],
      lang: "th" as const,
    }
    const params = encodeSetup(input)
    const decoded = decodeSetup(params)
    expect(decoded.playerCount).toBe(input.playerCount)
    expect(decoded.roles).toEqual(input.roles)
    expect(decoded.lang).toBe(input.lang)
    expect(decoded.clampedP).toBe(false)
    expect(decoded.substitutedIds).toEqual([])
  })

  it("round-trips through a string", () => {
    const input = {
      playerCount: 7,
      roles: ["werewolf", "seer", "villager"] as RoleId[],
      lang: "en" as const,
    }
    const decoded = decodeSetup(encodeSetup(input).toString())
    expect(decoded.playerCount).toBe(input.playerCount)
    expect(decoded.roles).toEqual(input.roles)
    expect(decoded.lang).toBe(input.lang)
  })
})

describe("decodeSetup — clampedP", () => {
  it("sets clampedP=true when p is above max", () => {
    const r = decodeSetup("p=25&roles=villager")
    expect(r.playerCount).toBe(8)
    expect(r.clampedP).toBe(true)
  })

  it("sets clampedP=true when p is below min", () => {
    const r = decodeSetup("p=3&roles=villager")
    expect(r.playerCount).toBe(8)
    expect(r.clampedP).toBe(true)
  })

  it("sets clampedP=true when p is non-integer", () => {
    const r = decodeSetup("p=foo&roles=villager")
    expect(r.playerCount).toBe(8)
    expect(r.clampedP).toBe(true)
  })

  it("sets clampedP=false when p is in range", () => {
    const r = decodeSetup("p=12&roles=villager")
    expect(r.playerCount).toBe(12)
    expect(r.clampedP).toBe(false)
  })

  it("sets clampedP=false when p is missing (default applies)", () => {
    const r = decodeSetup("roles=villager")
    expect(r.playerCount).toBe(8)
    expect(r.clampedP).toBe(false)
  })
})

describe("decodeSetup — substitutedIds", () => {
  it("returns substitutedIds for unknown role ids", () => {
    const r = decodeSetup("p=8&roles=foo,bar")
    expect(r.roles).toEqual(["villager", "villager"])
    expect(r.substitutedIds).toEqual(["foo", "bar"])
  })

  it("does not substitute valid ids", () => {
    const r = decodeSetup("p=8&roles=werewolf,seer,villager")
    expect(r.roles).toEqual(["werewolf", "seer", "villager"])
    expect(r.substitutedIds).toEqual([])
  })

  it("substitutes mixed valid + invalid", () => {
    const r = decodeSetup("p=8&roles=werewolf,bogus,seer,nope")
    expect(r.roles).toEqual(["werewolf", "villager", "seer", "villager"])
    expect(r.substitutedIds).toEqual(["bogus", "nope"])
  })
})

describe("decodeSetup — defaults", () => {
  it("defaults missing p to 8", () => {
    const r = decodeSetup("")
    expect(r.playerCount).toBe(8)
  })

  it("defaults missing roles to ['villager']", () => {
    const r = decodeSetup("p=10")
    expect(r.roles).toEqual(["villager"])
  })

  it("defaults missing lang to 'en'", () => {
    const r = decodeSetup("p=10&roles=villager")
    expect(r.lang).toBe("en")
  })

  it("defaults invalid lang to 'en'", () => {
    const r = decodeSetup("p=10&roles=villager&lang=fr")
    expect(r.lang).toBe("en")
  })
})

describe("decodeSetup — URL length budget", () => {
  it("stays well under 2048 chars at 20 players with longest role ids", () => {
    // Use the longest-named role id 20 times — worst case
    const longest = ROLE_IDS.reduce((acc, id) =>
      id.length > acc.length ? id : acc,
    )
    const params = encodeSetup({
      playerCount: 20,
      roles: Array.from({ length: 20 }, () => longest) as RoleId[],
      lang: "en",
    })
    expect(params.toString().length).toBeLessThan(2048)
  })
})
