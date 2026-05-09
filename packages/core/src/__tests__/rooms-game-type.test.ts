import { describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"

// Integration test (per US-031 / T-2.B / Phase 4.1).
// Requires `bunx supabase start` running locally.
//
// Verifies migration 0016 adds `game_type` to `rooms` so the hub can dispatch
// a 6-char join code to the right game subdomain. Existing Headball rows must
// default to 'headball'; the column is constrained to ('headball','insider').

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321"
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"

describe("rooms.game_type column (migration 0016)", () => {
  it("rooms select returns a game_type column", async () => {
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data, error } = await sb
      .from("rooms")
      .select("code, game_type")
      .limit(1)

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
    if (data && data.length > 0) {
      const row = data[0] as { code: string; game_type: string }
      expect(row).toHaveProperty("game_type")
      expect(["headball", "insider"]).toContain(row.game_type)
    }
  })
})
