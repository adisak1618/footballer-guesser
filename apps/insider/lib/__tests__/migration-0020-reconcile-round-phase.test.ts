import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"

// Integration test (T-2.B / US-041). Requires `bunx supabase start` running locally.
//
// Verifies migration 0020 creates the `reconcile_round_phase(p_room_id, p_round)`
// SECURITY DEFINER helper. Per T-2.A, every Insider RPC calls this first so
// that a missed `expire_round` from any client is self-healed:
//
//   asking + (now >= started_at + time_limit_s)  → phase='result_failed'
//   voting + (now >= vote_deadline)              → phase='reveal'
//
// Other phases (preparing, guessed, reveal, result_failed) are no-ops, and
// rounds whose deadline has not passed are no-ops. The function returns
// void; callers chain via `perform reconcile_round_phase(...)`. Anon role
// has GRANT EXECUTE so any client RPC can chain through it.

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

const TEST_ROOM_CODE = "INS020"
const PACK_SLUG = "football-premier-league"

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

let testRoomId: string

async function cleanup() {
  // FK on delete cascade clears game_insider_round rows when the room dies.
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

async function callReconcile(round: number): Promise<void> {
  const { error } = await anon.rpc("reconcile_round_phase", {
    p_room_id: testRoomId,
    p_round: round,
  })
  if (error) throw error
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

describe("reconcile_round_phase (migration 0020)", () => {
  it("expired 'asking' round advances to 'result_failed'", async () => {
    // started 10 minutes ago, time limit 300s → deadline 5 minutes ago.
    await insertRound({
      round: 1,
      phase: "asking",
      startedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      timeLimitS: 300,
    })
    expect(await readPhase(1)).toBe("asking")

    await callReconcile(1)

    expect(await readPhase(1)).toBe("result_failed")
  })

  it("'voting' round past vote_deadline advances to 'reveal'", async () => {
    await insertRound({
      round: 2,
      phase: "voting",
      startedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      voteDeadline: new Date(Date.now() - 60 * 1000).toISOString(),
      timeLimitS: 300,
    })
    expect(await readPhase(2)).toBe("voting")

    await callReconcile(2)

    expect(await readPhase(2)).toBe("reveal")
  })

  it("non-expired 'asking' round is a no-op", async () => {
    await insertRound({
      round: 3,
      phase: "asking",
      startedAt: new Date().toISOString(),
      timeLimitS: 300,
    })

    await callReconcile(3)

    expect(await readPhase(3)).toBe("asking")
  })

  it("'voting' round before vote_deadline is a no-op", async () => {
    await insertRound({
      round: 4,
      phase: "voting",
      startedAt: new Date(Date.now() - 60 * 1000).toISOString(),
      voteDeadline: new Date(Date.now() + 60 * 1000).toISOString(),
      timeLimitS: 300,
    })

    await callReconcile(4)

    expect(await readPhase(4)).toBe("voting")
  })

  it("phases other than 'asking'/'voting' are not touched (preparing)", async () => {
    await insertRound({ round: 5, phase: "preparing" })

    await callReconcile(5)

    expect(await readPhase(5)).toBe("preparing")
  })

  it("phases other than 'asking'/'voting' are not touched (reveal)", async () => {
    await insertRound({ round: 6, phase: "reveal" })

    await callReconcile(6)

    expect(await readPhase(6)).toBe("reveal")
  })

  it("missing round (no row) is a silent no-op (does not error)", async () => {
    // Round 999 does not exist for this room. RPC must not raise.
    await expect(callReconcile(999)).resolves.toBeUndefined()
  })

  it("idempotent — second reconcile of an already-resolved round is a no-op", async () => {
    // Round 1 was already advanced to result_failed by the first test; verify
    // that calling reconcile again leaves it at result_failed (not back to
    // asking, not erroring).
    await callReconcile(1)
    expect(await readPhase(1)).toBe("result_failed")
  })
})
