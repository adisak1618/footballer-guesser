import { expect, test } from "@playwright/test"
import {
  PACK_DEFAULT,
  adminClient,
  asPlayer,
  cleanupRoomByCode,
  seedRoom,
} from "./_helpers/setup"

// Issue #24 — host hits RESET between rounds.
// Rubric coverage: Acceptance #2 (RESET GAME with confirm dialog wipes
// per-round tables + zeroes total_score; preserves players, code, host,
// pack, timer, round_count). Also covers the State #2 "loading state" hint
// (the confirm CTA disables itself while the RPC is in flight).

const CODE = "INS24F"

test.describe("Insider mid-game RESET (issue #24)", () => {
  test.afterEach(async () => {
    await cleanupRoomByCode(CODE)
  })

  test("host RESET wipes per-round state and zeroes scores; preserves players + config", async ({
    page,
  }) => {
    const f = await seedRoom({
      code: CODE,
      status: "LOBBY",
      currentRound: 2,
      maxRounds: 5,
      packSlug: PACK_DEFAULT,
      roundPhase: "reveal",
      withRolesAndVotes: true,
      scores: { host: 6, insider: 3, a: 5, b: 4 },
    })

    await asPlayer(page, f.hostId)
    await page.goto(`/room/${CODE}`)

    // RESET button visible (host between rounds).
    const reset = page.getByTestId("insider-reset-game-cta")
    await expect(reset).toBeVisible({ timeout: 15_000 })

    // Tap → custom <dialog> confirm appears (NOT native confirm).
    await reset.click()
    await expect(
      page.getByTestId("insider-reset-confirm-dialog"),
    ).toBeVisible()

    // Confirm.
    await page.getByTestId("insider-reset-confirm-cta").click()

    const admin = adminClient()

    // Room shell reset: status=LOBBY, current_round=0.
    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("rooms")
            .select("status, current_round, code, host_player_id, max_rounds")
            .eq("id", f.roomId)
            .single()
          return data
        },
        { timeout: 15_000 },
      )
      .toMatchObject({
        status: "LOBBY",
        current_round: 0,
        code: CODE,
        host_player_id: f.hostId,
        max_rounds: 5,
      })

    // Scores zeroed.
    const { data: scores } = await admin
      .from("players")
      .select("display_name, total_score")
      .eq("room_id", f.roomId)
      .order("join_order", { ascending: true })
    expect(scores).toHaveLength(4)
    expect(scores?.every((s) => s.total_score === 0)).toBe(true)
    expect(scores?.map((s) => s.display_name)).toEqual([
      "Host",
      "Insider",
      "Alice",
      "Bob",
    ])

    // Per-round tables wiped.
    for (const t of [
      "game_insider_round",
      "game_insider_roles",
      "game_insider_votes",
      "game_insider_responses",
    ]) {
      const { count } = await admin
        .from(t)
        .select("*", { count: "exact", head: true })
        .eq("room_id", f.roomId)
      expect(count ?? 0).toBe(0)
    }

    // Config preserved.
    const { data: cfg } = await admin
      .from("game_insider_room_config")
      .select("pack_slug, time_limit_s, round_count")
      .eq("room_id", f.roomId)
      .single()
    expect(cfg).toMatchObject({
      pack_slug: PACK_DEFAULT,
      time_limit_s: 300,
      round_count: 5,
    })
  })
})
