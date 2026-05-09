/**
 * Cross-game shared types.
 *
 * These types describe the subset of room/player shape that is common across
 * every game on the platform (headball, insider, future). Game-specific
 * columns (e.g. headball's `category`, `score_positions`, `total_score`) live
 * in each app's own `lib/types.ts`.
 *
 * The auto-generated Supabase `Database` type lives in `./database.types.ts`
 * (regenerated via `bunx supabase gen types typescript --local > packages/types/src/database.types.ts`).
 */

export type { Database, Json } from "./database.types"

export type GameType = "headball" | "insider"

export type RoomStatus = "LOBBY" | "PLAYING" | "ENDED"

export interface Room {
  id: string
  code: string
  status: RoomStatus | null
  host_player_id: string | null
  created_at: string | null
}

export interface Player {
  id: string
  room_id: string | null
  player_id: string
  display_name: string
  join_order: number
  connected: boolean | null
}
