import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"

// Integration test (T-2.B / US-049 / Phase 5a.12). Requires `bunx supabase start`.
//
// Verifies migration 0028 creates `advance_to_reveal(p_room_id, p_round)`
// SECURITY DEFINER RPC plus a `scored_at timestamptz` column on
// game_insider_round used as the idempotency guard for scoring. Per design
// doc C2.A:
//
//   1. Chains `perform reconcile_round_phase(...)` first (T-2.A) so a
//      voting→reveal flip from a passed deadline is applied before phase checks.
//   2. Phase transitions:
//      - voting → reveal when (a) all eligible voted, or (b) vote_deadline
//        passed (handled by reconcile chain).
//      - voting → no-op when called early (not all voted, deadline not passed).
//      - result_failed → no-op for phase, but scoring stamp records "no scores"
//        outcome (Time expired = everyone 0).
//      - reveal (already flipped by cast_vote auto-advance, US-048) → run
//        scoring once and stamp scored_at.
//   3. Scoring rules per C2.A and PRD US-5a.12:
//      - Group caught Insider (Insider's player_id in the top-voted set):
//        Master + each Common +2 pts; Insider +0.
//      - Insider escaped (Insider not in top-voted set): Insider +3 pts;
//        others +0.
//      - Tied vote between suspects: all tied 'caught' (D2). If Insider is
//        in the tied set → caught. Otherwise → escaped.
//      - Time expired (no votes recorded, or asking-phase result_failed):
//        everyone 0 (no total_score updates).
//   4. Idempotent. `scored_at` stamped after scoring; subsequent calls early-return.

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
  caught: "INS28A",
  escaped: "INS28B",
  tiedCaught: "INS28C",
  earlyNoop: "INS28D",
  resultFailed: "INS28E",
  idempotent: "INS28F",
  deadlineNoVotes: "INS28G",
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
}

async function cleanup(): Promise<void> {
  for (const code of Object.values(ROOM_CODES)) {
    await admin.from("rooms").delete().eq("code", code)
  }
}

interface RoomArgs {
  phase: "preparing" | "asking" | "guessed" | "voting" | "reveal" | "result_failed"
  voteDeadlineIso?: string | null
  startedAtIso?: string
  timeLimitS?: number
  /** Override the eligibility array. Defaults to [master, insider, A, B]. */
  eligible?: "all-four" | "none"
}

async function createRound(code: string, args: RoomArgs): Promise<Fixture> {
  const masterId = crypto.randomUUID()
  const insiderId = crypto.randomUUID()
  const playerAId = crypto.randomUUID()
  const playerBId = crypto.randomUUID()

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
    { room_id: room.id, player_id: masterId, display_name: "M", join_order: 1, connected: true, total_score: 0 },
    { room_id: room.id, player_id: insiderId, display_name: "I", join_order: 2, connected: true, total_score: 0 },
    { room_id: room.id, player_id: playerAId, display_name: "A", join_order: 3, connected: true, total_score: 0 },
    { room_id: room.id, player_id: playerBId, display_name: "B", join_order: 4, connected: true, total_score: 0 },
  ])
  if (pErr) throw pErr

  const { error: rolesErr } = await admin.from("game_insider_roles").insert([
    { room_id: room.id, round_number: 1, player_id: masterId, role: "master" },
    { room_id: room.id, round_number: 1, player_id: insiderId, role: "insider" },
    { room_id: room.id, round_number: 1, player_id: playerAId, role: "player" },
    { room_id: room.id, round_number: 1, player_id: playerBId, role: "player" },
  ])
  if (rolesErr) throw rolesErr

  const eligible =
    args.eligible === "none"
      ? null
      : [masterId, insiderId, playerAId, playerBId]

  const { error: rErr } = await admin.from("game_insider_round").insert({
    room_id: room.id,
    round_number: 1,
    pack_slug: PACK_SLUG,
    secret_value: "X",
    time_limit_s: args.timeLimitS ?? 300,
    phase: args.phase,
    started_at: args.startedAtIso ?? new Date().toISOString(),
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
  }
}

async function insertVote(
  roomId: string,
  voterId: string,
  votedId: string,
): Promise<void> {
  const { error } = await admin.from("game_insider_votes").insert({
    room_id: roomId,
    round_number: 1,
    voter_player_id: voterId,
    voted_player_id: votedId,
  })
  if (error) throw error
}

