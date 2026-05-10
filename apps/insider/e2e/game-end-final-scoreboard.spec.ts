import { expect, test } from "@playwright/test"
import {
  adminClient,
  asPlayer,
  cleanupRoomByCode,
  seedRoom,
} from "./_helpers/setup"

// Issue #24 — game-end FinalScoreboard.
// Rubric coverage: Acceptance #4 (FinalScoreboard renders when
// current_round >= max_rounds, GAME OVER header, leaderboard sorted desc,
// 1st place highlighted) + Acceptance #5 (PLAY AGAIN) + Acceptance #6
// (BACK TO LOBBY).

const FINAL_CODE = "INS24C"
const PLAY_AGAIN_CODE = "INS24D"
const BACK_TO_LOBBY_CODE = "INS24E"

test.describe("Insider FinalScoreboard (issue #24)", () => {
  test.afterEach(async () => {
    for (const code of [FINAL_CODE, PLAY_AGAIN_CODE, BACK_TO_LOBBY_CODE]) {
      await cleanupRoomByCode(code)
    }
  })

  test("renders GAME OVER + leaderboard sorted desc with 1st place highlighted", async ({
    page,
  }) => {
    const f = await seedRoom({
      code: FINAL_CODE,
      status: "PLAYING",
      currentRound: 3,
      maxRounds: 3,
      roundPhase: "reveal",
      withRolesAndVotes: true,
      // Alice highest, then Host, then Bob, then Insider.
      scores: { host: 4, insider: 1, a: 8, b: 2 },
    })

    await asPlayer(page, f.hostId)
    await page.goto(`/room/${FINAL_CODE}`)

    await expect(page.getByTestId("insider-final-header")).toHaveText(
      "GAME OVER",
      { timeout: 15_000 },
    )

    await expect(page.getByTestId("insider-final-winner-name")).toHaveText(
      "ALICE",
    )
    await expect(page.getByTestId("insider-final-winner-score")).toContainText(
      "8 pts",
    )

    // Rank order: Alice (8) → Host (4) → Bob (2) → Insider (1).
    const rows = page.getByTestId(/insider-final-row-/)
    await expect(rows).toHaveCount(4)
    await expect(rows.nth(0)).toHaveAttribute("data-rank", "1")
    await expect(rows.nth(1)).toHaveAttribute("data-rank", "2")
    await expect(rows.nth(2)).toHaveAttribute("data-rank", "3")
    await expect(rows.nth(3)).toHaveAttribute("data-rank", "4")
  })

  test("PLAY AGAIN resets scores and starts round 1 (room is then PLAYING+round=1)", async ({
    page,
  }) => {
    const f = await seedRoom({
      code: PLAY_AGAIN_CODE,
      status: "PLAYING",
      currentRound: 3,
      maxRounds: 3,
      roundPhase: "reveal",
      withRolesAndVotes: true,
      scores: { host: 4, insider: 1, a: 8, b: 2 },
    })

    await asPlayer(page, f.hostId)
    await page.goto(`/room/${PLAY_AGAIN_CODE}`)

    await expect(page.getByTestId("insider-final-play-again-cta")).toBeVisible({
      timeout: 15_000,
    })
    await page.getByTestId("insider-final-play-again-cta").click()

    const admin = adminClient()
    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("rooms")
            .select("status, current_round")
            .eq("id", f.roomId)
            .single()
          return data
        },
        { timeout: 15_000 },
      )
      .toMatchObject({ status: "PLAYING", current_round: 1 })

    // Scores zeroed.
    const { data: scores } = await admin
      .from("players")
      .select("total_score")
      .eq("room_id", f.roomId)
    expect(scores?.every((s) => s.total_score === 0)).toBe(true)
  })

  test("BACK TO LOBBY resets and lands on initial empty lobby (LOBBY+round=0)", async ({
    page,
  }) => {
    const f = await seedRoom({
      code: BACK_TO_LOBBY_CODE,
      status: "PLAYING",
      currentRound: 3,
      maxRounds: 3,
      roundPhase: "reveal",
      withRolesAndVotes: true,
      scores: { host: 4, insider: 1, a: 8, b: 2 },
    })

    await asPlayer(page, f.hostId)
    await page.goto(`/room/${BACK_TO_LOBBY_CODE}`)

    await expect(
      page.getByTestId("insider-final-back-to-lobby-cta"),
    ).toBeVisible({ timeout: 15_000 })
    await page.getByTestId("insider-final-back-to-lobby-cta").click()

    const admin = adminClient()
    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("rooms")
            .select("status, current_round")
            .eq("id", f.roomId)
            .single()
          return data
        },
        { timeout: 15_000 },
      )
      .toMatchObject({ status: "LOBBY", current_round: 0 })
  })
})
