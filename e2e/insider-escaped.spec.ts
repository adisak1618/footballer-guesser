import { test, expect } from "@playwright/test"
import type { Page } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { createMultiRoleSession } from "./_helpers/multi-role"

// US-063 / Phase 5b.7b — Reveal screen — INSIDER ESCAPED variant (Screen 8b).
//
// After all 4 eligible voters cast and the group's top-voted player is NOT
// the Insider, advance_to_reveal computes the escaped outcome:
//   - Insider                                +3 pts
//   - Master + each Common (role='player')   +0 pts
// All clients then see Screen 8b (DARK mode + warning-yellow accent):
//   - bg ink #0a0e1a (rgb(10, 14, 26)) — opposite of the light caught shell
//   - "ROUND N RESULT" header
//   - BIG NAME card revealing the secret (same shell as 8a, dark text)
//   - "👁 X — ESCAPED!" badge with warning-yellow accent
//   - "You voted: <name> (N vote)" — current player's ballot + insider's
//     vote count (zero or more — the insider can still receive votes; just
//     not the top set)
//   - Round-scores tiles (insider +3, others 0)
//   - Leaderboard sorted by total_score desc
//   - NEXT ROUND CTA — anyone can click (T-3.B), calls advance_to_next_round
//
// Test flow (4 contexts) — mirrors insider-caught.spec.ts shape:
//   1. Host setup, players 2-4 join, host starts the round.
//   2. Insider readies → asking phase.
//   3. Master taps ทายถูกแล้ว → guessed → voting (auto-advance).
//   4. Each player picks a non-insider non-self target so the insider gets
//      ZERO votes and the top-vote set excludes them. Concretely the two
//      Commons + the Insider all vote for the SAME Common (commonA) and the
//      Master votes for the OTHER Common (commonB) since the master can't
//      vote for self via UI (handleTap disables isMeRow). commonA collects
//      3 votes (top set = {commonA}), commonB 1, insider 0 → ESCAPED.
//   5. Wait for phase='reveal' AND scored_at stamped.
//   6. DB scoring: insider +3, everyone else 0.
//   7. All 4 pages see Screen 8b — dark shell, "ESCAPED!" badge, scoreboard,
//      leaderboard, NEXT ROUND CTA.
//   8. Click NEXT ROUND on host page → rooms.status flips back to 'LOBBY'.

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

test.describe.serial("insider reveal — escaped variant (US-063)", () => {
  test("group misses Insider → escaped reveal + scoring + NEXT ROUND CTA", async ({
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
      const { roles, secret } = await new Promise<{
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

      // ─── Voting — pick targets so the Insider receives ZERO votes ──────
      // Master, Insider, commonB all vote for commonA (commonA gets 3 votes).
      // commonA can't self-vote (UI gate isMeRow), so commonA votes commonB
      // (commonB gets 1 vote). Insider receives 0 votes → escaped.
      const voteTargetByPid: Record<string, string> = {
        [masterRow.player_id]: commonA.player_id,
        [insiderRow.player_id]: commonA.player_id,
        [commonA.player_id]: commonB.player_id,
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

      // ─── DB scoring contract: insider +3, all others 0 ─────────────────
      const { data: scored } = await supabase
        .from("players")
        .select("player_id, total_score")
        .eq("room_id", roomId)
      const scoreByPid = new Map(
        (scored ?? []).map((r) => [r.player_id as string, r.total_score as number]),
      )
      expect(scoreByPid.get(insiderRow.player_id)).toBe(3)
      const nonInsiderRoles = roles.filter((r) => r.role !== "insider")
      for (const r of nonInsiderRoles) {
        expect(scoreByPid.get(r.player_id)).toBe(0)
      }

      // ─── All 4 pages see Screen 8b — escaped reveal ────────────────────
      for (const { page } of pagePlayerIds) {
        await expect(page.getByTestId("reveal-escaped-shell")).toBeVisible({
          timeout: 15_000,
        })
        // Dark mode background — bg-ink token = #0a0e1a → rgb(10, 14, 26).
        const shell = page.getByTestId("reveal-escaped-shell")
        const bg = await shell.evaluate((el) => getComputedStyle(el).backgroundColor)
        expect(bg).toBe("rgb(10, 14, 26)")
        // ROUND 1 RESULT heading.
        await expect(page.getByTestId("reveal-round-header")).toContainText(
          /ROUND 1 RESULT/i,
        )
        // BIG NAME secret card — secret_value rendered uppercase.
        await expect(page.getByTestId("reveal-secret-name")).toContainText(
          secret.toUpperCase(),
        )
        // INSIDER WAS X — ESCAPED badge with warning-yellow accent.
        const badge = page.getByTestId("reveal-insider-badge")
        await expect(badge).toBeVisible()
        await expect(badge).toContainText(/ESCAPED/i)
        // Per-player ballot summary ("You voted: <name> (N vote(s))").
        await expect(page.getByTestId("reveal-your-vote")).toBeVisible()
        // Round-scores tiles: 4 entries.
        const scoreTiles = page.getByTestId(/^reveal-score-tile-/)
        await expect(scoreTiles).toHaveCount(4)
        // Leaderboard: 4 entries.
        const leaderRows = page.getByTestId(/^reveal-leader-row-/)
        await expect(leaderRows).toHaveCount(4)
        // NEXT ROUND CTA visible to all players (T-3.B).
        await expect(page.getByTestId("reveal-next-round-cta")).toBeVisible()
      }

      // ─── Click NEXT ROUND → room flips back to LOBBY ────────────────────
      await hostPage.getByTestId("reveal-next-round-cta").click()
      await expect
        .poll(
          async () => {
            const { data } = await supabase
              .from("rooms")
              .select("status")
              .eq("id", roomId)
              .maybeSingle()
            return data?.status ?? null
          },
          { timeout: 15_000, intervals: [200, 500, 1000] },
        )
        .toBe("LOBBY")
    } finally {
      await session.dispose()
    }
  })
})
