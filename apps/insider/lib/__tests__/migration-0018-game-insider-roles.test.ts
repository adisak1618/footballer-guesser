import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"

// Integration test (T-2.B). Requires `bunx supabase start` running locally.
// Verifies migration 0018 creates `game_insider_roles` mapping
// (room_id, round_number, player_id) → role ∈ {master, insider, player}.
//
// Roles are PUBLIC to all anon clients in the room (so each player learns
// who is master / insider / commons after the round ends, and so the UI
// can show "you are the Master/Insider/Commons" when the round starts —
// each client filters by their own player_id). Asymmetric secrecy lives
// in `game_insider_round.secret_value` (migration 0017), not here.

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

const TEST_ROOM_CODE = "INS018"

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

let testRoomId: string
const masterPlayerId = crypto.randomUUID()
const insiderPlayerId = crypto.randomUUID()
const commons1PlayerId = crypto.randomUUID()
const commons2PlayerId = crypto.randomUUID()

async function cleanup() {
  // FK on delete cascade removes game_insider_roles rows when room is deleted.
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

describe("game_insider_roles (migration 0018)", () => {
  it("admin inserts role rows for master/insider/player", async () => {
    const { error } = await admin.from("game_insider_roles").insert([
      {
        room_id: testRoomId,
        round_number: 1,
        player_id: masterPlayerId,
        role: "master",
      },
      {
        room_id: testRoomId,
        round_number: 1,
        player_id: insiderPlayerId,
        role: "insider",
      },
      {
        room_id: testRoomId,
        round_number: 1,
        player_id: commons1PlayerId,
        role: "player",
      },
      {
        room_id: testRoomId,
        round_number: 1,
        player_id: commons2PlayerId,
        role: "player",
      },
    ])
    expect(error).toBeNull()
  })

  it("anon SELECT returns master/insider/player roles for room+round", async () => {
    const { data, error } = await anon
      .from("game_insider_roles")
      .select("player_id, role")
      .eq("room_id", testRoomId)
      .eq("round_number", 1)

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.length).toBe(4)

    const byRole = data!.reduce<Record<string, string[]>>((acc, row) => {
      ;(acc[row.role] ??= []).push(row.player_id)
      return acc
    }, {})
    expect(byRole.master).toEqual([masterPlayerId])
    expect(byRole.insider).toEqual([insiderPlayerId])
    expect(byRole.player?.sort()).toEqual(
      [commons1PlayerId, commons2PlayerId].sort(),
    )
  })

  it("role check constraint rejects invalid role values", async () => {
    const { error } = await admin.from("game_insider_roles").insert({
      room_id: testRoomId,
      round_number: 2,
      player_id: crypto.randomUUID(),
      role: "spy",
    })
    expect(error).not.toBeNull()
    // 23514 = check_violation
    expect(error?.code).toBe("23514")
  })

  it("PK (room_id, round_number, player_id) rejects duplicate role for same player+round", async () => {
    const { error } = await admin.from("game_insider_roles").insert({
      room_id: testRoomId,
      round_number: 1,
      player_id: masterPlayerId,
      role: "player",
    })
    expect(error).not.toBeNull()
    // 23505 = unique_violation (PK)
    expect(error?.code).toBe("23505")
  })

  it("same player can hold different roles across rounds", async () => {
    const { error } = await admin.from("game_insider_roles").insert({
      room_id: testRoomId,
      round_number: 2,
      player_id: masterPlayerId,
      role: "player",
    })
    expect(error).toBeNull()
  })
})

// Realtime publication membership is verified by
// scripts/check-realtime-publication.sh (runs in `bun run lint`).
