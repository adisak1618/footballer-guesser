import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"

// Integration test for issue #14: reset_game must clear `category_locked`
// so the host can pick a different category for the next game. Requires
// `bunx supabase start` running locally. Mirrors the service-role-client
// pattern from `insider-secret-rls.test.ts`.

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321"

const LOCAL_SERVICE_ROLE_FALLBACK =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  "eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0." +
  "EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? LOCAL_SERVICE_ROLE_FALLBACK

const TEST_ROOM_CODE = "RST014"
const HOST_PLAYER_ID = "00000000-0000-4000-a000-000000000014"
const GUEST_PLAYER_ID = "00000000-0000-4000-a000-000000000015"

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

let roomId: string

async function seedEndedRoom() {
  await admin.from("rooms").delete().eq("code", TEST_ROOM_CODE)

  const { data: room, error: roomErr } = await admin
    .from("rooms")
    .insert({
      code: TEST_ROOM_CODE,
      status: "ENDED",
      current_round: 3,
      max_rounds: 3,
      score_positions: 1,
      category: "premier-league",
      category_locked: true,
      host_player_id: HOST_PLAYER_ID,
    })
    .select("id")
    .single()
  expect(roomErr).toBeNull()
  expect(room?.id).toBeTruthy()
  roomId = room!.id as string

  const { error: hostErr } = await admin.from("players").insert([
    {
      room_id: roomId,
      player_id: HOST_PLAYER_ID,
      display_name: "Host",
      join_order: 1,
      total_score: 5,
    },
    {
      room_id: roomId,
      player_id: GUEST_PLAYER_ID,
      display_name: "Guest",
      join_order: 2,
      total_score: 3,
    },
  ])
  expect(hostErr).toBeNull()

  const { error: stateErr } = await admin.from("round_state").insert({
    room_id: roomId,
    round_number: 3,
    player_id: HOST_PLAYER_ID,
    assigned_name: "Lionel Messi",
    score_this_round: 1,
    is_active: false,
    final_position: 1,
  })
  expect(stateErr).toBeNull()

  const { error: posErr } = await admin.from("round_positions").insert({
    room_id: roomId,
    round_number: 3,
    next_position: 2,
  })
  expect(posErr).toBeNull()
}

beforeAll(async () => {
  await seedEndedRoom()
})

afterAll(async () => {
  await admin.from("rooms").delete().eq("code", TEST_ROOM_CODE)
})

describe("reset_game unlocks category (issue #14)", () => {
  it("flips status ENDED → LOBBY, clears category_locked, resets game-state, preserves room code + category", async () => {
    const { error } = await admin.rpc("reset_game", {
      p_room_id: roomId,
      p_host_player_id: HOST_PLAYER_ID,
    })
    expect(error).toBeNull()

    const { data: room, error: readErr } = await admin
      .from("rooms")
      .select(
        "code, status, current_round, category, category_locked, host_player_id",
      )
      .eq("id", roomId)
      .single()

    expect(readErr).toBeNull()
    expect(room?.code).toBe(TEST_ROOM_CODE)
    expect(room?.status).toBe("LOBBY")
    expect(room?.current_round).toBe(0)
    expect(room?.category).toBe("premier-league")
    expect(room?.category_locked).toBe(false)
    expect(room?.host_player_id).toBe(HOST_PLAYER_ID)

    const { data: players, error: playersErr } = await admin
      .from("players")
      .select("player_id, total_score")
      .eq("room_id", roomId)
      .order("join_order")
    expect(playersErr).toBeNull()
    expect(players).toHaveLength(2)
    expect(players?.every((p) => p.total_score === 0)).toBe(true)

    const { count: stateCount } = await admin
      .from("round_state")
      .select("*", { count: "exact", head: true })
      .eq("room_id", roomId)
    expect(stateCount).toBe(0)

    const { count: posCount } = await admin
      .from("round_positions")
      .select("*", { count: "exact", head: true })
      .eq("room_id", roomId)
    expect(posCount).toBe(0)
  })
})
