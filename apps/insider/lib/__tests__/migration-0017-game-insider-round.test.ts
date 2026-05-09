import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"

// Integration test (T-2.B). Requires `bunx supabase start` running locally.
// Verifies migration 0017 creates `game_insider_round` with column-level
// SELECT GRANT that excludes `secret_value` from the anon role (per A1.C).
//
// Asymmetric secret protection — anon clients (the only role available to
// in-room players) MUST NOT be able to read `secret_value`, even though they
// can subscribe to phase/timer/eligible_voter_ids changes. Master + Insider
// roles will fetch the secret via SECURITY DEFINER `get_my_insider_secret`
// (added in US-5a.5) which bypasses column-level grants.

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321"
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"

const LOCAL_SERVICE_ROLE_FALLBACK =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  "eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0." +
  "EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? LOCAL_SERVICE_ROLE_FALLBACK

const TEST_ROOM_CODE = "INS017"
const TEST_SECRET = "TEST_SECRET_DO_NOT_LEAK"
// `football-premier-league` is seeded by migration 0013_content_packs.sql.
// We reuse it for FK satisfaction; the handler choice doesn't matter — we
// never call get_random_pack_item in this test, just need a valid slug.
const TEST_PACK_SLUG = "football-premier-league"

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

let testRoomId: string

async function cleanup() {
  // FK on delete cascade removes game_insider_round rows when room is deleted.
  await admin.from("rooms").delete().eq("code", TEST_ROOM_CODE)
}

beforeAll(async () => {
  await cleanup()
  const { data: room, error } = await admin
    .from("rooms")
    .insert({
      code: TEST_ROOM_CODE,
      max_rounds: 5,
      score_positions: 4,
      category: "premier-league",
      game_type: "insider",
    })
    .select("id")
    .single()
  if (error) throw error
  testRoomId = room.id
})

afterAll(async () => {
  await cleanup()
})

describe("game_insider_round (migration 0017) — column-level secret RLS (A1.C)", () => {
  it("admin inserts a round row with secret_value", async () => {
    const { error } = await admin.from("game_insider_round").insert({
      room_id: testRoomId,
      round_number: 1,
      pack_slug: TEST_PACK_SLUG,
      secret_value: TEST_SECRET,
      time_limit_s: 300,
      phase: "preparing",
    })
    expect(error).toBeNull()
  })

  it("anon SELECT * fails because secret_value column is denied", async () => {
    // `select('*')` translates to a query that includes secret_value, which
    // anon has no GRANT for. Postgres should refuse with permission denied.
    const { data, error } = await anon
      .from("game_insider_round")
      .select("*")
      .eq("room_id", testRoomId)

    expect(error).not.toBeNull()
    expect(data).toBeNull()
    // Postgres permission-denied SQLSTATE = 42501.
    expect(error?.code).toBe("42501")
  })

  it("anon SELECT of non-secret columns succeeds and never returns secret_value", async () => {
    const { data, error } = await anon
      .from("game_insider_round")
      .select(
        "room_id, round_number, pack_slug, time_limit_s, started_at, vote_deadline, guessed_at, guessed_by_player_id, eligible_voter_ids, phase",
      )
      .eq("room_id", testRoomId)
      .single()

    expect(error).toBeNull()
    expect(data).toMatchObject({
      room_id: testRoomId,
      round_number: 1,
      pack_slug: TEST_PACK_SLUG,
      time_limit_s: 300,
      phase: "preparing",
    })
    // No secret_value key on the returned row — it was not selected.
    expect(data).not.toHaveProperty("secret_value")
  })

  it("anon explicit SELECT of secret_value fails with permission denied", async () => {
    const { data, error } = await anon
      .from("game_insider_round")
      .select("secret_value")
      .eq("room_id", testRoomId)

    expect(error).not.toBeNull()
    expect(data).toBeNull()
    expect(error?.code).toBe("42501")
  })

  it("phase check constraint rejects invalid phase values", async () => {
    const { error } = await admin.from("game_insider_round").insert({
      room_id: testRoomId,
      round_number: 99,
      pack_slug: TEST_PACK_SLUG,
      secret_value: "x",
      time_limit_s: 60,
      phase: "bogus_phase",
    })
    expect(error).not.toBeNull()
    // 23514 = check_violation
    expect(error?.code).toBe("23514")
  })

  it("eligible_voter_ids accepts a uuid[] (T-4 snapshot)", async () => {
    const voterIds = [crypto.randomUUID(), crypto.randomUUID()]
    const { error: insertErr } = await admin.from("game_insider_round").insert({
      room_id: testRoomId,
      round_number: 2,
      pack_slug: TEST_PACK_SLUG,
      secret_value: "another",
      time_limit_s: 300,
      phase: "voting",
      eligible_voter_ids: voterIds,
    })
    expect(insertErr).toBeNull()

    const { data, error } = await anon
      .from("game_insider_round")
      .select("round_number, eligible_voter_ids, phase")
      .eq("room_id", testRoomId)
      .eq("round_number", 2)
      .single()
    expect(error).toBeNull()
    expect(data?.eligible_voter_ids).toEqual(voterIds)
    expect(data?.phase).toBe("voting")
  })
})

// Realtime publication membership is verified by
// scripts/check-realtime-publication.sh (runs in `bun run lint`). pg_catalog
// isn't reachable through PostgREST, so re-asserting it here would be noise.
