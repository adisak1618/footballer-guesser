import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"

// Integration test (T-2.B / US-044). Requires `bunx supabase start` running locally.
//
// Verifies migration 0023 creates the `start_insider_round(p_room_id,
// p_pack_slug, p_time_limit_s, p_player_id)` SECURITY DEFINER RPC.
//
// Behavior:
//   1. Host-only authorization. Non-host → PGAME12 / SQLSTATE PG012.
//   2. Room must be in LOBBY status. Otherwise → PGAME13 / PG013.
//   3. Need at least 3 players in the room. Otherwise → PGAME14 / PG014.
//   4. Picks a secret via get_random_pack_item(p_pack_slug); inserts a new row
//      into game_insider_round (phase='preparing', round_number = next int).
//   5. Assigns roles randomly to the room's players: exactly 1 master, 1 insider,
//      (N-2) player rows in game_insider_roles for that (room, round).
//   6. Transitions rooms.status to 'PLAYING' and bumps current_round.
//   7. Returns the new round_number (int).

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
const TIME_LIMIT_S = 300

// Distinct rooms per scenario so each test starts from a clean LOBBY/player state.
const ROOM_CODES = {
  happy: "INS23A",
  nonHost: "INS23B",
  notLobby: "INS23C",
  tooFew: "INS23D",
} as const

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

interface RoomFixture {
  roomId: string
  hostId: string
  playerIds: string[]
}

async function cleanup(): Promise<void> {
  for (const code of Object.values(ROOM_CODES)) {
    await admin.from("rooms").delete().eq("code", code)
  }
}

async function createRoom(
  code: string,
  status: "LOBBY" | "PLAYING" | "ENDED",
  playerCount: number,
): Promise<RoomFixture> {
  const hostId = crypto.randomUUID()
  const { data: room, error: roomErr } = await admin
    .from("rooms")
    .insert({
      code,
      max_rounds: 5,
      score_positions: 4,
      category: "premier-league",
      game_type: "insider",
      host_player_id: hostId,
      status,
    })
    .select("id")
    .single()
  if (roomErr) throw roomErr

  const playerIds = [hostId]
  for (let i = 1; i < playerCount; i++) {
    playerIds.push(crypto.randomUUID())
  }

  if (playerCount > 0) {
    const rows = playerIds.map((pid, idx) => ({
      room_id: room.id,
      player_id: pid,
      display_name: `P${idx}`,
      join_order: idx + 1,
    }))
    const { error: pErr } = await admin.from("players").insert(rows)
    if (pErr) throw pErr
  }

  return { roomId: room.id, hostId, playerIds }
}

beforeAll(async () => {
  await cleanup()
})

afterAll(async () => {
  await cleanup()
})

