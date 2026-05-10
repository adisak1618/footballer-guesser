import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"

// Integration test for migration 0037_reset_insider_game (issue #24).
// Requires `bunx supabase start`.
//
// Verifies the reset_insider_game(p_room_id, p_player_id) RPC:
//   - Host can reset between rounds (status=LOBBY, current_round>=1).
//   - Host can reset at end of game (status=PLAYING, phase ∈ reveal/result_failed).
//   - Non-host gets PGAME12.
//   - Rejected during preparing/asking/voting (active round).
//   - All per-round tables (game_insider_round, _roles, _votes, _responses)
//     are cleared; players.total_score zeroed; rooms.status='LOBBY' and
//     current_round=0; game_insider_room_config preserved.

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
  betweenRounds: "INS37A",
  endOfGame: "INS37B",
  nonHost: "INS37C",
  duringAsking: "INS37D",
  duringVoting: "INS37E",
  preserveConfig: "INS37F",
} as const

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

interface Fixture {
  roomId: string
  hostId: string
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
  status: "LOBBY" | "PLAYING"
  currentRound: number | null
  roundPhase?:
    | "preparing"
    | "asking"
    | "guessed"
    | "voting"
    | "reveal"
    | "result_failed"
  /** Insert votes + responses + roles too (for the cascade-cleanup test). */
  withFullState?: boolean
  /** Initial player.total_score values to verify zeroing. */
  initialScores?: { host: number; insider: number; a: number; b: number }
  packSlug?: string
  timeLimitS?: 180 | 300 | 420
  roundCount?: number
}

async function createRoom(code: string, args: RoomArgs): Promise<Fixture> {
  const hostId = crypto.randomUUID()
  const insiderId = crypto.randomUUID()
  const playerAId = crypto.randomUUID()
  const playerBId = crypto.randomUUID()
  const scores = args.initialScores ?? { host: 5, insider: 3, a: 2, b: 4 }

  const { data: room, error: roomErr } = await admin
    .from("rooms")
    .insert({
      code,
      max_rounds: 5,
      score_positions: 1,
      category: "premier-league",
      game_type: "insider",
      host_player_id: hostId,
      status: args.status,
      current_round: args.currentRound,
    })
    .select("id")
    .single()
  if (roomErr) throw roomErr

  const { error: pErr } = await admin.from("players").insert([
    { room_id: room.id, player_id: hostId, display_name: "H", join_order: 1, connected: true, total_score: scores.host },
    { room_id: room.id, player_id: insiderId, display_name: "I", join_order: 2, connected: true, total_score: scores.insider },
    { room_id: room.id, player_id: playerAId, display_name: "A", join_order: 3, connected: true, total_score: scores.a },
    { room_id: room.id, player_id: playerBId, display_name: "B", join_order: 4, connected: true, total_score: scores.b },
  ])
  if (pErr) throw pErr

  const { error: cfgErr } = await admin
    .from("game_insider_room_config")
    .insert({
      room_id: room.id,
      pack_slug: args.packSlug ?? PACK_SLUG,
      time_limit_s: args.timeLimitS ?? 300,
      round_count: args.roundCount ?? 5,
    })
  if (cfgErr) throw cfgErr

  if (args.roundPhase && args.currentRound) {
    const { error: rErr } = await admin.from("game_insider_round").insert({
      room_id: room.id,
      round_number: args.currentRound,
      pack_slug: PACK_SLUG,
      secret_value: "X",
      time_limit_s: 300,
      phase: args.roundPhase,
      started_at: new Date().toISOString(),
      vote_deadline: new Date(Date.now() + 60 * 1000).toISOString(),
      eligible_voter_ids: [hostId, insiderId, playerAId, playerBId],
    })
    if (rErr) throw rErr

    if (args.withFullState) {
      const { error: rolesErr } = await admin.from("game_insider_roles").insert([
        { room_id: room.id, round_number: args.currentRound, player_id: hostId, role: "master" },
        { room_id: room.id, round_number: args.currentRound, player_id: insiderId, role: "insider" },
        { room_id: room.id, round_number: args.currentRound, player_id: playerAId, role: "player" },
        { room_id: room.id, round_number: args.currentRound, player_id: playerBId, role: "player" },
      ])
      if (rolesErr) throw rolesErr

      const { error: vErr } = await admin.from("game_insider_votes").insert([
        { room_id: room.id, round_number: args.currentRound, voter_player_id: hostId, voted_player_id: insiderId },
        { room_id: room.id, round_number: args.currentRound, voter_player_id: playerAId, voted_player_id: insiderId },
      ])
      if (vErr) throw vErr
    }
  }

  return { roomId: room.id, hostId, insiderId, playerAId, playerBId }
}

async function readRoom(roomId: string) {
  const { data, error } = await admin
    .from("rooms")
    .select("status, current_round")
    .eq("id", roomId)
    .single()
  if (error) throw error
  return data as { status: string; current_round: number | null }
}

