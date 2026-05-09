import { test, expect } from "@playwright/test"
import type { Page } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { createMultiRoleSession } from "./_helpers/multi-role"

// US-067 / Phase 5c.2 — Disconnected player can be voted for, can't vote (T-4).
//
// Per T-4 ("frozen eligible_voter_ids[] excludes disconnects but disconnected
// players still on player cards"):
//
//   * mark_correct_guess (migration 0025) snapshots eligible_voter_ids from
//     `players` rows where connected = true at the moment of the snapshot.
//   * The voting screen renders ALL players from the `players` table as vote
//     target cards — disconnected players are still tap-able by other voters
//     (they remain valid suspects). Only their own ability to vote is gated
//     out via isEligible (eligibleIds.includes(mePlayerId) === false).
//   * cast_vote's auto-advance counts only votes from voter_player_id ∈
//     eligible_voter_ids[], so the round advances once every eligible voter
//     has voted — the disconnected player's missing ballot does NOT block
//     the round.
//
// This spec drives a 4-player room where one Common player is marked
// disconnected during the asking phase (simulating their phone going offline)
// and asserts:
//
//   1. eligible_voter_ids in DB after mark_correct_guess has 3 entries — the
//      disconnected player is NOT in the array.
//   2. On the 3 still-connected pages (Master, Insider, the other Common),
//      the disconnected Common's vote-target-card IS visible — they can be
//      voted for.
//   3. After 3 eligible voters cast their votes, phase advances 'voting' →
//      'reveal' — cast_vote does NOT wait for the disconnected player's
//      ballot.
//
// Disconnect simulation: we update `players.connected = false` directly via
// the service-role client (the DB is the source of truth for eligibility).
// The disconnected player's browser context is left open but never interacts
// with voting — the eligibility gate would reject their cast_vote anyway via
// PGAME17 if they tried.

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321"

const LOCAL_SERVICE_ROLE_FALLBACK =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  "eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0." +
  "EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? LOCAL_SERVICE_ROLE_FALLBACK

const INSIDER_PORT = process.env.INSIDER_PORT ?? "3002"
const INSIDER_URL = `http://localhost:${INSIDER_PORT}`

async function readInsiderPlayerId(page: Page): Promise<string | null> {
  return page.evaluate(() => window.localStorage.getItem("insider_player_id"))
}

