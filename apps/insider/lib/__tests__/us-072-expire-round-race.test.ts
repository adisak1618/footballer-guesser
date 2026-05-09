import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"

// US-072 — Phase 5c.7: Race on expire_round (idempotency).
//
// Story-focused regression test for the A3.B contract: many clients fire
// expire_round simultaneously when their local timers hit zero, but only ONE
// observes phase='asking' and updates the row — the rest match zero rows and
// return 0. Sum of `updated` row counts across N concurrent callers MUST be 1.
//
// Complements migration-0026-expire-round.test.ts (which exercises the full
// RPC contract from a single client) by:
//   - Using two SEPARATE anon client instances (= two distinct REST/PostgREST
//     connections, mirroring the real "two phones" scenario) instead of two
//     in-flight requests on one client.
//   - Running multiple independent races back-to-back so a single lucky
//     interleaving can't mask a broken phase guard.
//   - Asserting phase, started_at, and time_limit_s are all unchanged
//     (proving the losing call was a true no-op, not a redundant write).
//
// Requires `bunx supabase start`.

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

const PACK_SLUG = "football-premier-league"
const ROOM_CODE = "INS72A"

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// Two SEPARATE anon clients = two distinct PostgREST connections, so the race
// is not collapsed into a single client's connection pool / request pipeline.
const anonA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const anonB = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const anonC = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

let roomId: string

async function cleanup(): Promise<void> {
  await admin.from("rooms").delete().eq("code", ROOM_CODE)
}

async function insertExpiredAskingRound(round: number): Promise<string> {
  // started_at = 10min ago, time_limit_s = 300 → deadline 5min ago → expired.
  const startedAt = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { error } = await admin.from("game_insider_round").insert({
    room_id: roomId,
    round_number: round,
    pack_slug: PACK_SLUG,
    secret_value: "X",
    time_limit_s: 300,
    phase: "asking",
    started_at: startedAt,
  })
  if (error) throw error
  return startedAt
}

async function readRound(round: number) {
  const { data, error } = await admin
    .from("game_insider_round")
    .select("phase, started_at, time_limit_s")
    .eq("room_id", roomId)
    .eq("round_number", round)
    .single()
  if (error) throw error
  return data!
}

async function callExpire(
  client: typeof anonA,
  round: number,
): Promise<number> {
  const { data, error } = await client.rpc("expire_round", {
    p_room_id: roomId,
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
      code: ROOM_CODE,
      max_rounds: 5,
      score_positions: 4,
      category: "premier-league",
      game_type: "insider",
    })
    .select("id")
    .single()
  if (error) throw error
  roomId = room!.id as string
})

afterAll(async () => {
  await cleanup()
})

describe("US-072 — Race on expire_round (idempotency, A3.B)", () => {
  it("two distinct anon connections fire simultaneously → sum of update counts is exactly 1", async () => {
    const startedAt = await insertExpiredAskingRound(1)

    const [a, b] = await Promise.all([
      callExpire(anonA, 1),
      callExpire(anonB, 1),
    ])

    // Exactly one caller observed phase='asking' and won the race.
    expect(a + b).toBe(1)
    // Each caller individually returned 0 or 1 — no double-counting, no errors.
    expect([a, b].sort()).toEqual([0, 1])

    const after = await readRound(1)
    expect(after.phase).toBe("result_failed")
    // The losing call was a TRUE no-op: no spurious overwrite of started_at
    // or time_limit_s. Compare as Date — Postgres returns '+00:00', JS
    // Date.toISOString() emits 'Z' for the same instant.
    expect(new Date(after.started_at as string).getTime()).toBe(
      new Date(startedAt).getTime(),
    )
    expect(after.time_limit_s).toBe(300)
  })

  it("three distinct anon connections fire simultaneously → sum of update counts is still exactly 1", async () => {
    const startedAt = await insertExpiredAskingRound(2)

    const results = await Promise.all([
      callExpire(anonA, 2),
      callExpire(anonB, 2),
      callExpire(anonC, 2),
    ])

    expect(results.reduce((s, n) => s + n, 0)).toBe(1)
    expect(results.filter((n) => n === 1)).toHaveLength(1)
    expect(results.filter((n) => n === 0)).toHaveLength(2)

    const after = await readRound(2)
    expect(after.phase).toBe("result_failed")
    expect(new Date(after.started_at as string).getTime()).toBe(
      new Date(startedAt).getTime(),
    )
  })

  it("a follow-up call AFTER the race resolves is a no-op (returns 0, phase stays 'result_failed')", async () => {
    // Round 1 was already resolved by the first test.
    const before = await readRound(1)
    expect(before.phase).toBe("result_failed")

    const trailing = await callExpire(anonA, 1)
    expect(trailing).toBe(0)

    const after = await readRound(1)
    expect(after.phase).toBe("result_failed")
    expect(new Date(after.started_at as string).getTime()).toBe(
      new Date(before.started_at as string).getTime(),
    )
  })
})