describe("start_insider_round (migration 0023) — Phase 5a.7", () => {
  it("host call: inserts round + 1 master + 1 insider + (N-2) players, picks secret from pack, returns round_number, transitions room to PLAYING", async () => {
    const fixture = await createRoom(ROOM_CODES.happy, "LOBBY", 4)

    const { data, error } = await anon.rpc("start_insider_round", {
      p_room_id: fixture.roomId,
      p_pack_slug: PACK_SLUG,
      p_time_limit_s: TIME_LIMIT_S,
      p_player_id: fixture.hostId,
    })
    expect(error).toBeNull()
    expect(data).toBe(1)

    // Round row exists with phase='preparing' and secret from the pack.
    const { data: round, error: rErr } = await admin
      .from("game_insider_round")
      .select("phase, pack_slug, time_limit_s, secret_value, started_at")
      .eq("room_id", fixture.roomId)
      .eq("round_number", 1)
      .single()
    expect(rErr).toBeNull()
    expect(round?.phase).toBe("preparing")
    expect(round?.pack_slug).toBe(PACK_SLUG)
    expect(round?.time_limit_s).toBe(TIME_LIMIT_S)
    expect(round?.started_at).toBeNull()
    expect(typeof round?.secret_value).toBe("string")
    expect((round?.secret_value as string).length).toBeGreaterThan(0)

    // Secret must come from the football-premier-league pack.
    const { data: fp, error: fpErr } = await admin
      .from("football_players")
      .select("name")
      .eq("name", round?.secret_value as string)
      .limit(1)
    expect(fpErr).toBeNull()
    expect(fp?.length ?? 0).toBeGreaterThan(0)

    // Roles: exactly 1 master, 1 insider, (N-2) player; one row per current player; no duplicates.
    const { data: roles, error: rolesErr } = await admin
      .from("game_insider_roles")
      .select("player_id, role")
      .eq("room_id", fixture.roomId)
      .eq("round_number", 1)
    expect(rolesErr).toBeNull()
    expect(roles?.length).toBe(4)
    const counts = { master: 0, insider: 0, player: 0 }
    const seen = new Set<string>()
    for (const r of roles ?? []) {
      counts[r.role as keyof typeof counts]++
      seen.add(r.player_id as string)
    }
    expect(counts.master).toBe(1)
    expect(counts.insider).toBe(1)
    expect(counts.player).toBe(2)
    expect(seen.size).toBe(4)
    for (const pid of fixture.playerIds) {
      expect(seen.has(pid)).toBe(true)
    }

    // Room transitions to PLAYING with current_round=1.
    const { data: roomAfter, error: raErr } = await admin
      .from("rooms")
      .select("status, current_round")
      .eq("id", fixture.roomId)
      .single()
    expect(raErr).toBeNull()
    expect(roomAfter?.status).toBe("PLAYING")
    expect(roomAfter?.current_round).toBe(1)
  })

  it("non-host caller → errcode PGAME12 / SQLSTATE PG012", async () => {
    const fixture = await createRoom(ROOM_CODES.nonHost, "LOBBY", 3)
    const nonHostId = fixture.playerIds[1]

    const { error } = await anon.rpc("start_insider_round", {
      p_room_id: fixture.roomId,
      p_pack_slug: PACK_SLUG,
      p_time_limit_s: TIME_LIMIT_S,
      p_player_id: nonHostId,
    })
    expect(error).not.toBeNull()
    expect(error?.code).toBe("PG012")
    expect(error?.message ?? "").toMatch(/PGAME12/)

    // No round was inserted.
    const { data: rounds } = await admin
      .from("game_insider_round")
      .select("round_number")
      .eq("room_id", fixture.roomId)
    expect(rounds?.length ?? 0).toBe(0)
  })

  it("room not in LOBBY → errcode PGAME13 / SQLSTATE PG013", async () => {
    const fixture = await createRoom(ROOM_CODES.notLobby, "PLAYING", 3)

    const { error } = await anon.rpc("start_insider_round", {
      p_room_id: fixture.roomId,
      p_pack_slug: PACK_SLUG,
      p_time_limit_s: TIME_LIMIT_S,
      p_player_id: fixture.hostId,
    })
    expect(error).not.toBeNull()
    expect(error?.code).toBe("PG013")
    expect(error?.message ?? "").toMatch(/PGAME13/)
  })

  it("fewer than 3 players → errcode PGAME14 / SQLSTATE PG014", async () => {
    const fixture = await createRoom(ROOM_CODES.tooFew, "LOBBY", 2)

    const { error } = await anon.rpc("start_insider_round", {
      p_room_id: fixture.roomId,
      p_pack_slug: PACK_SLUG,
      p_time_limit_s: TIME_LIMIT_S,
      p_player_id: fixture.hostId,
    })
    expect(error).not.toBeNull()
    expect(error?.code).toBe("PG014")
    expect(error?.message ?? "").toMatch(/PGAME14/)

    // No round was inserted.
    const { data: rounds } = await admin
      .from("game_insider_round")
      .select("round_number")
      .eq("room_id", fixture.roomId)
    expect(rounds?.length ?? 0).toBe(0)
  })
})
