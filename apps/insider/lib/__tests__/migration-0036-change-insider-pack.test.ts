import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"

// Integration test for migration 0036_change_insider_pack (issue #24).
// Requires `bunx supabase start`.
//
// Verifies the change_insider_pack(p_room_id, p_player_id, p_pack_slug) RPC:
//   - Host can change pack between rounds (status=LOBBY, current_round>=1).
//   - Non-host gets PGAME12.
//   - PGAME20 on a disabled or non-existent pack.
//   - Rejected during 'asking' phase (latest round phase guard).
//   - Rejected for initial-lobby state (current_round = 0 / IS NULL).

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

const PACK_SLUG_DEFAULT = "football-premier-league"
const PACK_SLUG_ALT = "football-la-liga"
const PACK_SLUG_DISABLED = "headball-test-disabled-pack-0036"

const ROOM_CODES = {
  betweenHost: "INS36A",
  nonHost: "INS36B",
  initialLobby: "INS36C",
  duringAsking: "INS36D",
  disabledPack: "INS36E",
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
  otherId: string
}

async function cleanup(): Promise<void> {
  for (const code of Object.values(ROOM_CODES)) {
    await admin.from("rooms").delete().eq("code", code)
  }
  // Clean the test-only disabled pack we may have inserted.
  await admin.from("content_packs").delete().eq("slug", PACK_SLUG_DISABLED)
}

interface RoomArgs {
  status: "LOBBY" | "PLAYING"
  currentRound: number | null
  // If set, also insert a game_insider_round row at this phase.
  roundPhase?:
    | "preparing"
    | "asking"
    | "guessed"
    | "voting"
    | "reveal"
    | "result_failed"
}

async function createRoom(code: string, args: RoomArgs): Promise<Fixture> {
  const hostId = crypto.randomUUID()
  const otherId = crypto.randomUUID()

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
    {
      room_id: room.id,
      player_id: hostId,
      display_name: "H",
      join_order: 1,
      connected: true,
      total_score: 0,
    },
    {
      room_id: room.id,
      player_id: otherId,
      display_name: "O",
      join_order: 2,
      connected: true,
      total_score: 0,
    },
  ])
  if (pErr) throw pErr

  const { error: cfgErr } = await admin
    .from("game_insider_room_config")
    .insert({
      room_id: room.id,
      pack_slug: PACK_SLUG_DEFAULT,
      time_limit_s: 300,
      round_count: 5,
    })
  if (cfgErr) throw cfgErr

  if (args.roundPhase && args.currentRound) {
    const { error: rErr } = await admin.from("game_insider_round").insert({
      room_id: room.id,
      round_number: args.currentRound,
      pack_slug: PACK_SLUG_DEFAULT,
      secret_value: "X",
      time_limit_s: 300,
      phase: args.roundPhase,
      started_at: new Date().toISOString(),
      vote_deadline: new Date(Date.now() + 60 * 1000).toISOString(),
      eligible_voter_ids: [hostId, otherId],
    })
    if (rErr) throw rErr
  }

  return { roomId: room.id, hostId, otherId }
}

async function readPack(roomId: string): Promise<string | null> {
  const { data, error } = await admin
    .from("game_insider_room_config")
    .select("pack_slug")
    .eq("room_id", roomId)
    .single()
  if (error) throw error
  return data.pack_slug as string
}

beforeAll(async () => {
  await cleanup()
})

afterAll(async () => {
  await cleanup()
})

describe("change_insider_pack (migration 0036) — issue #24", () => {
  it("host can change pack between rounds", async () => {
    const f = await createRoom(ROOM_CODES.betweenHost, {
      status: "LOBBY",
      currentRound: 1,
      roundPhase: "reveal",
    })

    const { error } = await anon.rpc("change_insider_pack", {
      p_room_id: f.roomId,
      p_player_id: f.hostId,
      p_pack_slug: PACK_SLUG_ALT,
    })
    expect(error).toBeNull()

    const after = await readPack(f.roomId)
    expect(after).toBe(PACK_SLUG_ALT)
  })

  it("non-host caller is rejected with PGAME12 / PG012", async () => {
    const f = await createRoom(ROOM_CODES.nonHost, {
      status: "LOBBY",
      currentRound: 1,
      roundPhase: "reveal",
    })

    const { error } = await anon.rpc("change_insider_pack", {
      p_room_id: f.roomId,
      p_player_id: f.otherId,
      p_pack_slug: PACK_SLUG_ALT,
    })
    expect(error).not.toBeNull()
    expect(error?.code).toBe("PG012")
    expect(error?.message ?? "").toMatch(/PGAME12/)

    // Pack unchanged.
    expect(await readPack(f.roomId)).toBe(PACK_SLUG_DEFAULT)
  })

  it("initial-lobby state (current_round = 0) is now accepted (issue #27)", async () => {
    // Issue #27 — the /new host-setup screen is deleted; the initial lobby is
    // now the canonical place to pick the category. Migration 0038 widens
    // change_insider_pack to accept status=LOBBY regardless of current_round.
    const f = await createRoom(ROOM_CODES.initialLobby, {
      status: "LOBBY",
      currentRound: 0,
    })

    const { error } = await anon.rpc("change_insider_pack", {
      p_room_id: f.roomId,
      p_player_id: f.hostId,
      p_pack_slug: PACK_SLUG_ALT,
    })
    expect(error).toBeNull()
    expect(await readPack(f.roomId)).toBe(PACK_SLUG_ALT)
  })

  it("active 'asking' phase is rejected with PGAME13 / PG013", async () => {
    const f = await createRoom(ROOM_CODES.duringAsking, {
      status: "PLAYING",
      currentRound: 1,
      roundPhase: "asking",
    })

    const { error } = await anon.rpc("change_insider_pack", {
      p_room_id: f.roomId,
      p_player_id: f.hostId,
      p_pack_slug: PACK_SLUG_ALT,
    })
    expect(error).not.toBeNull()
    expect(error?.code).toBe("PG013")
    expect(await readPack(f.roomId)).toBe(PACK_SLUG_DEFAULT)
  })

  it("disabled pack is rejected with PGAME20 / PG020", async () => {
    // Insert a disabled pack so the existence-check fails the enabled gate.
    await admin.from("content_packs").insert({
      slug: PACK_SLUG_DISABLED,
      display_name: "Disabled Test Pack",
      handler: "word_list",
      source_ref: "test-only",
      enabled: false,
    })

    const f = await createRoom(ROOM_CODES.disabledPack, {
      status: "LOBBY",
      currentRound: 1,
      roundPhase: "reveal",
    })

    const { error } = await anon.rpc("change_insider_pack", {
      p_room_id: f.roomId,
      p_player_id: f.hostId,
      p_pack_slug: PACK_SLUG_DISABLED,
    })
    expect(error).not.toBeNull()
    expect(error?.code).toBe("PG020")
    expect(await readPack(f.roomId)).toBe(PACK_SLUG_DEFAULT)

    // Bogus slug also rejected with PGAME20.
    const { error: err2 } = await anon.rpc("change_insider_pack", {
      p_room_id: f.roomId,
      p_player_id: f.hostId,
      p_pack_slug: "this-pack-does-not-exist-0036",
    })
    expect(err2?.code).toBe("PG020")
  })
})
