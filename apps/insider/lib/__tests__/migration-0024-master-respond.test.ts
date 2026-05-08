import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"

// Integration test (T-2.B / US-045 / Phase 5a.8). Requires `bunx supabase start`.
//
// Verifies migration 0024 creates the `master_respond(p_room_id, p_round,
// p_player_id, p_response)` SECURITY DEFINER RPC. Per design doc C2.A:
//   1. Chains `perform reconcile_round_phase(...)` first (T-2.A).
//   2. Caller's role for that round must be 'master'. Otherwise → PGAME15 / PG015.
//   3. After reconcile, if phase flipped to 'result_failed' (deadline tripped) →
//      PGAME02 / PG002 ("round expired") — the master ran out of time.
//   4. Any other phase != 'asking' (preparing, guessed, voting, reveal) →
//      PGAME16 / PG016 ("phase is X, expected asking").
//   5. Insert into game_insider_responses (room_id, round_number, response).
//      response check constraint enforces yes|no|unsure (migration 0019).

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

const PACK_SLUG = "football-premier-league"

// Distinct rooms per scenario so each test starts from a clean phase/role state.
const ROOM_CODES = {
  happy: "INS24A",
  nonMaster: "INS24B",
  preparing: "INS24C",
  guessed: "INS24D",
  expired: "INS24E",
} as const

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

interface Fixture {
  roomId: string
  masterId: string
  insiderId: string
  playerId: string
}

async function cleanup(): Promise<void> {
  for (const code of Object.values(ROOM_CODES)) {
    await admin.from("rooms").delete().eq("code", code)
  }
}

async function createRoomWithRoles(
  code: string,
  phase: "preparing" | "asking" | "guessed",
  options: { timeLimitS?: number; startedAtIso?: string | null } = {},
): Promise<Fixture> {
  const masterId = crypto.randomUUID()
  const insiderId = crypto.randomUUID()
  const playerId = crypto.randomUUID()
  const { timeLimitS = 300, startedAtIso = null } = options

  const { data: room, error: roomErr } = await admin
    .from("rooms")
    .insert({
      code,
      max_rounds: 5,
      score_positions: 4,
      category: "premier-league",
      game_type: "insider",
      host_player_id: masterId,
    })
    .select("id")
    .single()
  if (roomErr) throw roomErr

  const { error: pErr } = await admin.from("players").insert([
    { room_id: room.id, player_id: masterId, display_name: "M", join_order: 1 },
    { room_id: room.id, player_id: insiderId, display_name: "I", join_order: 2 },
    { room_id: room.id, player_id: playerId, display_name: "P", join_order: 3 },
  ])
  if (pErr) throw pErr

  const { error: rErr } = await admin.from("game_insider_round").insert({
    room_id: room.id,
    round_number: 1,
    pack_slug: PACK_SLUG,
    secret_value: "X",
    time_limit_s: timeLimitS,
    phase,
    started_at: startedAtIso,
  })
  if (rErr) throw rErr

  const { error: rolesErr } = await admin.from("game_insider_roles").insert([
    { room_id: room.id, round_number: 1, player_id: masterId, role: "master" },
    { room_id: room.id, round_number: 1, player_id: insiderId, role: "insider" },
    { room_id: room.id, round_number: 1, player_id: playerId, role: "player" },
  ])
  if (rolesErr) throw rolesErr

  return { roomId: room.id, masterId, insiderId, playerId }
}

async function callRespond(
  roomId: string,
  round: number,
  playerId: string,
  response: string,
) {
  return anon.rpc("master_respond", {
    p_room_id: roomId,
    p_round: round,
    p_player_id: playerId,
    p_response: response,
  })
}

beforeAll(async () => {
  await cleanup()
})

afterAll(async () => {
  await cleanup()
})

