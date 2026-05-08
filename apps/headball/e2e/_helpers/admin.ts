import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321"

// Stable demo service-role JWT for `supabase start` local stacks.
// NOT a secret — local-only, identical across every developer machine.
const LOCAL_SERVICE_ROLE_FALLBACK =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  "eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0." +
  "EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? LOCAL_SERVICE_ROLE_FALLBACK

let cached: SupabaseClient<Database> | null = null

export function adminClient(): SupabaseClient<Database> {
  if (!cached) {
    cached = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return cached
}

export async function setMaxRounds(code: string, maxRounds: number): Promise<void> {
  const sb = adminClient()
  const { error } = await sb
    .from("rooms")
    .update({ max_rounds: maxRounds })
    .eq("code", code)
  if (error) throw new Error(`setMaxRounds failed: ${error.message}`)
}

export async function getRoomIdByCode(code: string): Promise<string> {
  const sb = adminClient()
  const { data, error } = await sb
    .from("rooms")
    .select("id")
    .eq("code", code)
    .maybeSingle()
  if (error || !data) throw new Error(`room ${code} not found: ${error?.message}`)
  return data.id
}

export async function getAssignedNameForDisplayName(
  code: string,
  displayName: string,
  roundNumber: number,
): Promise<string> {
  const sb = adminClient()
  const roomId = await getRoomIdByCode(code)

  const { data: player, error: playerErr } = await sb
    .from("players")
    .select("player_id")
    .eq("room_id", roomId)
    .eq("display_name", displayName)
    .maybeSingle()
  if (playerErr || !player) {
    throw new Error(
      `player ${displayName} not found in room ${code}: ${playerErr?.message}`,
    )
  }

  const { data: rs, error: rsErr } = await sb
    .from("round_state")
    .select("assigned_name")
    .eq("room_id", roomId)
    .eq("player_id", player.player_id)
    .eq("round_number", roundNumber)
    .maybeSingle()
  if (rsErr || !rs) {
    throw new Error(
      `round_state for ${displayName} round ${roundNumber} not found: ${rsErr?.message}`,
    )
  }

  return rs.assigned_name
}

export async function getRoundStateForPlayer(
  roomId: string,
  playerId: string,
  roundNumber: number,
): Promise<{ is_correct: boolean | null; score_this_round: number | null }> {
  const sb = adminClient()
  const { data, error } = await sb
    .from("round_state")
    .select("is_correct, score_this_round")
    .eq("room_id", roomId)
    .eq("player_id", playerId)
    .eq("round_number", roundNumber)
    .maybeSingle()
  if (error || !data) {
    throw new Error(
      `round_state for player ${playerId} round ${roundNumber} not found: ${error?.message}`,
    )
  }
  return data
}

export async function getAssignedNameByPlayerId(
  roomId: string,
  playerId: string,
  roundNumber: number,
): Promise<string> {
  const sb = adminClient()
  const { data, error } = await sb
    .from("round_state")
    .select("assigned_name")
    .eq("room_id", roomId)
    .eq("player_id", playerId)
    .eq("round_number", roundNumber)
    .maybeSingle()
  if (error || !data) {
    throw new Error(
      `round_state for player ${playerId} round ${roundNumber} not found: ${error?.message}`,
    )
  }
  return data.assigned_name
}
