import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"

// Integration test (T-2.B). Requires `bunx supabase start` running locally.
// Verifies migration 0019 creates two tables:
//   - game_insider_responses: append-only feed of Master answers
//     (yes/no/unsure) per round. id bigserial PK; created_at default now().
//   - game_insider_votes: who voted whom per round. PK is the
//     (room_id, round_number, voter_player_id) triple — each voter casts
//     at most one ballot per round. voted_at default now().
//
// Both tables are PUBLIC to anon SELECT — the response feed renders for
// every client, and votes are visible at reveal time. No asymmetric secret
// lives in either table (the secret stays on game_insider_round per A1.C).

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

const TEST_ROOM_CODE = "INS019"

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

let testRoomId: string
const voter1 = crypto.randomUUID()
const voter2 = crypto.randomUUID()
const insiderPlayerId = crypto.randomUUID()

async function cleanup() {
  // FK on delete cascade removes rows from both child tables when the room is deleted.
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

describe("game_insider_responses (migration 0019)", () => {
  it("admin inserts response rows yes/no/unsure", async () => {
    const { error } = await admin.from("game_insider_responses").insert([
      { room_id: testRoomId, round_number: 1, response: "yes" },
      { room_id: testRoomId, round_number: 1, response: "no" },
      { room_id: testRoomId, round_number: 1, response: "unsure" },
    ])
    expect(error).toBeNull()
  })

  it("anon SELECT returns the response feed in insertion order", async () => {
    const { data, error } = await anon
      .from("game_insider_responses")
      .select("id, response")
      .eq("room_id", testRoomId)
      .eq("round_number", 1)
      .order("id", { ascending: true })

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.length).toBe(3)
    expect(data!.map((r) => r.response)).toEqual(["yes", "no", "unsure"])
    // bigserial id is monotonically increasing.
    expect(data![0].id).toBeLessThan(data![1].id)
    expect(data![1].id).toBeLessThan(data![2].id)
  })

  it("response check constraint rejects invalid values", async () => {
    const { error } = await admin.from("game_insider_responses").insert({
      room_id: testRoomId,
      round_number: 1,
      response: "maybe",
    })
    expect(error).not.toBeNull()
    // 23514 = check_violation
    expect(error?.code).toBe("23514")
  })

  it("created_at is populated by default now()", async () => {
    const { data, error } = await anon
      .from("game_insider_responses")
      .select("created_at")
      .eq("room_id", testRoomId)
      .eq("round_number", 1)
      .limit(1)
      .single()
    expect(error).toBeNull()
    expect(data?.created_at).toBeTruthy()
  })
})

describe("game_insider_votes (migration 0019)", () => {
  it("admin inserts vote rows for distinct voters", async () => {
    const { error } = await admin.from("game_insider_votes").insert([
      {
        room_id: testRoomId,
        round_number: 1,
        voter_player_id: voter1,
        voted_player_id: insiderPlayerId,
      },
      {
        room_id: testRoomId,
        round_number: 1,
        voter_player_id: voter2,
        voted_player_id: insiderPlayerId,
      },
    ])
    expect(error).toBeNull()
  })

  it("anon SELECT returns vote tallies for room+round", async () => {
    const { data, error } = await anon
      .from("game_insider_votes")
      .select("voter_player_id, voted_player_id")
      .eq("room_id", testRoomId)
      .eq("round_number", 1)

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.length).toBe(2)
    expect(
      data!.every((row) => row.voted_player_id === insiderPlayerId),
    ).toBe(true)
  })

  it("PK (room_id, round_number, voter_player_id) rejects duplicate vote in same round", async () => {
    const { error } = await admin.from("game_insider_votes").insert({
      room_id: testRoomId,
      round_number: 1,
      voter_player_id: voter1,
      voted_player_id: voter2,
    })
    expect(error).not.toBeNull()
    // 23505 = unique_violation (PK)
    expect(error?.code).toBe("23505")
  })

  it("same voter can vote in a different round", async () => {
    const { error } = await admin.from("game_insider_votes").insert({
      room_id: testRoomId,
      round_number: 2,
      voter_player_id: voter1,
      voted_player_id: insiderPlayerId,
    })
    expect(error).toBeNull()
  })

  it("voted_at is populated by default now()", async () => {
    const { data, error } = await anon
      .from("game_insider_votes")
      .select("voted_at")
      .eq("room_id", testRoomId)
      .eq("round_number", 1)
      .eq("voter_player_id", voter1)
      .single()
    expect(error).toBeNull()
    expect(data?.voted_at).toBeTruthy()
  })
})

// Realtime publication membership is verified by
// scripts/check-realtime-publication.sh (runs in `bun run lint`).