async function readScores(roomId: string): Promise<number[]> {
  const { data, error } = await admin
    .from("players")
    .select("total_score")
    .eq("room_id", roomId)
  if (error) throw error
  return (data ?? []).map((r) => r.total_score as number)
}

async function readConfig(roomId: string) {
  const { data, error } = await admin
    .from("game_insider_room_config")
    .select("pack_slug, time_limit_s, round_count")
    .eq("room_id", roomId)
    .single()
  if (error) throw error
  return data as {
    pack_slug: string
    time_limit_s: number
    round_count: number
  }
}

async function countRoundRows(roomId: string, table: string): Promise<number> {
  const { count, error } = await admin
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("room_id", roomId)
  if (error) throw error
  return count ?? 0
}

beforeAll(async () => {
  await cleanup()
})

afterAll(async () => {
  await cleanup()
})

describe("reset_insider_game (migration 0037) — issue #24", () => {
  it("host can reset between rounds; per-round tables cleared, scores zeroed, room shell reset", async () => {
    const f = await createRoom(ROOM_CODES.betweenRounds, {
      status: "LOBBY",
      currentRound: 2,
      roundPhase: "reveal",
      withFullState: true,
      initialScores: { host: 5, insider: 3, a: 2, b: 4 },
    })

    const { error } = await anon.rpc("reset_insider_game", {
      p_room_id: f.roomId,
      p_player_id: f.hostId,
    })
    expect(error).toBeNull()

    const room = await readRoom(f.roomId)
    expect(room.status).toBe("LOBBY")
    expect(room.current_round).toBe(0)

    const scores = await readScores(f.roomId)
    expect(scores).toEqual([0, 0, 0, 0])

    expect(await countRoundRows(f.roomId, "game_insider_round")).toBe(0)
    expect(await countRoundRows(f.roomId, "game_insider_roles")).toBe(0)
    expect(await countRoundRows(f.roomId, "game_insider_votes")).toBe(0)
    expect(await countRoundRows(f.roomId, "game_insider_responses")).toBe(0)
  })

  it("host can reset at end-of-game (PLAYING + phase=reveal on final round)", async () => {
    const f = await createRoom(ROOM_CODES.endOfGame, {
      status: "PLAYING",
      currentRound: 5,
      roundPhase: "reveal",
      withFullState: true,
    })

    const { error } = await anon.rpc("reset_insider_game", {
      p_room_id: f.roomId,
      p_player_id: f.hostId,
    })
    expect(error).toBeNull()

    const room = await readRoom(f.roomId)
    expect(room.status).toBe("LOBBY")
    expect(room.current_round).toBe(0)
  })

  it("non-host caller is rejected with PGAME12 / PG012", async () => {
    const f = await createRoom(ROOM_CODES.nonHost, {
      status: "LOBBY",
      currentRound: 1,
      roundPhase: "reveal",
    })

    const { error } = await anon.rpc("reset_insider_game", {
      p_room_id: f.roomId,
      p_player_id: f.insiderId,
    })
    expect(error).not.toBeNull()
    expect(error?.code).toBe("PG012")

    const room = await readRoom(f.roomId)
    expect(room.current_round).toBe(1)
  })

  it("rejected during 'asking' phase with PGAME13 / PG013", async () => {
    const f = await createRoom(ROOM_CODES.duringAsking, {
      status: "PLAYING",
      currentRound: 1,
      roundPhase: "asking",
    })

    const { error } = await anon.rpc("reset_insider_game", {
      p_room_id: f.roomId,
      p_player_id: f.hostId,
    })
    expect(error).not.toBeNull()
    expect(error?.code).toBe("PG013")
  })

  it("rejected during 'voting' phase with PGAME13 / PG013", async () => {
    const f = await createRoom(ROOM_CODES.duringVoting, {
      status: "PLAYING",
      currentRound: 1,
      roundPhase: "voting",
    })

    const { error } = await anon.rpc("reset_insider_game", {
      p_room_id: f.roomId,
      p_player_id: f.hostId,
    })
    expect(error?.code).toBe("PG013")
  })

  it("game_insider_room_config (pack_slug, time_limit_s, round_count) preserved across reset", async () => {
    const f = await createRoom(ROOM_CODES.preserveConfig, {
      status: "LOBBY",
      currentRound: 3,
      roundPhase: "reveal",
      packSlug: "football-la-liga",
      timeLimitS: 420,
      roundCount: 7,
    })

    const before = await readConfig(f.roomId)

    const { error } = await anon.rpc("reset_insider_game", {
      p_room_id: f.roomId,
      p_player_id: f.hostId,
    })
    expect(error).toBeNull()

    const after = await readConfig(f.roomId)
    expect(after.pack_slug).toBe(before.pack_slug)
    expect(after.time_limit_s).toBe(before.time_limit_s)
    expect(after.round_count).toBe(before.round_count)
    // max_rounds on rooms also preserved.
    const room = await admin
      .from("rooms")
      .select("max_rounds")
      .eq("id", f.roomId)
      .single()
    expect(room.data?.max_rounds).toBe(5)
  })
})
