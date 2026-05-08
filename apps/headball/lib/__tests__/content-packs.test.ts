import { describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"

// Integration test (T-2.B). Requires `bunx supabase start` running locally.
// Verifies the content_packs registry seeded by migration 0013 includes a row
// for the existing 'premier-league' Headball category, mapped through the
// 'football_category' handler so future games (Insider, etc.) can resolve
// any pack via get_random_pack_item(slug) without knowing the schema.

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321"
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"

describe("content_packs registry (migration 0013)", () => {
  it("has a row for slug 'football-premier-league' with handler='football_category' and source_ref='premier-league'", async () => {
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data, error } = await sb
      .from("content_packs")
      .select("slug, handler, source_ref")
      .eq("slug", "football-premier-league")
      .single()

    expect(error).toBeNull()
    expect(data).toMatchObject({
      slug: "football-premier-league",
      handler: "football_category",
      source_ref: "premier-league",
    })
  })
})