describe("master_respond (migration 0024) — Phase 5a.8", () => {
  it("Master in 'asking' before deadline → inserts response row (yes/no/unsure all accepted)", async () => {
    const f = await createRoomWithRoles(ROOM_CODES.happy, "asking", {
      timeLimitS: 300,
      startedAtIso: new Date().toISOString(),
    })

    for (const r of ["yes", "no", "unsure"]) {
      const { error } = await callRespond(f.roomId, 1, f.masterId, r)
      expect(error).toBeNull()
    }

    const { data, error } = await admin
      .from("game_insider_responses")
      .select("response")
      .eq("room_id", f.roomId)
      .eq("round_number", 1)
      .order("id", { ascending: true })
    expect(error).toBeNull()
    expect(data?.map((row) => row.response)).toEqual(["yes", "no", "unsure"])

    // Phase did not advance.
    const { data: round } = await admin
      .from("game_insider_round")
      .select("phase")
      .eq("room_id", f.roomId)
      .eq("round_number", 1)
      .single()
    expect(round?.phase).toBe("asking")
  })

  it("non-Master caller (insider role and player role) → PGAME15 / PG015", async () => {
    const f = await createRoomWithRoles(ROOM_CODES.nonMaster, "asking", {
      timeLimitS: 300,
      startedAtIso: new Date().toISOString(),
    })

    for (const pid of [f.insiderId, f.playerId]) {
      const { error } = await callRespond(f.roomId, 1, pid, "yes")
      expect(error).not.toBeNull()
      expect(error?.code).toBe("PG015")
      expect(error?.message ?? "").toMatch(/PGAME15/)
    }

    // No response was inserted.
    const { data } = await admin
      .from("game_insider_responses")
      .select("id")
      .eq("room_id", f.roomId)
      .eq("round_number", 1)
    expect(data?.length ?? 0).toBe(0)
  })

  it("phase = 'preparing' (round not started) → PGAME16 / PG016", async () => {
    const f = await createRoomWithRoles(ROOM_CODES.preparing, "preparing")

    const { error } = await callRespond(f.roomId, 1, f.masterId, "yes")
    expect(error).not.toBeNull()
    expect(error?.code).toBe("PG016")
    expect(error?.message ?? "").toMatch(/PGAME16/)

    const { data } = await admin
      .from("game_insider_responses")
      .select("id")
      .eq("room_id", f.roomId)
      .eq("round_number", 1)
    expect(data?.length ?? 0).toBe(0)
  })

  it("phase = 'guessed' (post-correct-guess) → PGAME16 / PG016", async () => {
    const f = await createRoomWithRoles(ROOM_CODES.guessed, "guessed", {
      timeLimitS: 300,
      startedAtIso: new Date().toISOString(),
    })

    const { error } = await callRespond(f.roomId, 1, f.masterId, "yes")
    expect(error).not.toBeNull()
    expect(error?.code).toBe("PG016")
    expect(error?.message ?? "").toMatch(/PGAME16/)
  })

  it("round expired (now() >= started_at + time_limit_s) → PGAME02 / PG002 + reconcile flips phase to 'result_failed'", async () => {
    // started_at is 60s ago, time_limit_s = 1 → deadline is 59s in the past.
    const startedAt = new Date(Date.now() - 60_000).toISOString()
    const f = await createRoomWithRoles(ROOM_CODES.expired, "asking", {
      timeLimitS: 1,
      startedAtIso: startedAt,
    })

    const { error } = await callRespond(f.roomId, 1, f.masterId, "yes")
    expect(error).not.toBeNull()
    expect(error?.code).toBe("PG002")
    expect(error?.message ?? "").toMatch(/PGAME02/)

    // No response was inserted.
    const { data: responses } = await admin
      .from("game_insider_responses")
      .select("id")
      .eq("room_id", f.roomId)
      .eq("round_number", 1)
    expect(responses?.length ?? 0).toBe(0)

    // The PGAME02 raise rolls back master_respond's transaction, including
    // the reconcile UPDATE inside it (PostgREST wraps each RPC in a single
    // transaction; an exception unwinds the entire txn). The self-healing
    // property of T-2.A means the *next* RPC touching this round triggers
    // reconcile and flips the phase. We simulate that by calling
    // reconcile_round_phase directly — it must idempotently advance asking
    // → result_failed because now() is past started_at + time_limit_s.
    const { error: recErr } = await anon.rpc("reconcile_round_phase", {
      p_room_id: f.roomId,
      p_round: 1,
    })
    expect(recErr).toBeNull()

    const { data: round } = await admin
      .from("game_insider_round")
      .select("phase")
      .eq("room_id", f.roomId)
      .eq("round_number", 1)
      .single()
    expect(round?.phase).toBe("result_failed")
  })
})
