import { create } from "zustand"
import type { Player, Room, RoundState } from "@/lib/types"

export const PLAYER_ID_STORAGE_KEY = "headball_player_id"

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

function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function getOrCreatePlayerId(): string {
  if (typeof window === "undefined") {
    throw new Error("getOrCreatePlayerId must be called on the client")
  }
  const existing = window.localStorage.getItem(PLAYER_ID_STORAGE_KEY)
  if (existing) return existing
  const next = generateUuid()
  window.localStorage.setItem(PLAYER_ID_STORAGE_KEY, next)
  return next
}

export function readPlayerId(): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(PLAYER_ID_STORAGE_KEY)
}
