import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"

// Integration test (T-2.B / US-042). Requires `bunx supabase start` running locally.
//
// Verifies migration 0021 creates the `get_my_insider_secret(p_room_id, p_round,
// p_player_id)` SECURITY DEFINER RPC. Per A1.C the secret is column-protected on
// `game_insider_round` (anon cannot SELECT `secret_value` directly), so Master
// and Insider fetch it through this function. The function joins
// `game_insider_roles` and only returns the secret if the caller's player_id is
// assigned role 'master' or 'insider' for that round; commons (and anyone else)
// receive NULL.

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

const TEST_ROOM_CODE = "INS021"
const PACK_SLUG = "football-premier-league"
const TEST_SECRET = "TEST_SECRET_INSIDER_021"

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

let testRoomId: string
const masterId = crypto.randomUUID()
const insiderId = crypto.randomUUID()
const commonId = crypto.randomUUID()
const strangerId = crypto.randomUUID()

async function cleanup() {
  await admin.from("rooms").delete().eq("code", TEST_ROOM_CODE)
}

beforeAll(async () => {
  await cleanup()
  const { data: room, error: roomErr } = await admin
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
  if (roomErr) throw roomErr
  testRoomId = room.id

  const { error: roundErr } = await admin.from("game_insider_round").insert({
    room_id: testRoomId,
    round_number: 1,
    pack_slug: PACK_SLUG,
    secret_value: TEST_SECRET,
    time_limit_s: 300,
    phase: "asking",
  })
  if (roundErr) throw roundErr

  const { error: rolesErr } = await admin.from("game_insider_roles").insert([
    { room_id: testRoomId, round_number: 1, player_id: masterId, role: "master" },
    { room_id: testRoomId, round_number: 1, player_id: insiderId, role: "insider" },
    { room_id: testRoomId, round_number: 1, player_id: commonId, role: "player" },
  ])
  if (rolesErr) throw rolesErr
})

afterAll(async () => {
  await cleanup()
})

async function callRpc(playerId: string, round = 1) {
  return anon.rpc("get_my_insider_secret", {
    p_room_id: testRoomId,
    p_round: round,
    p_player_id: playerId,
  })
}

describe("get_my_insider_secret (migration 0021) — A1.C", () => {
  it("returns the secret when caller is the master", async () => {
    const { data, error } = await callRpc(masterId)
    expect(error).toBeNull()
    expect(data).toBe(TEST_SECRET)
  })

  it("returns the secret when caller is the insider", async () => {
    const { data, error } = await callRpc(insiderId)
    expect(error).toBeNull()
    expect(data).toBe(TEST_SECRET)
  })

  it("returns NULL when caller is a common player", async () => {
    const { data, error } = await callRpc(commonId)
    expect(error).toBeNull()
    expect(data).toBeNull()
  })

  it("returns NULL when caller has no role assignment for the round", async () => {
    const { data, error } = await callRpc(strangerId)
    expect(error).toBeNull()
    expect(data).toBeNull()
  })

  it("returns NULL for a non-existent (room, round) tuple", async () => {
    const { data, error } = await callRpc(masterId, 999)
    expect(error).toBeNull()
    expect(data).toBeNull()
  })

  it("anon direct SELECT on secret_value column is still denied (defense-in-depth)", async () => {
    const { data, error } = await anon
      .from("game_insider_round")
      .select("secret_value")
      .eq("room_id", testRoomId)
      .eq("round_number", 1)

    expect(error).not.toBeNull()
    expect(data).toBeNull()
    expect(error?.code).toBe("42501")
  })
})
