import { expect, test } from "@playwright/test"
import {
  PACK_ALT,
  PACK_DEFAULT,
  adminClient,
  asPlayer,
  cleanupRoomByCode,
  seedRoom,
} from "./_helpers/setup"

// Issue #24 — between-rounds lobby variant.
// Rubric coverage: Acceptance #1 (host editable pack chips updating
// game_insider_room_config.pack_slug via change_insider_pack RPC) and
// Acceptance #3 (non-host sees read-only `Pack: <name>` label).

const HOST_CODE = "INS24A"
const NONHOST_CODE = "INS24B"

test.describe("Insider between-rounds lobby (issue #24)", () => {
  test.afterEach(async () => {
    await cleanupRoomByCode(HOST_CODE)
    await cleanupRoomByCode(NONHOST_CODE)
  })

  test("host between rounds sees pack chips and can switch pack via RPC", async ({
    page,
  }) => {
    const f = await seedRoom({
      code: HOST_CODE,
      status: "LOBBY",
      currentRound: 1,
      maxRounds: 5,
      packSlug: PACK_DEFAULT,
      roundPhase: "reveal",
      withRolesAndVotes: true,
    })

    await asPlayer(page, f.hostId)
    await page.goto(`/room/${HOST_CODE}`)

    await expect(page.getByTestId(`pack-chip-${PACK_DEFAULT}`)).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByTestId(`pack-chip-${PACK_ALT}`)).toBeVisible()
    await expect(page.getByTestId("insider-reset-game-cta")).toBeVisible()

    // Tap the alternate pack — UI is optimistic, RPC fires under the hood.
    await page.getByTestId(`pack-chip-${PACK_ALT}`).click()

    // Verify the DB row was updated by change_insider_pack.
    const admin = adminClient()
    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("game_insider_room_config")
            .select("pack_slug")
            .eq("room_id", f.roomId)
            .single()
          return data?.pack_slug
        },
        { timeout: 10_000 },
      )
      .toBe(PACK_ALT)
  })

  test("non-host between rounds sees read-only Pack label and no destructive controls", async ({
    page,
  }) => {
    const f = await seedRoom({
      code: NONHOST_CODE,
      status: "LOBBY",
      currentRound: 1,
      maxRounds: 5,
      packSlug: PACK_DEFAULT,
      roundPhase: "reveal",
      withRolesAndVotes: true,
    })

    await asPlayer(page, f.playerAId)
    await page.goto(`/room/${NONHOST_CODE}`)

    await expect(page.getByTestId("insider-pack-readonly")).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByTestId("insider-pack-readonly-name")).not.toBeEmpty()
    await expect(page.getByTestId(`pack-chip-${PACK_DEFAULT}`)).toHaveCount(0)
    await expect(page.getByTestId("insider-reset-game-cta")).toHaveCount(0)
  })
})
