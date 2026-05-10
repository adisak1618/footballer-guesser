import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Page } from "@playwright/test"

// E2E fixture helpers (issue #24). The mid-game / end-of-game UI variants
// require state that takes 5+ minutes to reach via real gameplay (multiple
// rounds, voting, reveal). Instead we seed the DB directly via the admin
// (service_role) Supabase client and then navigate the page after stamping
// localStorage with the right player_id. This keeps the specs focused on UI
// surface, which is what the rubric asks for.

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321"

const LOCAL_SERVICE_ROLE_FALLBACK =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  "eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0." +
  "EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? LOCAL_SERVICE_ROLE_FALLBACK

export const PACK_DEFAULT = "football-premier-league"
export const PACK_ALT = "football-la-liga"

export interface RoomFixture {
  roomId: string
  code: string
  hostId: string
  insiderId: string
  playerAId: string
  playerBId: string
}

export interface SeedRoomArgs {
  code: string
  status: "LOBBY" | "PLAYING"
  currentRound: number
  maxRounds?: number
  packSlug?: string
  // Latest round phase. If set, also inserts game_insider_round +
  // (optionally) roles/votes for end-of-game scenarios.
  roundPhase?:
    | "preparing"
    | "asking"
    | "guessed"
    | "voting"
    | "reveal"
    | "result_failed"
  // If true, also seed roles + votes so the reveal-derived view (caught/
  // escaped) is meaningful.
  withRolesAndVotes?: boolean
  // Initial total_score values to verify reset zeroing.
  scores?: { host: number; insider: number; a: number; b: number }
}

export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function cleanupRoomByCode(code: string): Promise<void> {
  const admin = adminClient()
  await admin.from("rooms").delete().eq("code", code)
}

export async function seedRoom(args: SeedRoomArgs): Promise<RoomFixture> {
  const admin = adminClient()
  const hostId = crypto.randomUUID()
  const insiderId = crypto.randomUUID()
  const playerAId = crypto.randomUUID()
  const playerBId = crypto.randomUUID()
  const scores = args.scores ?? { host: 5, insider: 3, a: 8, b: 4 }
  const maxRounds = args.maxRounds ?? 3

  await cleanupRoomByCode(args.code)

  const { data: room, error: roomErr } = await admin
    .from("rooms")
    .insert({
      code: args.code,
      max_rounds: maxRounds,
      score_positions: 1,
      category: "premier-league",
      game_type: "insider",
      host_player_id: hostId,
      status: args.status,
      current_round: args.currentRound,
    })
    .select("id")
    .single()
  if (roomErr || !room) throw roomErr ?? new Error("seedRoom: insert failed")

  const { error: pErr } = await admin.from("players").insert([
    { room_id: room.id, player_id: hostId, display_name: "Host", join_order: 1, connected: true, total_score: scores.host },
    { room_id: room.id, player_id: insiderId, display_name: "Insider", join_order: 2, connected: true, total_score: scores.insider },
    { room_id: room.id, player_id: playerAId, display_name: "Alice", join_order: 3, connected: true, total_score: scores.a },
    { room_id: room.id, player_id: playerBId, display_name: "Bob", join_order: 4, connected: true, total_score: scores.b },
  ])
  if (pErr) throw pErr

  const { error: cfgErr } = await admin
    .from("game_insider_room_config")
    .insert({
      room_id: room.id,
      pack_slug: args.packSlug ?? PACK_DEFAULT,
      time_limit_s: 300,
      round_count: maxRounds,
    })
  if (cfgErr) throw cfgErr

  if (args.roundPhase && args.currentRound) {
    const { error: rErr } = await admin.from("game_insider_round").insert({
      room_id: room.id,
      round_number: args.currentRound,
      pack_slug: args.packSlug ?? PACK_DEFAULT,
      secret_value: "FERNANDO TORRES",
      time_limit_s: 300,
      phase: args.roundPhase,
      started_at: new Date().toISOString(),
      vote_deadline: new Date(Date.now() + 60 * 1000).toISOString(),
      eligible_voter_ids: [hostId, insiderId, playerAId, playerBId],
    })
    if (rErr) throw rErr

    if (args.withRolesAndVotes) {
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

  return { roomId: room.id, code: args.code, hostId, insiderId, playerAId, playerBId }
}

// Set localStorage player_id BEFORE the lobby's first React render. The lobby
// reads readPlayerId() from `insider_player_id` (storage-key convention is
// `${namespace}_player_id` — see packages/core/src/player-id.ts).
export async function asPlayer(page: Page, playerId: string): Promise<void> {
  await page.addInitScript((pid: string) => {
    window.localStorage.setItem("insider_player_id", pid)
  }, playerId)
}
