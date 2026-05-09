import { test, expect } from "@playwright/test"
import type { Page } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { createMultiRoleSession } from "./_helpers/multi-role"

// US-066 / Phase 5c.1 — Voting tie e2e (T-1.B edge case).
//
// Per D2 ("all tied counted as caught"): when two or more players tie at the
// top of the vote tally, the entire tied set is the "caught" set. If the
// Insider's player_id is in that set → CAUGHT outcome (Master + each Common
// +2, Insider +0). If not → ESCAPED.
//
// This e2e drives a 4-player room into a 2-2 tie where the Insider IS in the
// tied set, so the migration 0028 logic must:
//   1. compute top_count = 2 (max votes)
//   2. compute top_voted = [Insider, CommonA] (both at 2)
//   3. detect Insider ∈ top_voted → caught = true
//   4. apply caught scoring: Master +2, CommonA +2, CommonB +2, Insider +0
//
// Vote layout (ties at 2 each):
//   - Master   → Insider   (Insider +1)
//   - CommonA  → Insider   (Insider +2)
//   - Insider  → CommonA   (CommonA +1)  — Insider can't self-vote
//   - CommonB  → CommonA   (CommonA +2)
//
// Top-voted set: {Insider, CommonA}. Insider ∈ set → CAUGHT shell (Screen 8a),
// reveal-voted-by lists Insider's two voters (Master + CommonA).
//
// This complements migration-0028-advance-to-reveal.test.ts unit case
// "tied vote with Insider in tied set → caught (D2)" by exercising the
// real Insider RPC stack + UI all the way through the tie resolution.

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

test.describe.serial("insider voting tie — Insider in tied set (US-066)", () => {
  test("2-2 tie with Insider in tied set → CAUGHT reveal + scoring (D2)", async ({
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
      const [commonA, commonB] = commonRows

      const masterPage = pagePlayerIds.find(
        (e) => e.playerId === masterRow.player_id,
      )!.page
      const insiderPage = pagePlayerIds.find(
        (e) => e.playerId === insiderRow.player_id,
      )!.page

      // ─── Insider readies → asking ───────────────────────────────────────
      await expect(insiderPage.getByTestId("insider-ready-cta")).toBeEnabled({
        timeout: 15_000,
      })
      await insiderPage.getByTestId("insider-ready-cta").click()

      // ─── Master taps ทายถูกแล้ว → guessed → voting ─────────────────────
      await expect(masterPage.getByTestId("asking-phase-shell")).toBeVisible({
        timeout: 15_000,
      })
      const guessCta = masterPage.getByTestId("master-mark-correct-cta")
      await expect(guessCta).toBeVisible()
      await guessCta.click()

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

      // ─── Voting — engineer a 2-2 tie at the top ────────────────────────
      // Master + commonA both vote for Insider (Insider gets 2 votes).
      // commonB + Insider both vote for commonA (commonA gets 2 votes).
      // Insider can't self-vote (UI gate isMeRow), so Insider voting commonA
      // both feeds the tie AND respects the constraint.
      // Top-voted set = {Insider, commonA} → Insider ∈ set → CAUGHT.
      const voteTargetByPid: Record<string, string> = {
        [masterRow.player_id]: insiderRow.player_id,
        [commonA.player_id]: insiderRow.player_id,
        [insiderRow.player_id]: commonA.player_id,
        [commonB.player_id]: commonA.player_id,
      }

      for (const { page, playerId } of pagePlayerIds) {
        const target = voteTargetByPid[playerId]
        await expect(page.getByTestId("voting-phase-shell")).toBeVisible({
          timeout: 15_000,
        })
        const card = page.getByTestId(`vote-target-card-${target}`)
        await expect(card).toBeVisible()
        await card.click()
        await expect(card).toHaveAttribute("aria-pressed", "true")
      }

      // ─── Phase advances to 'reveal' AND scoring lands (scored_at set) ──
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
      await expect
        .poll(
          async () => {
            const { data } = await supabase
              .from("game_insider_round")
              .select("scored_at")
              .eq("room_id", roomId)
              .eq("round_number", 1)
              .maybeSingle()
            return data?.scored_at ?? null
          },
          { timeout: 15_000, intervals: [200, 500, 1000] },
        )
        .not.toBeNull()

      // ─── DB tally invariant: Insider and commonA tied at 2 each ────────
      const { data: voteRows } = await supabase
        .from("game_insider_votes")
        .select("voted_player_id")
        .eq("room_id", roomId)
        .eq("round_number", 1)
      const tally = new Map<string, number>()
      for (const v of voteRows ?? []) {
        const pid = v.voted_player_id as string
        tally.set(pid, (tally.get(pid) ?? 0) + 1)
      }
      expect(tally.get(insiderRow.player_id)).toBe(2)
      expect(tally.get(commonA.player_id)).toBe(2)
      // Tied at the top — both in caught set per D2.
      const topCount = Math.max(...tally.values())
      expect(topCount).toBe(2)
      const topSet = new Set(
        [...tally.entries()].filter(([, c]) => c === topCount).map(([pid]) => pid),
      )
      expect(topSet.has(insiderRow.player_id)).toBe(true)
      expect(topSet.has(commonA.player_id)).toBe(true)

      // ─── DB scoring contract (D2 caught with Insider in tied set) ──────
      // Master + each Common +2 (commonA AND commonB qualify because the
      // scoring rule is role-based, not vote-based — every role='player' row
      // gets +2 in the caught branch). Insider +0.
      const { data: scored } = await supabase
        .from("players")
        .select("player_id, total_score")
        .eq("room_id", roomId)
      const scoreByPid = new Map(
        (scored ?? []).map((r) => [r.player_id as string, r.total_score as number]),
      )
      expect(scoreByPid.get(insiderRow.player_id)).toBe(0)
      expect(scoreByPid.get(masterRow.player_id)).toBe(2)
      expect(scoreByPid.get(commonA.player_id)).toBe(2)
      expect(scoreByPid.get(commonB.player_id)).toBe(2)

      // ─── All 4 pages see Screen 8a — caught reveal (D2 collapses tie) ──
      for (const { page } of pagePlayerIds) {
        await expect(page.getByTestId("reveal-caught-shell")).toBeVisible({
          timeout: 15_000,
        })
        // CAUGHT badge.
        const badge = page.getByTestId("reveal-insider-badge")
        await expect(badge).toBeVisible()
        await expect(badge).toContainText(/CAUGHT/i)
        // Voted-by lists the Insider's 2 voters (Master + commonA).
        await expect(page.getByTestId("reveal-voted-by")).toBeVisible()
        // Round-scores tiles: 4 entries.
        const scoreTiles = page.getByTestId(/^reveal-score-tile-/)
        await expect(scoreTiles).toHaveCount(4)
        // Leaderboard: 4 entries.
        const leaderRows = page.getByTestId(/^reveal-leader-row-/)
        await expect(leaderRows).toHaveCount(4)
        // NEXT ROUND CTA visible to all players (T-3.B).
        await expect(page.getByTestId("reveal-next-round-cta")).toBeVisible()
      }
    } finally {
      await session.dispose()
    }
  })
})
