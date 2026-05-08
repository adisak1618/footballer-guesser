import { describe, expect, it, vi, beforeEach } from "vitest"
import { GameRpcError } from "@social-hub/core"

// Mock the supabase server client factory before importing the action so the
// action picks up the mocked module. The factory is re-exported by hub at the
// same path used by the action under test.
const mockMaybeSingle = vi.fn()
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))

vi.mock("@social-hub/core", async () => {
  const actual = await vi.importActual<typeof import("@social-hub/core")>(
    "@social-hub/core",
  )
  return {
    ...actual,
    createSupabaseServerClient: () => ({ from: mockFrom }),
  }
})

import { lookupRoom } from "../lookup-room"

beforeEach(() => {
  mockMaybeSingle.mockReset()
  mockEq.mockClear()
  mockSelect.mockClear()
  mockFrom.mockClear()
})

describe("lookupRoom", () => {
  it("returns { gameType, code } when the room exists", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { game_type: "headball", status: "WAITING" },
      error: null,
    })

    const result = await lookupRoom("ABCDEF")

    expect(result).toEqual({ gameType: "headball", code: "ABCDEF" })
    expect(mockFrom).toHaveBeenCalledWith("rooms")
    expect(mockSelect).toHaveBeenCalledWith("game_type, status")
    expect(mockEq).toHaveBeenCalledWith("code", "ABCDEF")
  })

  it("uppercases the code before querying", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { game_type: "insider", status: "WAITING" },
      error: null,
    })

    const result = await lookupRoom("abcdef")

    expect(result).toEqual({ gameType: "insider", code: "ABCDEF" })
    expect(mockEq).toHaveBeenCalledWith("code", "ABCDEF")
  })

  it("throws GameRpcError with code 'ROOM_NOT_FOUND' when no row matches", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })

    let caught: unknown = null
    try {
      await lookupRoom("ZZZZZZ")
    } catch (err) {
      caught = err
    }

    expect(caught).toBeInstanceOf(GameRpcError)
    const e = caught as GameRpcError
    expect(e.code).toBe("ROOM_NOT_FOUND")
    expect(e.context).toMatchObject({ rpc: "lookup_room", args: { code: "ZZZZZZ" } })
  })

  it("throws GameRpcError with code 'INVALID_CODE' when the code length is wrong", async () => {
    let caught: unknown = null
    try {
      await lookupRoom("ABC")
    } catch (err) {
      caught = err
    }

    expect(caught).toBeInstanceOf(GameRpcError)
    expect((caught as GameRpcError).code).toBe("INVALID_CODE")
    expect(mockMaybeSingle).not.toHaveBeenCalled()
  })

  it("throws GameRpcError with code 'INVALID_CODE' when the code uses out-of-alphabet chars", async () => {
    let caught: unknown = null
    try {
      // I, O, 0, 1 are excluded from ROOM_CODE_ALPHABET
      await lookupRoom("ABCDE0")
    } catch (err) {
      caught = err
    }

    expect(caught).toBeInstanceOf(GameRpcError)
    expect((caught as GameRpcError).code).toBe("INVALID_CODE")
    expect(mockMaybeSingle).not.toHaveBeenCalled()
  })

  it("throws GameRpcError when supabase returns an error, parsing the pg errcode", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { code: "PGAME99", message: "platform exploded" },
    })

    let caught: unknown = null
    try {
      await lookupRoom("ABCDEF")
    } catch (err) {
      caught = err
    }

    expect(caught).toBeInstanceOf(GameRpcError)
    const e = caught as GameRpcError
    expect(e.code).toBe("PGAME99")
    expect(e.message).toBe("platform exploded")
    expect(e.context).toMatchObject({ rpc: "lookup_room", args: { code: "ABCDEF" } })
  })
})
