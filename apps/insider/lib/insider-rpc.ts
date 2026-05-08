import type { SupabaseClient } from "@supabase/supabase-js"
import { createRoomWithRetry, dispatch } from "@social-hub/core"

// TS wrappers for the Insider Postgres RPCs (US-050 / Phase 5a.13).
//
// Each wrapper:
//   1. Accepts a camelCase args object so app code stays idiomatic.
//   2. Translates to the snake_case `p_*` argument shape PostgREST expects.
//   3. Goes through `dispatch()` from `@social-hub/core` so PG errors surface
//      as `GameRpcError` with the parsed SQLSTATE in `error.code` (matchable
//      against PG011/PG015/etc — see `packages/core/error-codes.md`).
//
// Args/result types are call-site explicit. The wrappers themselves accept the
// default-typed `SupabaseClient` (Database = any) per the packages/core
// convention — apps can call them with their own typed client and the args
// shape provides the type safety end-to-end.

export interface AdvanceToAskingArgs {
  roomId: string
  round: number
  playerId: string
}

export async function advanceToAsking(
  supabase: SupabaseClient,
  args: AdvanceToAskingArgs,
): Promise<void> {
  await dispatch<Record<string, unknown>, void>(
    supabase,
    "advance_to_asking",
    {
      p_room_id: args.roomId,
      p_round: args.round,
      p_player_id: args.playerId,
    },
  )
}

export interface StartInsiderRoundArgs {
  roomId: string
  packSlug: string
  timeLimitS: number
  playerId: string
}

export async function startInsiderRound(
  supabase: SupabaseClient,
  args: StartInsiderRoundArgs,
): Promise<number> {
  return dispatch<Record<string, unknown>, number>(
    supabase,
    "start_insider_round",
    {
      p_room_id: args.roomId,
      p_pack_slug: args.packSlug,
      p_time_limit_s: args.timeLimitS,
      p_player_id: args.playerId,
    },
  )
}

export type MasterResponse = "yes" | "no" | "unsure"

export interface MasterRespondArgs {
  roomId: string
  round: number
  playerId: string
  response: MasterResponse
}

export async function masterRespond(
  supabase: SupabaseClient,
  args: MasterRespondArgs,
): Promise<void> {
  await dispatch<Record<string, unknown>, void>(supabase, "master_respond", {
    p_room_id: args.roomId,
    p_round: args.round,
    p_player_id: args.playerId,
    p_response: args.response,
  })
}

export interface MarkCorrectGuessArgs {
  roomId: string
  round: number
  playerId: string
}

export async function markCorrectGuess(
  supabase: SupabaseClient,
  args: MarkCorrectGuessArgs,
): Promise<void> {
  await dispatch<Record<string, unknown>, void>(
    supabase,
    "mark_correct_guess",
    {
      p_room_id: args.roomId,
      p_round: args.round,
      p_player_id: args.playerId,
    },
  )
}

export interface ExpireRoundArgs {
  roomId: string
  round: number
}

export async function expireRound(
  supabase: SupabaseClient,
  args: ExpireRoundArgs,
): Promise<number> {
  return dispatch<Record<string, unknown>, number>(supabase, "expire_round", {
    p_room_id: args.roomId,
    p_round: args.round,
  })
}

export interface CastVoteArgs {
  roomId: string
  round: number
  playerId: string
  votedPlayerId: string
}

export async function castVote(
  supabase: SupabaseClient,
  args: CastVoteArgs,
): Promise<void> {
  await dispatch<Record<string, unknown>, void>(supabase, "cast_vote", {
    p_room_id: args.roomId,
    p_round: args.round,
    p_player_id: args.playerId,
    p_voted_player_id: args.votedPlayerId,
  })
}

export interface AdvanceToRevealArgs {
  roomId: string
  round: number
}

export async function advanceToReveal(
  supabase: SupabaseClient,
  args: AdvanceToRevealArgs,
): Promise<void> {
  await dispatch<Record<string, unknown>, void>(
    supabase,
    "advance_to_reveal",
    {
      p_room_id: args.roomId,
      p_round: args.round,
    },
  )
}

export interface GetMyInsiderSecretArgs {
  roomId: string
  round: number
  playerId: string
}

export async function getMyInsiderSecret(
  supabase: SupabaseClient,
  args: GetMyInsiderSecretArgs,
): Promise<string> {
  return dispatch<Record<string, unknown>, string>(
    supabase,
    "get_my_insider_secret",
    {
      p_room_id: args.roomId,
      p_round: args.round,
      p_player_id: args.playerId,
    },
  )
}

export interface CreateInsiderRoomArgs {
  packSlug: string
  timeLimitS: number
  roundCount: number
  hostName: string
  hostPlayerId: string
}

export interface CreateInsiderRoomResult {
  code: string
  playerId: string
}

interface RawCreateInsiderRoomRow {
  code: string
  player_id: string
}

export async function createInsiderRoom(
  supabase: SupabaseClient,
  args: CreateInsiderRoomArgs,
): Promise<CreateInsiderRoomResult> {
  const row = await createRoomWithRetry<
    Record<string, unknown>,
    RawCreateInsiderRoomRow
  >(
    supabase,
    {
      p_pack_slug: args.packSlug,
      p_time_limit_s: args.timeLimitS,
      p_round_count: args.roundCount,
      p_host_name: args.hostName,
      p_host_player_id: args.hostPlayerId,
    },
    { rpcName: "create_insider_room" },
  )
  return { code: row.code, playerId: row.player_id }
}

export interface ReconcileRoundPhaseArgs {
  roomId: string
  round: number
}

export async function reconcileRoundPhase(
  supabase: SupabaseClient,
  args: ReconcileRoundPhaseArgs,
): Promise<void> {
  await dispatch<Record<string, unknown>, void>(
    supabase,
    "reconcile_round_phase",
    {
      p_room_id: args.roomId,
      p_round: args.round,
    },
  )
}
