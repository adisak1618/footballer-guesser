import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"

// Integration test (T-2.B / US-048 / Phase 5a.11). Requires `bunx supabase start`.
//
// Verifies migration 0027 creates `cast_vote(p_room_id, p_round, p_player_id,
// p_voted_player_id)` SECURITY DEFINER RPC. Per design doc C2.A:
//
//   1. Chains `perform reconcile_round_phase(...)` first (T-2.A) so a
//      voting→reveal flip from a passed deadline is applied before phase checks.
//   2. After reconcile, if the deadline already passed, surface PGAME19/PG019
//      ('vote deadline passed') — distinct from a generic phase mismatch so the
//      client can render the timeout state. Otherwise non-'voting' phases
//      (preparing, asking, guessed, reveal-via-already-completed) → PGAME18/PG018.
//   3. Voter must be in eligible_voter_ids[] (snapshotted at vote start in
//      US-046 / mark_correct_guess). Otherwise → PGAME17/PG017.
//   4. UPSERT into game_insider_votes — PK is (room_id, round_number,
//      voter_player_id) so a re-vote overwrites the previous ballot.
//   5. After the upsert, if all eligible voters have a row in
//      game_insider_votes, auto-advance phase to 'reveal' (the single same
//      RPC that recorded the last vote also flips the phase, so clients see
//      the transition without needing a separate poll). The actual score
//      computation lives in advance_to_reveal (US-049 / Phase 5a.12); this
//      RPC just flips phase to 'reveal' so advance_to_reveal becomes a no-op
//      for transition (idempotent) but still computes scores.

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
  happy: "INS27A",
  notEligible: "INS27B",
  wrongPhase: "INS27C",
  expired: "INS27D",
  autoAdvance: "INS27E",
  rewrite: "INS27F",
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
  /** Connected but NOT in eligible_voter_ids — simulates "joined after vote start". */
  strangerId: string
}

async function cleanup(): Promise<void> {
  for (const code of Object.values(ROOM_CODES)) {
    await admin.from("rooms").delete().eq("code", code)
  }
}

async function createVotingRoom(
  code: string,
  args: {
    phase: "preparing" | "asking" | "guessed" | "voting" | "reveal"
    voteDeadlineIso?: string | null
    eligibleSubset?: "all-four" | "none"
  } = { phase: "voting" },
): Promise<Fixture> {
  const masterId = crypto.randomUUID()
  const insiderId = crypto.randomUUID()
  const playerAId = crypto.randomUUID()
  const playerBId = crypto.randomUUID()
  const strangerId = crypto.randomUUID()

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
    { room_id: room.id, player_id: strangerId, display_name: "S", join_order: 5, connected: true },
  ])
  if (pErr) throw pErr

  const { error: rolesErr } = await admin.from("game_insider_roles").insert([
    { room_id: room.id, round_number: 1, player_id: masterId, role: "master" },
    { room_id: room.id, round_number: 1, player_id: insiderId, role: "insider" },
    { room_id: room.id, round_number: 1, player_id: playerAId, role: "player" },
    { room_id: room.id, round_number: 1, player_id: playerBId, role: "player" },
    { room_id: room.id, round_number: 1, player_id: strangerId, role: "player" },
  ])
  if (rolesErr) throw rolesErr

  const eligible =
    args.eligibleSubset === "none"
      ? null
      : [masterId, insiderId, playerAId, playerBId]

  const { error: rErr } = await admin.from("game_insider_round").insert({
    room_id: room.id,
    round_number: 1,
    pack_slug: PACK_SLUG,
    secret_value: "X",
    time_limit_s: 300,
    phase: args.phase,
    started_at: new Date().toISOString(),
    vote_deadline:
      args.voteDeadlineIso === undefined
        ? new Date(Date.now() + 60 * 1000).toISOString()
        : args.voteDeadlineIso,
    eligible_voter_ids: eligible,
  })
  if (rErr) throw rErr

  return {
    roomId: room.id,
    masterId,
    insiderId,
    playerAId,
    playerBId,
    strangerId,
  }
}

async function callCastVote(
  roomId: string,
  round: number,
  voterId: string,
  votedId: string,
) {
  return anon.rpc("cast_vote", {
    p_room_id: roomId,
    p_round: round,
    p_player_id: voterId,
    p_voted_player_id: votedId,
  })
}

beforeAll(async () => {
  await cleanup()
})

afterAll(async () => {
  await cleanup()
})

