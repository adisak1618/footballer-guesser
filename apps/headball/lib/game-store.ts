import { create } from "zustand"
import {
  getOrCreatePlayerId as coreGetOrCreatePlayerId,
  readPlayerId as coreReadPlayerId,
} from "@social-hub/core"
import type { Player, Room, RoundState } from "@/lib/types"

const PLAYER_ID_NAMESPACE = "headball"
export const PLAYER_ID_STORAGE_KEY = `${PLAYER_ID_NAMESPACE}_player_id`

export type ConnectionStatus = "IDLE" | "CONNECTING" | "SUBSCRIBED" | "DISCONNECTED"

export type GameError = { message: string; code?: string } | null

export interface GameState {
  room: Room | null
  players: Player[]
  me: Player | null
  currentRound: number
  roundState: RoundState[]
  totalScores: Record<string, number>
  connectionStatus: ConnectionStatus
  error: GameError
  setRoom: (room: Room | null) => void
  setPlayers: (players: Player[]) => void
  setMe: (me: Player | null) => void
  setCurrentRound: (round: number) => void
  setRoundState: (rows: RoundState[]) => void
  setConnectionStatus: (status: ConnectionStatus) => void
  setError: (error: GameError) => void
  reset: () => void
}

const initialState = {
  room: null,
  players: [],
  me: null,
  currentRound: 0,
  roundState: [],
  totalScores: {},
  connectionStatus: "IDLE" as ConnectionStatus,
  error: null,
}

function deriveTotalScores(players: Player[]): Record<string, number> {
  const scores: Record<string, number> = {}
  for (const p of players) {
    scores[p.player_id] = p.total_score ?? 0
  }
  return scores
}

export const useGameStore = create<GameState>((set) => ({
  ...initialState,
  setRoom: (room) =>
    set((state) => ({
      room,
      currentRound: room?.current_round ?? state.currentRound,
    })),
  setPlayers: (players) =>
    set((state) => ({
      players,
      me: state.me
        ? (players.find((p) => p.player_id === state.me!.player_id) ?? state.me)
        : state.me,
      totalScores: deriveTotalScores(players),
    })),
  setMe: (me) => set({ me }),
  setCurrentRound: (currentRound) => set({ currentRound }),
  setRoundState: (roundState) => set({ roundState }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  setError: (error) => set({ error }),
  reset: () => set({ ...initialState }),
}))

export function getOrCreatePlayerId(): string {
  return coreGetOrCreatePlayerId(PLAYER_ID_NAMESPACE)
}

export function readPlayerId(): string | null {
  return coreReadPlayerId(PLAYER_ID_NAMESPACE)
}
