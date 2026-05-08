import { test, expect } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@social-hub/types"
import {
  getAssignedNameByPlayerId,
  getRoomIdByCode,
  getRoundStateForPlayer,
} from "./_helpers/admin"

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

// Issue #8 regression guard: 2-player room with Top-N=1 (score_positions=1).
// Player A guesses correctly first → score=1. Player B guesses correctly
// second → score=0 (didn't make Top-N). Both must be marked is_correct=true
// in round_state so the client renders the Correct (+0 pts) variant, NOT
// the Foul screen. Pre-fix, the client routed off score_this_round > 0 and
// mislabeled Player B as Foul.
test("Top-N=1 with 2 players: late-correct guess is is_correct=true with score=0", async () => {
  const setup = newAnonClient()
  const hostPlayerId = randomUUID()
  const guestPlayerId = randomUUID()

  const { data: createData, error: createErr } = await setup.rpc("create_room", {
    p_max_rounds: 5,
    p_score_positions: 1, // Top-N=1
    p_host_name: "HostT1",
    p_host_player_id: hostPlayerId,
  })
  if (createErr || !createData || createData.length === 0) {
    throw new Error(`create_room failed: ${createErr?.message}`)
  }
  const code = createData[0].code

  const { error: joinErr } = await setup.rpc("join_room", {
    p_code: code,
    p_player_id: guestPlayerId,
    p_display_name: "GuestT1",
  })
  if (joinErr) throw new Error(`join_room failed: ${joinErr.message}`)

  const roomId = await getRoomIdByCode(code)

  const { error: startErr } = await setup.rpc("start_game", {
    p_room_id: roomId,
    p_host_player_id: hostPlayerId,
  })
  if (startErr) throw new Error(`start_game failed: ${startErr.message}`)

  const hostName = await getAssignedNameByPlayerId(roomId, hostPlayerId, 1)
  const guestName = await getAssignedNameByPlayerId(roomId, guestPlayerId, 1)

  // Sequential guesses (not concurrent) — host first, guest second. Both
  // submit the correct answer for their own assigned name.
  const r1 = await submitGuess(setup, {
    roomId,
    roundNumber: 1,
    playerId: hostPlayerId,
    guess: hostName,
  })
  const r2 = await submitGuess(setup, {
    roomId,
    roundNumber: 1,
    playerId: guestPlayerId,
    guess: guestName,
  })

  expect(r1.correct, "host guessed correctly").toBe(true)
  expect(r2.correct, "guest guessed correctly").toBe(true)

  // Top-N=1 with 2 players: effective_score_positions = LEAST(1, 1) = 1.
  // Position 1 → score=1, position 2 → score=0.
  expect(r1.score, "first correct guess scores 1 pt").toBe(1)
  expect(r2.score, "second correct guess scores 0 pts (didn't make Top-N)").toBe(0)

  // The actual fix: round_state.is_correct must be true for BOTH players,
  // even though Player B scored 0. Pre-fix this column did not exist and
  // the client routed off score=0, which it conflated with Foul.
  const hostRow = await getRoundStateForPlayer(roomId, hostPlayerId, 1)
  const guestRow = await getRoundStateForPlayer(roomId, guestPlayerId, 1)

  expect(hostRow.is_correct, "host round_state.is_correct=true").toBe(true)
  expect(hostRow.score_this_round).toBe(1)
  expect(guestRow.is_correct, "guest round_state.is_correct=true (NOT foul)").toBe(true)
  expect(guestRow.score_this_round).toBe(0)
})
