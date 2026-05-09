import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"

// Integration test (T-2.B / US-046 / Phase 5a.9). Requires `bunx supabase start`.
//
// Verifies migration 0025 creates the `mark_correct_guess(p_room_id, p_round,
// p_player_id)` SECURITY DEFINER RPC. Per design doc C2.A:
//   1. Chains `perform reconcile_round_phase(...)` first (T-2.A).
//   2. Caller's role for that round must be 'master'. Otherwise → PGAME15 / PG015.
//   3. After reconcile, if phase flipped to 'result_failed' (deadline tripped) →
//      PGAME02 / PG002 ("round expired") — the master ran out of time.
//   4. Any other phase != 'asking' (preparing, guessed, voting, reveal) →
//      PGAME16 / PG016 ("phase is X, expected asking").
//   5. UPDATE game_insider_round: phase='guessed',
//      guessed_at=now(), guessed_by_player_id=p_player_id,
//      vote_deadline = now() + interval '60 seconds',
//      eligible_voter_ids = snapshot of players.player_id WHERE connected = true (T-4).

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

const ROOM_CODES = {
  happy: "INS25A",
  nonMaster: "INS25B",
  preparing: "INS25C",
  guessed: "INS25D",
  expired: "INS25E",
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
  playerAId: string
  playerBId: string
  playerCDisconnectedId: string
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
  const playerAId = crypto.randomUUID()
  const playerBId = crypto.randomUUID()
  const playerCDisconnectedId = crypto.randomUUID()
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
    { room_id: room.id, player_id: masterId, display_name: "M", join_order: 1, connected: true },
    { room_id: room.id, player_id: insiderId, display_name: "I", join_order: 2, connected: true },
    { room_id: room.id, player_id: playerAId, display_name: "A", join_order: 3, connected: true },
    { room_id: room.id, player_id: playerBId, display_name: "B", join_order: 4, connected: true },
    { room_id: room.id, player_id: playerCDisconnectedId, display_name: "C", join_order: 5, connected: false },
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
    { room_id: room.id, round_number: 1, player_id: playerAId, role: "player" },
    { room_id: room.id, round_number: 1, player_id: playerBId, role: "player" },
    { room_id: room.id, round_number: 1, player_id: playerCDisconnectedId, role: "player" },
  ])
  if (rolesErr) throw rolesErr

  return {
    roomId: room.id,
    masterId,
    insiderId,
    playerAId,
    playerBId,
    playerCDisconnectedId,
  }
}

async function callMarkCorrectGuess(
  roomId: string,
  round: number,
  playerId: string,
) {
  return anon.rpc("mark_correct_guess", {
    p_room_id: roomId,
    p_round: round,
    p_player_id: playerId,
  })
}

beforeAll(async () => {
  await cleanup()
})

afterAll(async () => {
  await cleanup()
})

describe("mark_correct_guess (migration 0025) — Phase 5a.9", () => {
  it("Master in 'asking' before deadline → phase='guessed', vote_deadline≈now()+60s, eligible_voter_ids = connected players (T-4)", async () => {
    const f = await createRoomWithRoles(ROOM_CODES.happy, "asking", {
      timeLimitS: 300,
      startedAtIso: new Date().toISOString(),
    })

    const before = Date.now()
    const { error } = await callMarkCorrectGuess(f.roomId, 1, f.masterId)
    expect(error).toBeNull()
    const after = Date.now()

    const { data: round, error: rErr } = await admin
      .from("game_insider_round")
      .select("phase, vote_deadline, guessed_at, guessed_by_player_id, eligible_voter_ids")
      .eq("room_id", f.roomId)
      .eq("round_number", 1)
      .single()
    expect(rErr).toBeNull()
    expect(round?.phase).toBe("guessed")
    expect(round?.guessed_by_player_id).toBe(f.masterId)
    expect(round?.guessed_at).not.toBeNull()

    // vote_deadline must be approximately now() + 60s (within 5s tolerance for
    // server clock drift / test latency).
    const deadlineMs = new Date(round!.vote_deadline as string).getTime()
    expect(deadlineMs).toBeGreaterThanOrEqual(before + 60_000 - 5_000)
    expect(deadlineMs).toBeLessThanOrEqual(after + 60_000 + 5_000)

    // eligible_voter_ids snapshot: only the 4 connected players (master,
    // insider, A, B) — disconnected C must be excluded (T-4).
    const eligible = (round?.eligible_voter_ids as string[]) ?? []
    expect(eligible.length).toBe(4)
    expect(new Set(eligible)).toEqual(
      new Set([f.masterId, f.insiderId, f.playerAId, f.playerBId]),
    )
    expect(eligible).not.toContain(f.playerCDisconnectedId)
  })

  it("non-Master caller (insider role and player role) → PGAME15 / PG015", async () => {
    const f = await createRoomWithRoles(ROOM_CODES.nonMaster, "asking", {
      timeLimitS: 300,
      startedAtIso: new Date().toISOString(),
    })

    for (const pid of [f.insiderId, f.playerAId]) {
      const { error } = await callMarkCorrectGuess(f.roomId, 1, pid)
      expect(error).not.toBeNull()
      expect(error?.code).toBe("PG015")
      expect(error?.message ?? "").toMatch(/PGAME15/)
    }

    // Phase did not advance.
    const { data: round } = await admin
      .from("game_insider_round")
      .select("phase")
      .eq("room_id", f.roomId)
      .eq("round_number", 1)
      .single()
    expect(round?.phase).toBe("asking")
  })

  it("phase = 'preparing' (round not yet started) → PGAME16 / PG016", async () => {
    const f = await createRoomWithRoles(ROOM_CODES.preparing, "preparing")

    const { error } = await callMarkCorrectGuess(f.roomId, 1, f.masterId)
    expect(error).not.toBeNull()
    expect(error?.code).toBe("PG016")
    expect(error?.message ?? "").toMatch(/PGAME16/)

    const { data: round } = await admin
      .from("game_insider_round")
      .select("phase")
      .eq("room_id", f.roomId)
      .eq("round_number", 1)
      .single()
    expect(round?.phase).toBe("preparing")
  })

  it("phase = 'guessed' (already marked correct) → PGAME16 / PG016", async () => {
    const f = await createRoomWithRoles(ROOM_CODES.guessed, "guessed", {
      timeLimitS: 300,
      startedAtIso: new Date().toISOString(),
    })

    const { error } = await callMarkCorrectGuess(f.roomId, 1, f.masterId)
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

    const { error } = await callMarkCorrectGuess(f.roomId, 1, f.masterId)
    expect(error).not.toBeNull()
    expect(error?.code).toBe("PG002")
    expect(error?.message ?? "").toMatch(/PGAME02/)

    // Calling reconcile directly idempotently advances asking → result_failed.
    const { error: recErr } = await anon.rpc("reconcile_round_phase", {
      p_room_id: f.roomId,
      p_round: 1,
    })
    expect(recErr).toBeNull()

    const { data: round } = await admin
      .from("game_insider_round")
      .select("phase, vote_deadline, eligible_voter_ids")
      .eq("room_id", f.roomId)
      .eq("round_number", 1)
      .single()
    expect(round?.phase).toBe("result_failed")
    // vote_deadline must NOT have been set (the RPC errored before UPDATE).
    expect(round?.vote_deadline).toBeNull()
    expect(round?.eligible_voter_ids).toBeNull()
  })
})
