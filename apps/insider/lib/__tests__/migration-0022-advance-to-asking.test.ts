import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"

// Integration test (T-2.B / US-043). Requires `bunx supabase start` running locally.
//
// Verifies migration 0022 creates the `advance_to_asking(p_room_id, p_round,
// p_player_id)` SECURITY DEFINER RPC. Per T-3.B any connected player (host or
// not) can advance the round from 'preparing' → 'asking', stamping started_at.
// The function:
//   1. chains `perform reconcile_round_phase(p_room_id, p_round)` first (T-2.A),
//   2. validates the caller is in the room (errcode PGAME11 / SQLSTATE PG011),
//   3. updates the round with WHERE phase='preparing' so a second call (or any
//      other phase) is a silent no-op (idempotent, per state machine C2.A).

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

const TEST_ROOM_CODE = "INS022"
const PACK_SLUG = "football-premier-league"

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

let testRoomId: string
const hostPlayerId = crypto.randomUUID()
const guestPlayerId = crypto.randomUUID()
const strangerPlayerId = crypto.randomUUID()

async function cleanup() {
  // FK on delete cascade clears game_insider_round + players when the room dies.
  await admin.from("rooms").delete().eq("code", TEST_ROOM_CODE)
}

async function readRound(roundNumber: number) {
  const { data, error } = await admin
    .from("game_insider_round")
    .select("phase, started_at")
    .eq("room_id", testRoomId)
    .eq("round_number", roundNumber)
    .single()
  if (error) throw error
  return data!
}

async function insertPreparingRound(round: number): Promise<void> {
  const { error } = await admin.from("game_insider_round").insert({
    room_id: testRoomId,
    round_number: round,
    pack_slug: PACK_SLUG,
    secret_value: "X",
    time_limit_s: 300,
    phase: "preparing",
  })
  if (error) throw error
}

async function callAdvance(playerId: string, round: number) {
  return anon.rpc("advance_to_asking", {
    p_room_id: testRoomId,
    p_round: round,
    p_player_id: playerId,
  })
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
      host_player_id: hostPlayerId,
    })
    .select("id")
    .single()
  if (roomErr) throw roomErr
  testRoomId = room.id

  const { error: playersErr } = await admin.from("players").insert([
    {
      room_id: testRoomId,
      player_id: hostPlayerId,
      display_name: "Host",
      join_order: 1,
    },
    {
      room_id: testRoomId,
      player_id: guestPlayerId,
      display_name: "Guest",
      join_order: 2,
    },
  ])
  if (playersErr) throw playersErr
})

afterAll(async () => {
  await cleanup()
})

describe("advance_to_asking (migration 0022) — T-3.B", () => {
  it("any player in the room advances 'preparing' → 'asking' and stamps started_at", async () => {
    await insertPreparingRound(1)
    const before = await readRound(1)
    expect(before.phase).toBe("preparing")
    expect(before.started_at).toBeNull()

    const beforeCall = Date.now()
    const { error } = await callAdvance(guestPlayerId, 1)
    expect(error).toBeNull()

    const after = await readRound(1)
    expect(after.phase).toBe("asking")
    expect(after.started_at).not.toBeNull()
    const startedAtMs = new Date(after.started_at as string).getTime()
    // started_at must be approximately now() — within 30s window of the call.
    expect(Math.abs(startedAtMs - beforeCall)).toBeLessThan(30_000)
  })

  it("idempotent — second call is a silent no-op (phase stays 'asking', started_at unchanged)", async () => {
    const firstStartedAt = (await readRound(1)).started_at
    expect(firstStartedAt).not.toBeNull()

    // Wait long enough that any UPDATE writing now() would shift started_at.
    await new Promise((resolve) => setTimeout(resolve, 50))

    const { error } = await callAdvance(hostPlayerId, 1)
    expect(error).toBeNull()

    const after = await readRound(1)
    expect(after.phase).toBe("asking")
    expect(after.started_at).toBe(firstStartedAt)
  })

  it("caller not in room → errcode PGAME11 / SQLSTATE PG011", async () => {
    await insertPreparingRound(2)
    const { error } = await callAdvance(strangerPlayerId, 2)
    expect(error).not.toBeNull()
    expect(error?.code).toBe("PG011")
    expect(error?.message ?? "").toMatch(/PGAME11/)

    // Phase must remain 'preparing' since the call errored out before UPDATE.
    const after = await readRound(2)
    expect(after.phase).toBe("preparing")
  })

  it("phase already 'asking' → no-op (does not reset started_at, does not error)", async () => {
    // Round 1 is already 'asking' from the first test.
    const before = await readRound(1)
    expect(before.phase).toBe("asking")
    const startedAtBefore = before.started_at

    const { error } = await callAdvance(guestPlayerId, 1)
    expect(error).toBeNull()

    const after = await readRound(1)
    expect(after.phase).toBe("asking")
    expect(after.started_at).toBe(startedAtBefore)
  })
})