test.describe.serial("insider voting — disconnected player (US-067)", () => {
  test("disconnect during asking → excluded from eligible_voter_ids, still a vote target, vote completes on 3 ballots (T-4)", async ({
    browser,
  }) => {
    const session = await createMultiRoleSession(browser, 4)
    try {
      const [hostPage, p2, p3, p4] = session.pages

      // ─── Host creates room ──────────────────────────────────────────────
      await hostPage.goto(`${INSIDER_URL}/new`, {
        waitUntil: "domcontentloaded",
      })
      await hostPage.locator('input[type="text"]').first().fill("Host")
      await hostPage.getByTestId("pack-chip-football-premier-league").click()
      await hostPage.getByTestId("create-insider-room-cta").click()
      await hostPage.waitForURL(/\/room\/[A-Z0-9]{6}$/, { timeout: 15_000 })
      const code = new URL(hostPage.url()).pathname.split("/").pop() ?? ""
      expect(code).toMatch(/^[A-Z0-9]{6}$/)

      // ─── Players 2-4 join ───────────────────────────────────────────────
      const joiners: Array<{ page: Page; name: string }> = [
        { page: p2, name: "Player Two" },
        { page: p3, name: "Player Three" },
        { page: p4, name: "Player Four" },
      ]
      for (const { page, name } of joiners) {
        await page.goto(`${INSIDER_URL}/room/${code}`, {
          waitUntil: "domcontentloaded",
        })
        const nameInput = page.getByTestId("insider-join-name-input")
        await expect(nameInput).toBeVisible({ timeout: 15_000 })
        await nameInput.fill(name)
        await page.getByTestId("insider-join-cta").click()
        await expect(page.getByTestId("insider-room-code")).toHaveText(code, {
          timeout: 15_000,
        })
      }

      const pagePlayerIds: Array<{ page: Page; playerId: string }> = []
      for (const page of session.pages) {
        const pid = await readInsiderPlayerId(page)
        expect(pid).not.toBeNull()
        pagePlayerIds.push({ page, playerId: pid! })
      }

      // ─── Host starts game ───────────────────────────────────────────────
      const startCta = hostPage.getByTestId("insider-start-game-cta")
      await expect(startCta).toBeEnabled({ timeout: 15_000 })
      await startCta.click()

      const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })

      const { data: room } = await supabase
        .from("rooms")
        .select("id")
        .eq("code", code)
        .single()
      expect(room).toBeTruthy()
      const roomId = room!.id as string

      // ─── Wait for roles + secret ────────────────────────────────────────
      type RoleRow = { player_id: string; role: string }
      const { roles } = await new Promise<{
        roles: RoleRow[]
        secret: string
      }>((resolve, reject) => {
        const deadline = Date.now() + 15_000
        const tick = async () => {
          const { data: round } = await supabase
            .from("game_insider_round")
            .select("phase, secret_value")
            .eq("room_id", roomId)
            .eq("round_number", 1)
            .maybeSingle()
          if (round?.phase === "preparing" && round?.secret_value) {
            const { data: rs } = await supabase
              .from("game_insider_roles")
              .select("player_id, role")
              .eq("room_id", roomId)
              .eq("round_number", 1)
            if (rs && rs.length === 4) {
              return resolve({
                roles: rs as RoleRow[],
                secret: round.secret_value as string,
              })
            }
          }
          if (Date.now() > deadline) {
            return reject(new Error("Timed out waiting for roles"))
          }
          setTimeout(tick, 300)
        }
        tick()
      })

      const masterRow = roles.find((r) => r.role === "master")!
      const insiderRow = roles.find((r) => r.role === "insider")!
      const commonRows = roles.filter((r) => r.role === "player")
      expect(commonRows).toHaveLength(2)
      const [liveCommon, disconnectedCommon] = commonRows

      const masterPage = pagePlayerIds.find(
        (e) => e.playerId === masterRow.player_id,
      )!.page
      const insiderPage = pagePlayerIds.find(
        (e) => e.playerId === insiderRow.player_id,
      )!.page
      const liveCommonPage = pagePlayerIds.find(
        (e) => e.playerId === liveCommon.player_id,
      )!.page

      // ─── Insider readies → asking ───────────────────────────────────────
      await expect(insiderPage.getByTestId("insider-ready-cta")).toBeEnabled({
        timeout: 15_000,
      })
      await insiderPage.getByTestId("insider-ready-cta").click()

      // ─── Disconnect simulation: flip connected=false during 'asking' ────
      // mark_correct_guess snapshots eligible_voter_ids from connected=true
      // players, so this update must land BEFORE the Master taps the guess
      // CTA. Source of truth for eligibility is the DB column.
      await expect(masterPage.getByTestId("asking-phase-shell")).toBeVisible({
        timeout: 15_000,
      })
      const { error: disconnectErr } = await supabase
        .from("players")
        .update({ connected: false })
        .eq("room_id", roomId)
        .eq("player_id", disconnectedCommon.player_id)
      expect(disconnectErr).toBeNull()

      // ─── Master taps ทายถูกแล้ว → guessed → voting ─────────────────────
      const guessCta = masterPage.getByTestId("master-mark-correct-cta")
      await expect(guessCta).toBeVisible()
      await guessCta.click()

      // ─── eligible_voter_ids snapshot excludes the disconnected Common ──
      await expect
        .poll(
          async () => {
            const { data } = await supabase
              .from("game_insider_round")
              .select("phase, eligible_voter_ids")
              .eq("room_id", roomId)
              .eq("round_number", 1)
              .maybeSingle()
            return data?.eligible_voter_ids ?? null
          },
          { timeout: 15_000, intervals: [200, 500, 1000] },
        )
        .not.toBeNull()

      const { data: postGuessRound } = await supabase
        .from("game_insider_round")
        .select("eligible_voter_ids")
        .eq("room_id", roomId)
        .eq("round_number", 1)
        .maybeSingle()
      const eligible =
        (postGuessRound?.eligible_voter_ids as string[] | null) ?? []
      expect(eligible).toHaveLength(3)
      expect(eligible).toEqual(
        expect.arrayContaining([
          masterRow.player_id,
          insiderRow.player_id,
          liveCommon.player_id,
        ]),
      )
      expect(eligible).not.toContain(disconnectedCommon.player_id)

      // ─── Phase auto-advances guessed → voting ──────────────────────────
      await expect
        .poll(
          async () => {
            const { data } = await supabase
              .from("game_insider_round")
              .select("phase")
              .eq("room_id", roomId)
              .eq("round_number", 1)
              .maybeSingle()
            return data?.phase ?? null
          },
          { timeout: 15_000, intervals: [200, 500, 1000] },
        )
        .toBe("voting")

      // ─── Disconnected Common is still a vote target on every live page ─
      // T-4 "still on player cards" — vote-target-card-${disconnectedPid}
      // must render on Master, Insider, and live Common pages (the 3 that
      // are eligible to vote).
      for (const page of [masterPage, insiderPage, liveCommonPage]) {
        await expect(page.getByTestId("voting-phase-shell")).toBeVisible({
          timeout: 15_000,
        })
        const disconnectedCard = page.getByTestId(
          `vote-target-card-${disconnectedCommon.player_id}`,
        )
        await expect(disconnectedCard).toBeVisible()
        // All 4 player cards are rendered (disconnected is not hidden).
        const allCards = page.getByTestId(/^vote-target-card-/)
        await expect(allCards).toHaveCount(4)
      }

      // ─── 3 eligible voters cast votes; disconnected player never votes ─
      // Master  → Insider
      // Insider → Master
      // liveCommon → Master
      // Disconnected: no action (their browser is "offline").
      const voteTargetByEligible: Array<{
        page: Page
        playerId: string
        target: string
      }> = [
        {
          page: masterPage,
          playerId: masterRow.player_id,
          target: insiderRow.player_id,
        },
        {
          page: insiderPage,
          playerId: insiderRow.player_id,
          target: masterRow.player_id,
        },
        {
          page: liveCommonPage,
          playerId: liveCommon.player_id,
          target: masterRow.player_id,
        },
      ]

      for (const { page, target } of voteTargetByEligible) {
        const card = page.getByTestId(`vote-target-card-${target}`)
        await expect(card).toBeVisible()
        await card.click()
        await expect(card).toHaveAttribute("aria-pressed", "true")
      }

      // ─── Phase advances 'voting' → 'reveal' on 3 ballots (no wait on
      //     disconnected player). cast_vote's auto-advance fires when
      //     count(votes ∩ eligible) >= len(eligible).
      await expect
        .poll(
          async () => {
            const { data } = await supabase
              .from("game_insider_round")
              .select("phase")
              .eq("room_id", roomId)
              .eq("round_number", 1)
              .maybeSingle()
            return data?.phase ?? null
          },
          { timeout: 15_000, intervals: [200, 500, 1000] },
        )
        .toBe("reveal")

      // ─── Sanity: only 3 vote rows exist (disconnected never voted) ─────
      const { data: voteRows } = await supabase
        .from("game_insider_votes")
        .select("voter_player_id")
        .eq("room_id", roomId)
        .eq("round_number", 1)
      expect(voteRows ?? []).toHaveLength(3)
      const voterIds = (voteRows ?? []).map(
        (r) => r.voter_player_id as string,
      )
      expect(voterIds).not.toContain(disconnectedCommon.player_id)
    } finally {
      await session.dispose()
    }
  })
})
