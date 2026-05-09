import { describe, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { GameRpcError, dispatch } from "../dispatch"

type StartRoundArgs = { p_room_id: string }
type StartRoundResult = { round_id: string }

const validArgs: StartRoundArgs = {
  p_room_id: "11111111-1111-4111-8111-111111111111",
}

function makeMockSupabase(rpcImpl: (name: string, args: unknown) => unknown) {
  return { rpc: vi.fn(rpcImpl) } as unknown as SupabaseClient
}

describe("dispatch", () => {
  it("returns the first row when supabase returns an array result", async () => {
    const row = { round_id: "00000000-0000-4000-8000-000000000000" }
    const supabase = makeMockSupabase(() =>
      Promise.resolve({ data: [row], error: null }),
    )
    const result = await dispatch<StartRoundArgs, StartRoundResult>(
      supabase,
      "start_round",
      validArgs,
    )
    expect(result).toEqual(row)
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    expect(supabase.rpc).toHaveBeenCalledWith("start_round", validArgs)
  })

  it("returns scalar/object data unchanged when supabase returns a non-array", async () => {
    const data = { round_id: "00000000-0000-4000-8000-000000000000" }
    const supabase = makeMockSupabase(() =>
      Promise.resolve({ data, error: null }),
    )
    const result = await dispatch<StartRoundArgs, StartRoundResult>(
      supabase,
      "start_round",
      validArgs,
    )
    expect(result).toEqual(data)
  })

  it("throws GameRpcError with the parsed Postgres errcode on PGAME01", async () => {
    const error = { code: "PGAME01", message: "pack not found" }
    const supabase = makeMockSupabase(() =>
      Promise.resolve({ data: null, error }),
    )
    let caught: unknown = null
    try {
      await dispatch<StartRoundArgs, StartRoundResult>(
        supabase,
        "start_round",
        validArgs,
      )
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(GameRpcError)
    const e = caught as GameRpcError
    expect(e.code).toBe("PGAME01")
    expect(e.message).toBe("pack not found")
    expect(e.context).toEqual({ rpc: "start_round", args: validArgs })
    expect(e.name).toBe("GameRpcError")
  })

  it("throws GameRpcError with code 'UNKNOWN' when error has no code", async () => {
    const error = { message: "something exploded" }
    const supabase = makeMockSupabase(() =>
      Promise.resolve({ data: null, error }),
    )
    let caught: unknown = null
    try {
      await dispatch<StartRoundArgs, StartRoundResult>(
        supabase,
        "start_round",
        validArgs,
      )
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(GameRpcError)
    const e = caught as GameRpcError
    expect(e.code).toBe("UNKNOWN")
    expect(e.message).toBe("something exploded")
    expect(e.context).toEqual({ rpc: "start_round", args: validArgs })
  })

  it("throws GameRpcError with code 'UNKNOWN' and a fallback message when error is empty", async () => {
    const supabase = makeMockSupabase(() =>
      Promise.resolve({ data: null, error: {} }),
    )
    await expect(
      dispatch<StartRoundArgs, StartRoundResult>(
        supabase,
        "start_round",
        validArgs,
      ),
    ).rejects.toBeInstanceOf(GameRpcError)
  })

  it("throws GameRpcError with rpc + args context on any failure", async () => {
    const error = { code: "PGAME02", message: "round expired" }
    const supabase = makeMockSupabase(() =>
      Promise.resolve({ data: null, error }),
    )
    try {
      await dispatch<StartRoundArgs, StartRoundResult>(
        supabase,
        "expire_round",
        validArgs,
      )
    } catch (err) {
      const e = err as GameRpcError
      expect(e.context).toEqual({ rpc: "expire_round", args: validArgs })
    }
  })
})

describe("GameRpcError", () => {
  it("is an Error subclass with name 'GameRpcError'", () => {
    const err = new GameRpcError("PGAME01", "pack not found", { rpc: "x", args: {} })
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe("GameRpcError")
    expect(err.code).toBe("PGAME01")
    expect(err.message).toBe("pack not found")
    expect(err.context).toEqual({ rpc: "x", args: {} })
  })

  it("defaults context to an empty object when omitted", () => {
    const err = new GameRpcError("UNKNOWN", "boom")
    expect(err.context).toEqual({})
  })
})
