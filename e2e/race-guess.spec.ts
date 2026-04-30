import { test, expect } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"
import { getAssignedNameByPlayerId, getRoomIdByCode } from "./_helpers/admin"

// Concurrency property test: when two players submit a correct guess at the
// same instant, submit_guess MUST hand out distinct positions (1 and 2) — never
// the same number twice. The atomic next_position increment lives inside a
// FOR UPDATE lock on round_positions; this spec drives that lock from two
// independent anon connections in parallel and asserts the property holds
// across multiple iterations to catch races that only show up sometimes.

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321"

// Local-only publishable key, identical across every developer machine.
const ANON_FALLBACK = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ANON_FALLBACK

function newAnonClient(): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

type GuessResult = { correct: boolean; position: number; score: number }

async function submitGuess(
  client: SupabaseClient<Database>,
  args: {
    roomId: string
    roundNumber: number
    playerId: string
    guess: string
  },
): Promise<GuessResult> {
  const { data, error } = await client.rpc("submit_guess", {
    p_room_id: args.roomId,
    p_round_number: args.roundNumber,
    p_player_id: args.playerId,
    p_guess: args.guess,
  })
  if (error) throw new Error(`submit_guess failed: ${error.message}`)
  if (!data || data.length === 0) throw new Error("submit_guess returned no rows")
  return data[0]
}

const ITERATIONS = 5

test(`submit_guess hands out distinct positions under concurrent guesses (x${ITERATIONS})`, async () => {
  // Reuse a single setup client; each iteration creates a fresh room.
  const setup = newAnonClient()

  for (let i = 1; i <= ITERATIONS; i++) {
    const hostPlayerId = randomUUID()
    const guest1PlayerId = randomUUID()
    const guest2PlayerId = randomUUID()

    // ---- Setup: host creates room, two guests join, host starts the game.
    const { data: createData, error: createErr } = await setup.rpc("create_room", {
      p_max_rounds: 5,
      p_score_positions: 3,
      p_host_name: `Host${i}`,
      p_host_player_id: hostPlayerId,
    })
    if (createErr || !createData || createData.length === 0) {
      throw new Error(`create_room failed: ${createErr?.message}`)
    }
    const code = createData[0].code

    for (const [playerId, name] of [
      [guest1PlayerId, `G1-${i}`],
      [guest2PlayerId, `G2-${i}`],
    ] as const) {
      const { error: joinErr } = await setup.rpc("join_room", {
        p_code: code,
        p_player_id: playerId,
        p_display_name: name,
      })
      if (joinErr) throw new Error(`join_room failed: ${joinErr.message}`)
    }

    const roomId = await getRoomIdByCode(code)

    const { error: startErr } = await setup.rpc("start_game", {
      p_room_id: roomId,
      p_host_player_id: hostPlayerId,
    })
    if (startErr) throw new Error(`start_game failed: ${startErr.message}`)

    const guest1Name = await getAssignedNameByPlayerId(roomId, guest1PlayerId, 1)
    const guest2Name = await getAssignedNameByPlayerId(roomId, guest2PlayerId, 1)

    // ---- Race: two independent anon clients fire submit_guess concurrently.
    // Separate clients ensure separate HTTP connections — a single client
    // serializes its own requests and would mask the race.
    const client1 = newAnonClient()
    const client2 = newAnonClient()

    const [r1, r2] = await Promise.all([
      submitGuess(client1, {
        roomId,
        roundNumber: 1,
        playerId: guest1PlayerId,
        guess: guest1Name,
      }),
      submitGuess(client2, {
        roomId,
        roundNumber: 1,
        playerId: guest2PlayerId,
        guess: guest2Name,
      }),
    ])

    // Both guesses were correct.
    expect(r1.correct, `iter ${i}: guest1 should be correct`).toBe(true)
    expect(r2.correct, `iter ${i}: guest2 should be correct`).toBe(true)

    // Positions are distinct integers 1 and 2 (in some order), never the same.
    const positions = [r1.position, r2.position].sort((a, b) => a - b)
    expect(
      positions,
      `iter ${i}: expected distinct positions [1,2], got [${r1.position}, ${r2.position}]`,
    ).toEqual([1, 2])

    // Scores follow effective_score_positions = LEAST(score_positions=3,
    // player_count - 1 = 2) = 2 → first=2, second=1 under the Phase 1 guard.
    expect(
      [r1.score, r2.score].sort((a, b) => a - b),
      `iter ${i}: expected scores [1,2]`,
    ).toEqual([1, 2])
  }
})