async function callAdvance(roomId: string, round: number) {
  return anon.rpc("advance_to_reveal", {
    p_room_id: roomId,
    p_round: round,
  })
}

async function readScores(roomId: string): Promise<Record<string, number>> {
  const { data, error } = await admin
    .from("players")
    .select("player_id, total_score")
    .eq("room_id", roomId)
  if (error) throw error
  const out: Record<string, number> = {}
  for (const row of data ?? []) {
    out[row.player_id as string] = row.total_score as number
  }
  return out
}

async function readRound(roomId: string) {
  const { data, error } = await admin
    .from("game_insider_round")
    .select("phase, scored_at")
    .eq("room_id", roomId)
    .eq("round_number", 1)
    .single()
  if (error) throw error
  return data as { phase: string; scored_at: string | null }
}

beforeAll(async () => {
  await cleanup()
})

afterAll(async () => {
  await cleanup()
})

describe("advance_to_reveal (migration 0028) — Phase 5a.12", () => {
  it("all eligible voted (cast_vote already flipped to reveal), Insider has plurality → caught: Master+2, Commons+2, Insider+0", async () => {
    // Mirror the post-cast_vote state: phase already 'reveal' (US-048
    // auto-advanced), all 4 eligible voters' rows in game_insider_votes,
    // plurality voted for the insider.
    const f = await createRound(ROOM_CODES.caught, { phase: "reveal" })

    await insertVote(f.roomId, f.masterId, f.insiderId)
    await insertVote(f.roomId, f.playerAId, f.insiderId)
    await insertVote(f.roomId, f.playerBId, f.insiderId)
    await insertVote(f.roomId, f.insiderId, f.playerAId)

    const { error } = await callAdvance(f.roomId, 1)
    expect(error).toBeNull()

    const round = await readRound(f.roomId)
    expect(round.phase).toBe("reveal")
    expect(round.scored_at).not.toBeNull()

    const scores = await readScores(f.roomId)
    expect(scores[f.masterId]).toBe(2)
    expect(scores[f.playerAId]).toBe(2)
    expect(scores[f.playerBId]).toBe(2)
    expect(scores[f.insiderId]).toBe(0)
  })

  it("vote deadline passed in 'voting' phase → reconcile flips to reveal; Insider escaped: Insider+3, others 0", async () => {
    // phase=voting, deadline 30s in the past. 3 of 4 voted for Master (escape
    // — Insider is not in the top-voted set). advance_to_reveal triggers
    // reconcile (voting→reveal), then computes scoring.
    const f = await createRound(ROOM_CODES.escaped, {
      phase: "voting",
      voteDeadlineIso: new Date(Date.now() - 30 * 1000).toISOString(),
    })

    await insertVote(f.roomId, f.playerAId, f.masterId)
    await insertVote(f.roomId, f.playerBId, f.masterId)
    await insertVote(f.roomId, f.insiderId, f.masterId)

    const { error } = await callAdvance(f.roomId, 1)
    expect(error).toBeNull()

    const round = await readRound(f.roomId)
    expect(round.phase).toBe("reveal")
    expect(round.scored_at).not.toBeNull()

    const scores = await readScores(f.roomId)
    expect(scores[f.insiderId]).toBe(3)
    expect(scores[f.masterId]).toBe(0)
    expect(scores[f.playerAId]).toBe(0)
    expect(scores[f.playerBId]).toBe(0)
  })

  it("tied vote with Insider in tied set → caught (D2): Master+2, Commons+2, Insider+0", async () => {
    // 2 voted for Insider, 2 voted for playerA — tied at the top. Per D2
    // ('all tied counted as caught'), Insider is in the tied set → caught.
    const f = await createRound(ROOM_CODES.tiedCaught, { phase: "reveal" })

    await insertVote(f.roomId, f.masterId, f.insiderId)
    await insertVote(f.roomId, f.playerAId, f.insiderId)
    await insertVote(f.roomId, f.playerBId, f.playerAId)
    await insertVote(f.roomId, f.insiderId, f.playerAId)

    const { error } = await callAdvance(f.roomId, 1)
    expect(error).toBeNull()

    const round = await readRound(f.roomId)
    expect(round.phase).toBe("reveal")
    expect(round.scored_at).not.toBeNull()

    const scores = await readScores(f.roomId)
    expect(scores[f.masterId]).toBe(2)
    expect(scores[f.playerAId]).toBe(2)
    expect(scores[f.playerBId]).toBe(2)
    expect(scores[f.insiderId]).toBe(0)
  })

  it("called early (not all voted, deadline not passed) → no-op: phase stays 'voting', scored_at null, no scores applied", async () => {
    // Only 1 of 4 has voted, vote_deadline 60s in the future. advance_to_reveal
    // must NOT flip phase and must NOT compute scoring.
    const f = await createRound(ROOM_CODES.earlyNoop, { phase: "voting" })

    await insertVote(f.roomId, f.playerAId, f.insiderId)

    const { error } = await callAdvance(f.roomId, 1)
    expect(error).toBeNull()

    const round = await readRound(f.roomId)
    expect(round.phase).toBe("voting")
    expect(round.scored_at).toBeNull()

    const scores = await readScores(f.roomId)
    expect(scores[f.masterId]).toBe(0)
    expect(scores[f.insiderId]).toBe(0)
    expect(scores[f.playerAId]).toBe(0)
    expect(scores[f.playerBId]).toBe(0)
  })

  it("asking-phase timeout (result_failed via reconcile) → no scoring, scored_at stamped, phase stays 'result_failed'", async () => {
    // Asking phase, started 60s ago, time_limit_s=1. reconcile flips
    // asking→result_failed. advance_to_reveal then stamps scored_at without
    // applying any score updates (Time expired = everyone 0).
    const f = await createRound(ROOM_CODES.resultFailed, {
      phase: "asking",
      timeLimitS: 1,
      startedAtIso: new Date(Date.now() - 60 * 1000).toISOString(),
      voteDeadlineIso: null,
      eligible: "none",
    })

    const { error } = await callAdvance(f.roomId, 1)
    expect(error).toBeNull()

    const round = await readRound(f.roomId)
    expect(round.phase).toBe("result_failed")
    expect(round.scored_at).not.toBeNull()

    const scores = await readScores(f.roomId)
    expect(scores[f.masterId]).toBe(0)
    expect(scores[f.insiderId]).toBe(0)
    expect(scores[f.playerAId]).toBe(0)
    expect(scores[f.playerBId]).toBe(0)
  })

  it("vote deadline passed with zero votes → reveal + everyone 0 (Time expired)", async () => {
    // phase=voting, deadline -30s, no votes recorded at all. reconcile flips
    // voting→reveal; advance_to_reveal sees zero votes and stamps scored_at
    // without applying any score updates.
    const f = await createRound(ROOM_CODES.deadlineNoVotes, {
      phase: "voting",
      voteDeadlineIso: new Date(Date.now() - 30 * 1000).toISOString(),
    })

    const { error } = await callAdvance(f.roomId, 1)
    expect(error).toBeNull()

    const round = await readRound(f.roomId)
    expect(round.phase).toBe("reveal")
    expect(round.scored_at).not.toBeNull()

    const scores = await readScores(f.roomId)
    expect(scores[f.masterId]).toBe(0)
    expect(scores[f.insiderId]).toBe(0)
    expect(scores[f.playerAId]).toBe(0)
    expect(scores[f.playerBId]).toBe(0)
  })

  it("idempotent: calling advance_to_reveal twice does not double-apply scores", async () => {
    // Second call must early-return because scored_at is already stamped.
    const f = await createRound(ROOM_CODES.idempotent, { phase: "reveal" })

    await insertVote(f.roomId, f.masterId, f.insiderId)
    await insertVote(f.roomId, f.playerAId, f.insiderId)
    await insertVote(f.roomId, f.playerBId, f.insiderId)
    await insertVote(f.roomId, f.insiderId, f.playerAId)

    const { error: e1 } = await callAdvance(f.roomId, 1)
    expect(e1).toBeNull()

    const { error: e2 } = await callAdvance(f.roomId, 1)
    expect(e2).toBeNull()

    const scores = await readScores(f.roomId)
    expect(scores[f.masterId]).toBe(2)
    expect(scores[f.playerAId]).toBe(2)
    expect(scores[f.playerBId]).toBe(2)
    expect(scores[f.insiderId]).toBe(0)
  })
})
