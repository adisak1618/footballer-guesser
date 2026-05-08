import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"

// Integration test (T-2.B). Requires `bunx supabase start` running locally.
// Verifies migration 0015 creates `get_random_pack_item(slug)` RPC that
// dispatches based on content_packs.handler:
//   - football_category → category_players ⨝ football_players
//   - word_list         → word_pack_items
//   - unknown slug      → raises SQLSTATE 'PG001' (the 5-char SQLSTATE that
//                         maps to symbolic PGAME01 — PostgreSQL rejects 7-char
//                         errcodes per packages/core/error-codes.md). The
//                         symbolic name 'PGAME01' is also embedded in the
//                         message for human readability.

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321"
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"

// Stable demo service-role JWT for `supabase start` local stacks.
// NOT a secret — local-only, identical across every developer machine.
const LOCAL_SERVICE_ROLE_FALLBACK =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  "eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0." +
  "EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? LOCAL_SERVICE_ROLE_FALLBACK

const TEST_WORD_PACK_SLUG = "insider-thai-food"
const TEST_CONTENT_PACK_SLUG = "insider-thai-food"

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const THAI_FOODS = [
  "ผัดไทย",
  "ส้มตำ",
  "ต้มยำกุ้ง",
  "แกงเขียวหวาน",
  "ข้าวเหนียวมะม่วง",
  "ผัดกะเพรา",
]

beforeAll(async () => {
  // Self-contained fixture for the word_list handler path. We seed an
  // 'insider-thai-food' word_pack + items + content_packs row so this test
  // doesn't depend on US-3.4 (Insider seed script).
  await admin.from("content_packs").delete().eq("slug", TEST_CONTENT_PACK_SLUG)
  await admin.from("word_packs").delete().eq("slug", TEST_WORD_PACK_SLUG)

  const { error: wpErr } = await admin.from("word_packs").insert({
    slug: TEST_WORD_PACK_SLUG,
    display_name: "Thai food",
    display_name_th: "อาหารไทย",
  })
  expect(wpErr).toBeNull()

  const { error: itemsErr } = await admin.from("word_pack_items").insert(
    THAI_FOODS.map((value) => ({
      pack_slug: TEST_WORD_PACK_SLUG,
      value,
      metadata: {},
    })),
  )
  expect(itemsErr).toBeNull()

  const { error: cpErr } = await admin.from("content_packs").insert({
    slug: TEST_CONTENT_PACK_SLUG,
    display_name: "Thai food",
    display_name_th: "อาหารไทย",
    handler: "word_list",
    source_ref: TEST_WORD_PACK_SLUG,
  })
  expect(cpErr).toBeNull()
})

afterAll(async () => {
  await admin.from("content_packs").delete().eq("slug", TEST_CONTENT_PACK_SLUG)
  await admin.from("word_packs").delete().eq("slug", TEST_WORD_PACK_SLUG)
})

describe("get_random_pack_item RPC (migration 0015)", () => {
  it("football_category handler → returns a row whose display_value matches a football_players name", async () => {
    const { data, error } = await anon.rpc("get_random_pack_item", {
      p_slug: "football-premier-league",
    })
    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
    expect(data).toHaveLength(1)

    const row = (data as Array<{
      item_id: string
      display_value: string
      metadata: Record<string, unknown>
    }>)[0]

    expect(typeof row.item_id).toBe("string")
    expect(typeof row.display_value).toBe("string")
    expect(row.display_value.length).toBeGreaterThan(0)

    // The display_value must match a real football_players.name.
    const { data: matched, error: matchedErr } = await anon
      .from("football_players")
      .select("id, name")
      .eq("name", row.display_value)
      .limit(1)
    expect(matchedErr).toBeNull()
    expect(matched?.length).toBe(1)
  })

  it("football_category handler → repeated calls return different values (random)", async () => {
    const seen = new Set<string>()
    for (let i = 0; i < 12; i += 1) {
      const { data, error } = await anon.rpc("get_random_pack_item", {
        p_slug: "football-premier-league",
      })
      expect(error).toBeNull()
      const row = (data as Array<{ display_value: string }>)[0]
      seen.add(row.display_value)
    }
    // With 12 draws from a pool of dozens of players, randomness should
    // produce at least 2 distinct values. If everyone is identical the
    // function isn't actually randomizing.
    expect(seen.size).toBeGreaterThanOrEqual(2)
  })

  it("word_list handler → returns a value from the seeded word_pack_items", async () => {
    const { data, error } = await anon.rpc("get_random_pack_item", {
      p_slug: TEST_CONTENT_PACK_SLUG,
    })
    expect(error).toBeNull()
    const row = (data as Array<{
      item_id: string
      display_value: string
      metadata: Record<string, unknown>
    }>)[0]
    expect(THAI_FOODS).toContain(row.display_value)
    // For word_list, item_id and display_value are both the value.
    expect(row.item_id).toBe(row.display_value)
  })

  it("unknown slug → raises Postgres error with SQLSTATE 'PG001' (PGAME01 symbolic)", async () => {
    const { data, error } = await anon.rpc("get_random_pack_item", {
      p_slug: "this-pack-does-not-exist-zzz",
    })
    expect(data).toBeNull()
    expect(error).not.toBeNull()
    // SQLSTATE 'PG001' is the 5-char Postgres-conformant code that maps to
    // symbolic PGAME01 (cross-game "pack not found"). The symbolic name
    // 'PGAME01' is also embedded in the error message for human readability.
    expect(error?.code).toBe("PG001")
    expect(error?.message).toContain("PGAME01")
  })
})
