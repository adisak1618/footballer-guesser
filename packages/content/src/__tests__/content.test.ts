import { describe, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { GameRpcError } from "@social-hub/core"
import { getRandomPackItem, listEnabledPacks } from "../index"

function makeRpcMock(rpcImpl: (name: string, args: unknown) => unknown) {
  return { rpc: vi.fn(rpcImpl) } as unknown as SupabaseClient
}

function makeFromMock(result: { data: unknown; error: unknown }) {
  const order = vi.fn().mockResolvedValue(result)
  const eq = vi.fn().mockReturnValue({ order })
  const select = vi.fn().mockReturnValue({ eq })
  const from = vi.fn().mockReturnValue({ select })
  return {
    client: { from } as unknown as SupabaseClient,
    spies: { from, select, eq, order },
  }
}

describe("getRandomPackItem", () => {
  it("calls dispatch with rpc 'get_random_pack_item' and returns the mapped item", async () => {
    const row = {
      item_id: "player-42",
      display_value: "Mohamed Salah",
      metadata: { nationalities: ["EG"], position: "FW" },
    }
    const supabase = makeRpcMock(() =>
      Promise.resolve({ data: [row], error: null }),
    )

    const result = await getRandomPackItem(supabase, "football-premier-league")

    expect(supabase.rpc).toHaveBeenCalledWith("get_random_pack_item", {
      p_slug: "football-premier-league",
    })
    expect(result).toEqual({
      itemId: "player-42",
      displayValue: "Mohamed Salah",
      metadata: { nationalities: ["EG"], position: "FW" },
    })
  })

  it("normalizes missing metadata to an empty object", async () => {
    const row = {
      item_id: "ผัดไทย",
      display_value: "ผัดไทย",
      metadata: null,
    }
    const supabase = makeRpcMock(() =>
      Promise.resolve({ data: [row], error: null }),
    )

    const result = await getRandomPackItem(supabase, "insider-thai-food")

    expect(result.metadata).toEqual({})
  })

  it("throws GameRpcError with code 'PG001' when the pack is unknown", async () => {
    const error = { code: "PG001", message: "PGAME01: pack not found: bogus" }
    const supabase = makeRpcMock(() =>
      Promise.resolve({ data: null, error }),
    )

    let caught: unknown = null
    try {
      await getRandomPackItem(supabase, "bogus")
    } catch (err) {
      caught = err
    }

    expect(caught).toBeInstanceOf(GameRpcError)
    const e = caught as GameRpcError
    expect(e.code).toBe("PG001")
    expect(e.message).toContain("pack not found")
    expect(e.context).toEqual({
      rpc: "get_random_pack_item",
      args: { p_slug: "bogus" },
    })
  })
})

describe("listEnabledPacks", () => {
  it("returns the enabled packs ordered by display name", async () => {
    const rows = [
      {
        slug: "football-premier-league",
        display_name: "Premier League",
        display_name_th: "พรีเมียร์ลีก",
        handler: "football_category",
      },
      {
        slug: "insider-thai-food",
        display_name: "Thai Food",
        display_name_th: "อาหารไทย",
        handler: "word_list",
      },
    ]
    const { client, spies } = makeFromMock({ data: rows, error: null })

    const result = await listEnabledPacks(client)

    expect(spies.from).toHaveBeenCalledWith("content_packs")
    expect(spies.select).toHaveBeenCalledWith(
      "slug, display_name, display_name_th, handler",
    )
    expect(spies.eq).toHaveBeenCalledWith("enabled", true)
    expect(result).toEqual([
      {
        slug: "football-premier-league",
        displayName: "Premier League",
        displayNameTh: "พรีเมียร์ลีก",
        handler: "football_category",
      },
      {
        slug: "insider-thai-food",
        displayName: "Thai Food",
        displayNameTh: "อาหารไทย",
        handler: "word_list",
      },
    ])
  })

  it("omits displayNameTh when null", async () => {
    const rows = [
      {
        slug: "x",
        display_name: "X",
        display_name_th: null,
        handler: "word_list",
      },
    ]
    const { client } = makeFromMock({ data: rows, error: null })

    const result = await listEnabledPacks(client)

    expect(result[0]).toEqual({
      slug: "x",
      displayName: "X",
      handler: "word_list",
    })
    expect(result[0]).not.toHaveProperty("displayNameTh")
  })

  it("returns an empty array when no rows match", async () => {
    const { client } = makeFromMock({ data: null, error: null })
    const result = await listEnabledPacks(client)
    expect(result).toEqual([])
  })

  it("throws GameRpcError on supabase error, mirroring dispatch's error shape", async () => {
    const error = { code: "42P01", message: "relation does not exist" }
    const { client } = makeFromMock({ data: null, error })

    let caught: unknown = null
    try {
      await listEnabledPacks(client)
    } catch (err) {
      caught = err
    }

    expect(caught).toBeInstanceOf(GameRpcError)
    const e = caught as GameRpcError
    expect(e.code).toBe("42P01")
    expect(e.message).toContain("relation does not exist")
    expect(e.context).toEqual({
      rpc: "content_packs.select",
      args: { enabled: true },
    })
  })
})
