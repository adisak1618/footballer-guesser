import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"

// Integration test (US-071, A1.C). Requires `bunx supabase start` running locally.
// Verifies the column-level GRANT in migration 0017 hides
// `game_insider_round.secret_value` from the anon role:
//   - anon SELECT secret_value          → SQLSTATE 42501 (insufficient_privilege)
//   - anon SELECT *                     → SQLSTATE 42501 (* expands to secret_value)
//   - anon SELECT <non-secret columns>  → succeeds
// Master + Insider read the secret via the SECURITY DEFINER RPC
// `get_my_insider_secret` (migration 0021), not by column SELECT.

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

const TEST_ROOM_CODE = "TST071"
const TEST_SECRET = "rls-secret-do-not-leak-071"

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

let roomId: string

beforeAll(async () => {
  // Clean any leftover from previous runs (cascades to game_insider_round).
  await admin.from("rooms").delete().eq("code", TEST_ROOM_CODE)

  const { data: room, error: roomErr } = await admin
    .from("rooms")
    .insert({
      code: TEST_ROOM_CODE,
      max_rounds: 1,
      score_positions: 1,
      game_type: "insider",
    })
    .select("id")
    .single()
  expect(roomErr).toBeNull()
  expect(room?.id).toBeTruthy()
  roomId = room!.id as string

  const { error: roundErr } = await admin.from("game_insider_round").insert({
    room_id: roomId,
    round_number: 1,
    pack_slug: "football-premier-league",
    secret_value: TEST_SECRET,
    time_limit_s: 300,
    phase: "preparing",
  })
  expect(roundErr).toBeNull()
})

afterAll(async () => {
  await admin.from("rooms").delete().eq("code", TEST_ROOM_CODE)
})

describe("game_insider_round secret_value column-level RLS (migration 0017, A1.C)", () => {
  it("anon SELECT of secret_value column → permission denied (SQLSTATE 42501)", async () => {
    const { data, error } = await anon
      .from("game_insider_round")
      .select("secret_value")
      .eq("room_id", roomId)
      .eq("round_number", 1)

    expect(data).toBeNull()
    expect(error).not.toBeNull()
    expect(error?.code).toBe("42501")
  })

  it("anon SELECT * → permission denied (SQLSTATE 42501) — * expands to secret_value", async () => {
    const { data, error } = await anon
      .from("game_insider_round")
      .select("*")
      .eq("room_id", roomId)
      .eq("round_number", 1)

    expect(data).toBeNull()
    expect(error).not.toBeNull()
    expect(error?.code).toBe("42501")
  })

  it("anon SELECT of explicit non-secret columns → succeeds (no secret_value leaked)", async () => {
    const { data, error } = await anon
      .from("game_insider_round")
      .select(
        "room_id, round_number, pack_slug, time_limit_s, phase, started_at, vote_deadline, guessed_at, guessed_by_player_id, eligible_voter_ids",
      )
      .eq("room_id", roomId)
      .eq("round_number", 1)
      .single()

    expect(error).toBeNull()
    expect(data).toMatchObject({
      room_id: roomId,
      round_number: 1,
      pack_slug: "football-premier-league",
      time_limit_s: 300,
      phase: "preparing",
    })
    expect(data && (data as Record<string, unknown>).secret_value).toBeUndefined()
  })
})