describe("cast_vote (migration 0027) — Phase 5a.11", () => {
  it("eligible voter casts a vote → row inserted; second call rewrites via PK conflict", async () => {
    const f = await createVotingRoom(ROOM_CODES.rewrite, { phase: "voting" })

    // First cast: A votes for Insider.
    const { error: e1 } = await callCastVote(
      f.roomId,
      1,
      f.playerAId,
      f.insiderId,
    )
    expect(e1).toBeNull()

    let { data: votes } = await admin
      .from("game_insider_votes")
      .select("voter_player_id, voted_player_id")
      .eq("room_id", f.roomId)
      .eq("round_number", 1)
    expect(votes?.length).toBe(1)
    expect(votes?.[0]?.voter_player_id).toBe(f.playerAId)
    expect(votes?.[0]?.voted_player_id).toBe(f.insiderId)

    // Re-vote: A changes vote to Master. PK (room, round, voter) conflict
    // overwrites — still exactly one row for A.
    const { error: e2 } = await callCastVote(
      f.roomId,
      1,
      f.playerAId,
      f.masterId,
    )
    expect(e2).toBeNull()

    ;({ data: votes } = await admin
      .from("game_insider_votes")
      .select("voter_player_id, voted_player_id")
      .eq("room_id", f.roomId)
      .eq("round_number", 1))
    expect(votes?.length).toBe(1)
    expect(votes?.[0]?.voted_player_id).toBe(f.masterId)
  })

  it("voter not in eligible_voter_ids[] → PGAME17 / PG017", async () => {
    const f = await createVotingRoom(ROOM_CODES.notEligible, { phase: "voting" })

    const { error } = await callCastVote(
      f.roomId,
      1,
      f.strangerId,
      f.insiderId,
    )
    expect(error).not.toBeNull()
    expect(error?.code).toBe("PG017")
    expect(error?.message ?? "").toMatch(/PGAME17/)

    const { data: votes } = await admin
      .from("game_insider_votes")
      .select("*")
      .eq("room_id", f.roomId)
      .eq("round_number", 1)
    expect(votes?.length).toBe(0)
  })

  it("phase != 'voting' (still 'asking') → PGAME18 / PG018", async () => {
    const f = await createVotingRoom(ROOM_CODES.wrongPhase, {
      phase: "asking",
      voteDeadlineIso: null,
      eligibleSubset: "none",
    })

    const { error } = await callCastVote(f.roomId, 1, f.playerAId, f.insiderId)
    expect(error).not.toBeNull()
    expect(error?.code).toBe("PG018")
    expect(error?.message ?? "").toMatch(/PGAME18/)
  })

  it("vote deadline passed → PGAME19 / PG019 + reconcile_round_phase advances voting → reveal", async () => {
    // vote_deadline 30s in the past, phase still 'voting'. cast_vote chains
    // reconcile_round_phase first (T-2.A) so it observes the would-be flip,
    // then surfaces PGAME19. The function's transaction rolls back when it
    // raises (matching the mark_correct_guess US-046 expiry pattern), so a
    // separate explicit reconcile_round_phase call is what actually
    // commits the voting→reveal transition.
    const f = await createVotingRoom(ROOM_CODES.expired, {
      phase: "voting",
      voteDeadlineIso: new Date(Date.now() - 30 * 1000).toISOString(),
    })

    const { error } = await callCastVote(f.roomId, 1, f.playerAId, f.insiderId)
    expect(error).not.toBeNull()
    expect(error?.code).toBe("PG019")
    expect(error?.message ?? "").toMatch(/PGAME19/)

    // No vote should have been recorded.
    const { data: votes } = await admin
      .from("game_insider_votes")
      .select("*")
      .eq("room_id", f.roomId)
      .eq("round_number", 1)
    expect(votes?.length).toBe(0)

    // Calling reconcile_round_phase directly idempotently advances
    // voting → reveal.
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
    expect(round?.phase).toBe("reveal")
  })

  it("all eligible voters voted → auto-advance phase to 'reveal'", async () => {
    const f = await createVotingRoom(ROOM_CODES.autoAdvance, { phase: "voting" })

    // Master + Insider + A + B all vote (4 eligible). After the 4th vote the
    // RPC itself flips phase voting → reveal in the same call.
    const { error: e1 } = await callCastVote(f.roomId, 1, f.masterId, f.insiderId)
    expect(e1).toBeNull()
    const { error: e2 } = await callCastVote(f.roomId, 1, f.playerAId, f.insiderId)
    expect(e2).toBeNull()
    const { error: e3 } = await callCastVote(f.roomId, 1, f.playerBId, f.insiderId)
    expect(e3).toBeNull()

    // Phase is still 'voting' (3 of 4 voted).
    let { data: round } = await admin
      .from("game_insider_round")
      .select("phase")
      .eq("room_id", f.roomId)
      .eq("round_number", 1)
      .single()
    expect(round?.phase).toBe("voting")

    // Last vote.
    const { error: e4 } = await callCastVote(f.roomId, 1, f.insiderId, f.playerAId)
    expect(e4).toBeNull()

    ;({ data: round } = await admin
      .from("game_insider_round")
      .select("phase")
      .eq("room_id", f.roomId)
      .eq("round_number", 1)
      .single())
    expect(round?.phase).toBe("reveal")
  })
})
