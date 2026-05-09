import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"

// Integration test (T-2.B / US-047). Requires `bunx supabase start` running locally.
//
// Verifies migration 0026 creates the `expire_round(p_room_id, p_round)` SECURITY
// DEFINER RPC that any client whose timer hit zero can call to advance phase to
// 'result_failed'. Per A3.B the RPC is idempotent — concurrent calls from many
// clients are absorbed by a phase-guarded UPDATE so only one wins.
//
//   asking + (now() >= started_at + time_limit_s seconds)  → phase='result_failed'
//
// Returns the number of rows affected (0 or 1) so the test can verify the
// idempotency contract directly.

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321"
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"

const LOCAL_SERVICE_ROLE_FALLBACK =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  "eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0." +
  "EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? LOCAL_SERVICE_ROLE_FALLBACK

const TEST_ROOM_CODE = "INS026"
const PACK_SLUG = "football-premier-league"

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

let testRoomId: string

async function cleanup() {
  await admin.from("rooms").delete().eq("code", TEST_ROOM_CODE)
}

async function readPhase(roundNumber: number): Promise<string> {
  const { data, error } = await admin
    .from("game_insider_round")
    .select("phase")
    .eq("room_id", testRoomId)
    .eq("round_number", roundNumber)
    .single()
  if (error) throw error
  return data!.phase as string
}

async function insertRound(args: {
  round: number
  phase: string
  startedAt?: string | null
  voteDeadline?: string | null
  timeLimitS?: number
}): Promise<void> {
  const { error } = await admin.from("game_insider_round").insert({
    room_id: testRoomId,
    round_number: args.round,
    pack_slug: PACK_SLUG,
    secret_value: "X",
    time_limit_s: args.timeLimitS ?? 300,
    started_at: args.startedAt ?? null,
    vote_deadline: args.voteDeadline ?? null,
    phase: args.phase,
  })
  if (error) throw error
}

async function callExpire(round: number): Promise<number> {
  const { data, error } = await anon.rpc("expire_round", {
    p_room_id: testRoomId,
    p_round: round,
  })
  if (error) throw error
  return data as number
}

beforeAll(async () => {
  await cleanup()
  const { data: room, error } = await admin
    .from("rooms")
    .insert({
      code: TEST_ROOM_CODE,
      max_rounds: 5,
      score_positions: 4,
      category: "premier-league",
      game_type: "insider",
    })
    .select("id")
    .single()
  if (error) throw error
  testRoomId = room.id
})

afterAll(async () => {
  await cleanup()
})

describe("expire_round (migration 0026)", () => {
  it("'asking' round past deadline → phase='result_failed', returns 1", async () => {
    // started 10 minutes ago, time_limit=300s → deadline 5 minutes ago.
    await insertRound({
      round: 1,
      phase: "asking",
      startedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      timeLimitS: 300,
    })
    expect(await readPhase(1)).toBe("asking")

    const updated = await callExpire(1)

    expect(updated).toBe(1)
    expect(await readPhase(1)).toBe("result_failed")
  })

  it("'asking' round still within deadline → no-op, returns 0", async () => {
    await insertRound({
      round: 2,
      phase: "asking",
      startedAt: new Date().toISOString(),
      timeLimitS: 300,
    })

    const updated = await callExpire(2)

    expect(updated).toBe(0)
    expect(await readPhase(2)).toBe("asking")
  })

  it("phase != 'asking' is a no-op, returns 0 (preparing)", async () => {
    await insertRound({ round: 3, phase: "preparing" })

    const updated = await callExpire(3)

    expect(updated).toBe(0)
    expect(await readPhase(3)).toBe("preparing")
  })

  it("phase != 'asking' is a no-op, returns 0 (voting)", async () => {
    // even if vote_deadline is way past, expire_round only handles asking→result_failed.
    await insertRound({
      round: 4,
      phase: "voting",
      startedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      voteDeadline: new Date(Date.now() - 60 * 1000).toISOString(),
      timeLimitS: 300,
    })

    const updated = await callExpire(4)

    expect(updated).toBe(0)
    expect(await readPhase(4)).toBe("voting")
  })

  it("two concurrent calls on an expired 'asking' round → only one wins (sum of update counts = 1)", async () => {
    await insertRound({
      round: 5,
      phase: "asking",
      startedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      timeLimitS: 300,
    })

    // Two concurrent connections fire simultaneously; the WHERE clause
    // phase='asking' makes the second a no-op once the first commits.
    const [a, b] = await Promise.all([callExpire(5), callExpire(5)])

    expect(a + b).toBe(1)
    expect(await readPhase(5)).toBe("result_failed")
  })

  it("missing round (no row) is a silent no-op, returns 0", async () => {
    const updated = await callExpire(999)
    expect(updated).toBe(0)
  })
})
