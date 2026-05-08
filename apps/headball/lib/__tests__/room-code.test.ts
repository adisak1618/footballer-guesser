import { describe, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  ROOM_CODE_MAX_RETRIES,
  RoomCodeCollisionError,
  createRoomWithRetry,
  generateRoomCode,
} from "@/lib/room-code"

describe("generateRoomCode", () => {
  it("produces a 6-char string", () => {
    const code = generateRoomCode()
    expect(code).toHaveLength(ROOM_CODE_LENGTH)
  })

  it("uses only chars from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode()
      for (const ch of code) {
        expect(ROOM_CODE_ALPHABET).toContain(ch)
      }
    }
  })

  it("excludes ambiguous characters 0/O/1/I", () => {
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[0O1I]/)
    for (let i = 0; i < 200; i++) {
      expect(generateRoomCode()).not.toMatch(/[0O1I]/)
    }
  })
})

type CreateRoomArgs = Parameters<typeof createRoomWithRetry>[1]

const validArgs: CreateRoomArgs = {
  p_max_rounds: 5,
  p_score_positions: 3,
  p_host_name: "Host",
  p_host_player_id: "00000000-0000-4000-8000-000000000000",
}

function makeMockSupabase(rpcImpl: (name: string, args: unknown) => unknown) {
  return { rpc: vi.fn(rpcImpl) } as unknown as SupabaseClient<Database>
}

describe("createRoomWithRetry", () => {
  it("returns the first successful row without retry", async () => {
    const row = { code: "ABCDEF", player_id: validArgs.p_host_player_id }
    const supabase = makeMockSupabase(() =>
      Promise.resolve({ data: [row], error: null }),
    )
    const result = await createRoomWithRetry(supabase, validArgs)
    expect(result).toEqual(row)
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    expect(supabase.rpc).toHaveBeenCalledWith("create_room", validArgs)
  })

  it("retries on Postgres unique-violation (23505) up to maxRetries then throws RoomCodeCollisionError", async () => {
    const supabase = makeMockSupabase(() =>
      Promise.resolve({ data: null, error: { code: "23505", message: "dup" } }),
    )
    await expect(createRoomWithRetry(supabase, validArgs)).rejects.toBeInstanceOf(
      RoomCodeCollisionError,
    )
    expect(supabase.rpc).toHaveBeenCalledTimes(ROOM_CODE_MAX_RETRIES)
  })

  it("succeeds on a later attempt after earlier collisions", async () => {
    let calls = 0
    const row = { code: "QQQQQQ", player_id: validArgs.p_host_player_id }
    const supabase = makeMockSupabase(() => {
      calls += 1
      if (calls < 3) {
        return Promise.resolve({ data: null, error: { code: "23505", message: "dup" } })
      }
      return Promise.resolve({ data: [row], error: null })
    })
    const result = await createRoomWithRetry(supabase, validArgs)
    expect(result).toEqual(row)
    expect(supabase.rpc).toHaveBeenCalledTimes(3)
  })

  it("rethrows non-23505 errors immediately without retry", async () => {
    const error = { code: "P0001", message: "invalid input" }
    const supabase = makeMockSupabase(() =>
      Promise.resolve({ data: null, error }),
    )
    await expect(createRoomWithRetry(supabase, validArgs)).rejects.toEqual(error)
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
  })

  it("respects a custom maxRetries argument", async () => {
    const supabase = makeMockSupabase(() =>
      Promise.resolve({ data: null, error: { code: "23505", message: "dup" } }),
    )
    await expect(createRoomWithRetry(supabase, validArgs, 2)).rejects.toBeInstanceOf(
      RoomCodeCollisionError,
    )
    expect(supabase.rpc).toHaveBeenCalledTimes(2)
  })
})
