import { describe, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { GameRpcError } from "@social-hub/core"

import {
  advanceToAsking,
  advanceToReveal,
  castVote,
  createInsiderRoom,
  expireRound,
  getMyInsiderSecret,
  markCorrectGuess,
  masterRespond,
  reconcileRoundPhase,
  startInsiderRound,
} from "../insider-rpc"

// Unit tests (US-050 / Phase 5a.13). Mocked supabase client — no DB needed.
//
// Each wrapper:
//   1. Translates camelCase wrapper args to the snake_case `p_*` shape the
//      Postgres function expects.
//   2. Goes through `dispatch()` from `@social-hub/core`, so the array-unwrap
//      and PG error → GameRpcError translation come for free.
//   3. Returns the unwrapped scalar result for non-void RPCs.

const ROOM = "11111111-1111-4111-8111-111111111111"
const PLAYER = "22222222-2222-4222-8222-222222222222"
const VOTED = "33333333-3333-4333-8333-333333333333"

type RpcImpl = (
  name: string,
  args: unknown,
) => Promise<{ data: unknown; error: unknown }>

function makeMockSupabase(impl: RpcImpl): SupabaseClient {
  return { rpc: vi.fn(impl) } as unknown as SupabaseClient
}

function ok(data: unknown): RpcImpl {
  return () => Promise.resolve({ data, error: null })
}

function fail(code: string, message: string): RpcImpl {
  return () =>
    Promise.resolve({ data: null, error: { code, message } })
}

describe("advanceToAsking", () => {
  it("forwards to advance_to_asking with snake_case args", async () => {
    const supabase = makeMockSupabase(ok(null))
    await advanceToAsking(supabase, {
      roomId: ROOM,
      round: 1,
      playerId: PLAYER,
    })
    expect(supabase.rpc).toHaveBeenCalledWith("advance_to_asking", {
      p_room_id: ROOM,
      p_round: 1,
      p_player_id: PLAYER,
    })
  })

  it("surfaces RPC errors as GameRpcError", async () => {
    const supabase = makeMockSupabase(fail("PG011", "PGAME11: not in room"))
    await expect(
      advanceToAsking(supabase, { roomId: ROOM, round: 1, playerId: PLAYER }),
    ).rejects.toBeInstanceOf(GameRpcError)
  })
})

describe("startInsiderRound", () => {
  it("forwards to start_insider_round with snake_case args and returns the round number", async () => {
    const supabase = makeMockSupabase(ok(1))
    const round = await startInsiderRound(supabase, {
      roomId: ROOM,
      packSlug: "football-premier-league",
      timeLimitS: 300,
      playerId: PLAYER,
    })
    expect(round).toBe(1)
    expect(supabase.rpc).toHaveBeenCalledWith("start_insider_round", {
      p_room_id: ROOM,
      p_pack_slug: "football-premier-league",
      p_time_limit_s: 300,
      p_player_id: PLAYER,
    })
  })

  it("surfaces RPC errors as GameRpcError", async () => {
    const supabase = makeMockSupabase(fail("PG014", "PGAME14: too few players"))
    await expect(
      startInsiderRound(supabase, {
        roomId: ROOM,
        packSlug: "football-premier-league",
        timeLimitS: 300,
        playerId: PLAYER,
      }),
    ).rejects.toBeInstanceOf(GameRpcError)
  })
})

describe("masterRespond", () => {
  it("forwards to master_respond with snake_case args", async () => {
    const supabase = makeMockSupabase(ok(null))
    await masterRespond(supabase, {
      roomId: ROOM,
      round: 1,
      playerId: PLAYER,
      response: "yes",
    })
    expect(supabase.rpc).toHaveBeenCalledWith("master_respond", {
      p_room_id: ROOM,
      p_round: 1,
      p_player_id: PLAYER,
      p_response: "yes",
    })
  })

  it("surfaces RPC errors as GameRpcError", async () => {
    const supabase = makeMockSupabase(fail("PG015", "PGAME15: not master"))
    await expect(
      masterRespond(supabase, {
        roomId: ROOM,
        round: 1,
        playerId: PLAYER,
        response: "no",
      }),
    ).rejects.toBeInstanceOf(GameRpcError)
  })
})

describe("markCorrectGuess", () => {
  it("forwards to mark_correct_guess with snake_case args", async () => {
    const supabase = makeMockSupabase(ok(null))
    await markCorrectGuess(supabase, {
      roomId: ROOM,
      round: 1,
      playerId: PLAYER,
    })
    expect(supabase.rpc).toHaveBeenCalledWith("mark_correct_guess", {
      p_room_id: ROOM,
      p_round: 1,
      p_player_id: PLAYER,
    })
  })

  it("surfaces RPC errors as GameRpcError", async () => {
    const supabase = makeMockSupabase(fail("PG016", "PGAME16: phase not asking"))
    await expect(
      markCorrectGuess(supabase, { roomId: ROOM, round: 1, playerId: PLAYER }),
    ).rejects.toBeInstanceOf(GameRpcError)
  })
})

describe("expireRound", () => {
  it("forwards to expire_round with snake_case args and returns rows-affected", async () => {
    const supabase = makeMockSupabase(ok(1))
    const count = await expireRound(supabase, { roomId: ROOM, round: 1 })
    expect(count).toBe(1)
    expect(supabase.rpc).toHaveBeenCalledWith("expire_round", {
      p_room_id: ROOM,
      p_round: 1,
    })
  })

  it("surfaces RPC errors as GameRpcError", async () => {
    const supabase = makeMockSupabase(fail("XX000", "boom"))
    await expect(
      expireRound(supabase, { roomId: ROOM, round: 1 }),
    ).rejects.toBeInstanceOf(GameRpcError)
  })
})

describe("castVote", () => {
  it("forwards to cast_vote with snake_case args", async () => {
    const supabase = makeMockSupabase(ok(null))
    await castVote(supabase, {
      roomId: ROOM,
      round: 1,
      playerId: PLAYER,
      votedPlayerId: VOTED,
    })
    expect(supabase.rpc).toHaveBeenCalledWith("cast_vote", {
      p_room_id: ROOM,
      p_round: 1,
      p_player_id: PLAYER,
      p_voted_player_id: VOTED,
    })
  })

  it("surfaces RPC errors as GameRpcError", async () => {
    const supabase = makeMockSupabase(fail("PG018", "PGAME18: phase not voting"))
    await expect(
      castVote(supabase, {
        roomId: ROOM,
        round: 1,
        playerId: PLAYER,
        votedPlayerId: VOTED,
      }),
    ).rejects.toBeInstanceOf(GameRpcError)
  })
})

describe("advanceToReveal", () => {
  it("forwards to advance_to_reveal with snake_case args", async () => {
    const supabase = makeMockSupabase(ok(null))
    await advanceToReveal(supabase, { roomId: ROOM, round: 1 })
    expect(supabase.rpc).toHaveBeenCalledWith("advance_to_reveal", {
      p_room_id: ROOM,
      p_round: 1,
    })
  })

  it("surfaces RPC errors as GameRpcError", async () => {
    const supabase = makeMockSupabase(fail("XX000", "boom"))
    await expect(
      advanceToReveal(supabase, { roomId: ROOM, round: 1 }),
    ).rejects.toBeInstanceOf(GameRpcError)
  })
})

describe("getMyInsiderSecret", () => {
  it("forwards to get_my_insider_secret with snake_case args and returns the secret string", async () => {
    const supabase = makeMockSupabase(ok("Mohamed Salah"))
    const secret = await getMyInsiderSecret(supabase, {
      roomId: ROOM,
      round: 1,
      playerId: PLAYER,
    })
    expect(secret).toBe("Mohamed Salah")
    expect(supabase.rpc).toHaveBeenCalledWith("get_my_insider_secret", {
      p_room_id: ROOM,
      p_round: 1,
      p_player_id: PLAYER,
    })
  })

  it("surfaces RPC errors as GameRpcError", async () => {
    const supabase = makeMockSupabase(fail("PG010", "PGAME10: not master/insider"))
    await expect(
      getMyInsiderSecret(supabase, {
        roomId: ROOM,
        round: 1,
        playerId: PLAYER,
      }),
    ).rejects.toBeInstanceOf(GameRpcError)
  })
})

describe("createInsiderRoom", () => {
  it("forwards to create_insider_room with snake_case args and unwraps the (code, player_id) row", async () => {
    const supabase = makeMockSupabase(
      ok([{ code: "ABCDEF", player_id: PLAYER }]),
    )
    const result = await createInsiderRoom(supabase, {
      packSlug: "insider-thai-food",
      timeLimitS: 300,
      roundCount: 5,
      hostName: "Pong",
      hostPlayerId: PLAYER,
    })
    expect(result).toEqual({ code: "ABCDEF", playerId: PLAYER })
    expect(supabase.rpc).toHaveBeenCalledWith("create_insider_room", {
      p_pack_slug: "insider-thai-food",
      p_time_limit_s: 300,
      p_round_count: 5,
      p_host_name: "Pong",
      p_host_player_id: PLAYER,
    })
  })

  it("surfaces RPC errors as GameRpcError on non-collision failures", async () => {
    const supabase = makeMockSupabase(fail("PG020", "PGAME20: invalid args"))
    await expect(
      createInsiderRoom(supabase, {
        packSlug: "insider-thai-food",
        timeLimitS: 300,
        roundCount: 5,
        hostName: "Pong",
        hostPlayerId: PLAYER,
      }),
    ).rejects.toMatchObject({ code: "PG020" })
  })
})

describe("reconcileRoundPhase", () => {
  it("forwards to reconcile_round_phase with snake_case args", async () => {
    const supabase = makeMockSupabase(ok(null))
    await reconcileRoundPhase(supabase, { roomId: ROOM, round: 1 })
    expect(supabase.rpc).toHaveBeenCalledWith("reconcile_round_phase", {
      p_room_id: ROOM,
      p_round: 1,
    })
  })

  it("surfaces RPC errors as GameRpcError", async () => {
    const supabase = makeMockSupabase(fail("XX000", "boom"))
    await expect(
      reconcileRoundPhase(supabase, { roomId: ROOM, round: 1 }),
    ).rejects.toBeInstanceOf(GameRpcError)
  })
})
