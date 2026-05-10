import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"

// US-070 — Phase 5c.5: Common attempts master_respond → rejected.
//
// Story-focused regression test: a Common player calls master_respond
// directly (bypassing UI). The server must reject with PGAME15 / PG015
// ("only master can respond" — role-denied), and no row is appended to
// game_insider_responses. Verifies the role-based access discipline of
// migration 0024 from the Common player's POV, complementing the broader
// migration-0024 unit test (which exercises insider + player together).
//
// Requires `bunx supabase start`.

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
const ROOM_CODE = "INS70A"

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
  common1Id: string
  common2Id: string
}

async function cleanup(): Promise<void> {
  await admin.from("rooms").delete().eq("code", ROOM_CODE)
}

async function buildAskingRoom(): Promise<Fixture> {
  const masterId = crypto.randomUUID()
  const insiderId = crypto.randomUUID()
  const common1Id = crypto.randomUUID()
  const common2Id = crypto.randomUUID()

  const { data: room, error: roomErr } = await admin
    .from("rooms")
    .insert({
      code: ROOM_CODE,
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
    { room_id: room.id, player_id: common1Id, display_name: "C1", join_order: 3 },
    { room_id: room.id, player_id: common2Id, display_name: "C2", join_order: 4 },
  ])
  if (pErr) throw pErr

  const { error: rErr } = await admin.from("game_insider_round").insert({
    room_id: room.id,
    round_number: 1,
    pack_slug: PACK_SLUG,
    secret_value: "X",
    time_limit_s: 300,
    phase: "asking",
    started_at: new Date().toISOString(),
  })
  if (rErr) throw rErr

  const { error: rolesErr } = await admin.from("game_insider_roles").insert([
    { room_id: room.id, round_number: 1, player_id: masterId, role: "master" },
    { room_id: room.id, round_number: 1, player_id: insiderId, role: "insider" },
    { room_id: room.id, round_number: 1, player_id: common1Id, role: "player" },
    { room_id: room.id, round_number: 1, player_id: common2Id, role: "player" },
  ])
  if (rolesErr) throw rolesErr

  return { roomId: room.id, masterId, insiderId, common1Id, common2Id }
}

beforeAll(async () => {
  await cleanup()
})

afterAll(async () => {
  await cleanup()
})

// Issue #16 — master_respond RPC deprecated; skipped pending follow-up RPC drop.
describe.skip("US-070 — Common attempts master_respond → rejected (Phase 5c.5) [DEPRECATED #16]", () => {
  it("Common player's direct RPC call is rejected with PGAME15 (role_denied) and no response is recorded", async () => {
    const f = await buildAskingRoom()

    // Common player (role='player') tries to act as Master.
    const { error } = await anon.rpc("master_respond", {
      p_room_id: f.roomId,
      p_round: 1,
      p_player_id: f.common1Id,
      p_response: "yes",
    })

    expect(error).not.toBeNull()
    expect(error?.code).toBe("PG015")
    expect(error?.message ?? "").toMatch(/PGAME15/)
    expect(error?.message ?? "").toMatch(/only master can respond/)

    // Confirm no response row was appended (server-side enforcement, not just
    // an error surface).
    const { data: rows, error: rowsErr } = await admin
      .from("game_insider_responses")
      .select("id")
      .eq("room_id", f.roomId)
      .eq("round_number", 1)
    expect(rowsErr).toBeNull()
    expect(rows?.length ?? 0).toBe(0)

    // Phase remains 'asking' — the rejection is pure auth, no side effects.
    const { data: round } = await admin
      .from("game_insider_round")
      .select("phase")
      .eq("room_id", f.roomId)
      .eq("round_number", 1)
      .single()
    expect(round?.phase).toBe("asking")

    // Sanity baseline: the SAME RPC, same room, same phase, called by the
    // Master succeeds. Proves the rejection above is role-driven, not
    // schema- or fixture-driven.
    const { error: masterErr } = await anon.rpc("master_respond", {
      p_room_id: f.roomId,
      p_round: 1,
      p_player_id: f.masterId,
      p_response: "yes",
    })
    expect(masterErr).toBeNull()

    const { data: rowsAfter } = await admin
      .from("game_insider_responses")
      .select("response")
      .eq("room_id", f.roomId)
      .eq("round_number", 1)
    expect(rowsAfter?.map((r) => r.response)).toEqual(["yes"])
  })
})
