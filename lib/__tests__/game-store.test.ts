import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { Player, Room, RoundState } from "@/lib/types"
import {
  PLAYER_ID_STORAGE_KEY,
  getOrCreatePlayerId,
  readPlayerId,
  useGameStore,
} from "@/lib/game-store"

const HOST_PLAYER_ID = "11111111-1111-4111-8111-111111111111"
const GUEST_PLAYER_ID = "22222222-2222-4222-8222-222222222222"

function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    code: "ABCDEF",
    status: "LOBBY",
    category: "premier-league",
    max_rounds: 5,
    score_positions: 3,
    current_round: 0,
    host_player_id: HOST_PLAYER_ID,
    created_at: "2026-04-30T00:00:00Z",
    ...overrides,
  } as Room
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "00000000-0000-4000-8000-000000000010",
    room_id: "00000000-0000-4000-8000-000000000001",
    player_id: HOST_PLAYER_ID,
    display_name: "Host",
    join_order: 1,
    total_score: 0,
    joined_at: "2026-04-30T00:00:00Z",
    ...overrides,
  } as Player
}

function makeRoundStateRow(overrides: Partial<RoundState> = {}): RoundState {
  return {
    id: "00000000-0000-4000-8000-000000000020",
    room_id: "00000000-0000-4000-8000-000000000001",
    round_number: 1,
    player_id: HOST_PLAYER_ID,
    name_to_guess: "MOHAMED SALAH",
    score_this_round: 0,
    is_active: true,
    final_position: null,
    ...overrides,
  } as RoundState
}

beforeEach(() => {
  window.localStorage.removeItem(PLAYER_ID_STORAGE_KEY)
  useGameStore.getState().reset()
})

afterEach(() => {
  window.localStorage.removeItem(PLAYER_ID_STORAGE_KEY)
  useGameStore.getState().reset()
})

describe("useGameStore", () => {
  it("initial state is empty", () => {
    const state = useGameStore.getState()
    expect(state.room).toBeNull()
    expect(state.players).toEqual([])
    expect(state.me).toBeNull()
    expect(state.currentRound).toBe(0)
    expect(state.roundState).toEqual([])
    expect(state.totalScores).toEqual({})
    expect(state.connectionStatus).toBe("IDLE")
    expect(state.error).toBeNull()
  })

  it("setRoom stores the room and syncs currentRound", () => {
    const room = makeRoom({ status: "PLAYING", current_round: 2 })
    useGameStore.getState().setRoom(room)
    const state = useGameStore.getState()
    expect(state.room).toEqual(room)
    expect(state.currentRound).toBe(2)
  })

  it("setPlayers updates the list, derives totalScores, and refreshes me", () => {
    useGameStore.getState().setMe(makePlayer({ total_score: 0 }))
    const players = [
      makePlayer({ player_id: HOST_PLAYER_ID, total_score: 7 }),
      makePlayer({
        id: "00000000-0000-4000-8000-000000000011",
        player_id: GUEST_PLAYER_ID,
        join_order: 2,
        display_name: "Guest",
        total_score: 4,
      }),
    ]
    useGameStore.getState().setPlayers(players)
    const state = useGameStore.getState()
    expect(state.players).toHaveLength(2)
    expect(state.totalScores).toEqual({
      [HOST_PLAYER_ID]: 7,
      [GUEST_PLAYER_ID]: 4,
    })
    expect(state.me?.player_id).toBe(HOST_PLAYER_ID)
    expect(state.me?.total_score).toBe(7)
  })

  it("setRoundState replaces the round_state list", () => {
    const rows = [makeRoundStateRow()]
    useGameStore.getState().setRoundState(rows)
    expect(useGameStore.getState().roundState).toEqual(rows)
  })

  it("setConnectionStatus + setError + reset restore initial state", () => {
    useGameStore.getState().setConnectionStatus("SUBSCRIBED")
    useGameStore.getState().setError({ message: "boom" })
    expect(useGameStore.getState().connectionStatus).toBe("SUBSCRIBED")
    expect(useGameStore.getState().error).toEqual({ message: "boom" })
    useGameStore.getState().reset()
    expect(useGameStore.getState().connectionStatus).toBe("IDLE")
    expect(useGameStore.getState().error).toBeNull()
  })
})

describe("getOrCreatePlayerId", () => {
  it("generates and persists a UUID on first read", () => {
    expect(window.localStorage.getItem(PLAYER_ID_STORAGE_KEY)).toBeNull()
    const id = getOrCreatePlayerId()
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
    expect(window.localStorage.getItem(PLAYER_ID_STORAGE_KEY)).toBe(id)
  })

  it("returns the same id on subsequent reads", () => {
    const first = getOrCreatePlayerId()
    const second = getOrCreatePlayerId()
    expect(second).toBe(first)
    expect(readPlayerId()).toBe(first)
  })

  it("readPlayerId returns null when nothing is stored", () => {
    expect(readPlayerId()).toBeNull()
  })
})
