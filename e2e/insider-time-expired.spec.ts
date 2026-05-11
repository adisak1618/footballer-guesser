import { test, expect } from "@playwright/test"
import type { Page } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { createMultiRoleSession } from "./_helpers/multi-role"

// US-064 / Phase 5b.7c — Reveal screen — TIME EXPIRED variant (Screen 8c).
//
// When the asking-phase timer expires before the Master taps ทายถูกแล้ว,
// expire_round (migration 0026) flips game_insider_round.phase from 'asking'
// to 'result_failed'. lobby.tsx already routes 'result_failed' into the
// Reveal component (alongside 'reveal'). advance_to_reveal stamps scored_at
// without applying any score updates (migration 0028 — "asking-phase timeout
// → no scoring").
//
// All clients then see Screen 8c (DARK mode + error-red top accent):
//   - bg ink #0a0e1a (rgb(10, 14, 26))
//   - error-red top accent border (border-t-error)
//   - "ROUND N" + "TIME UP" + "ทายไม่ทันเวลา" (Thai subtitle)
//   - BIG NAME card revealing the secret (warning-yellow shell, ink text)
//   - "No voting this round." + "No points awarded." copy
//   - NO insider-was-X badge, NO scoreboard tiles, NO leaderboard
//   - NEXT ROUND CTA — anyone can click (T-3.B)
//
// Test flow (4 contexts):
//   1. Host setup, players 2-4 join, host starts the round.
//   2. Insider readies → asking phase begins.
//   3. Wait for phase='asking' AND started_at set on round 1.
//   4. Service-role client back-dates started_at by (time_limit_s + 60)s
//      so the deadline is provably in the past.
//   5. Service-role client calls expire_round → phase flips to 'result_failed'.
//   6. Wait for phase='result_failed' on round 1 AND scored_at stamped (the
//      first client to mount the Reveal screen fires advance_to_reveal,
//      which stamps scored_at without applying scores).
//   7. DB scoring contract: every player remains at 0 (Time-expired = no scoring).
//   8. All 4 pages see Screen 8c — dark shell, error-red accent, TIME UP
//      header, secret revealed, no-voting copy, NEXT ROUND CTA.
//   9. Host clicks NEXT ROUND → rooms.status flips back to 'LOBBY'.

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

test.describe.serial("insider reveal — time-expired variant (US-064)", () => {
  test("asking timer expires → time-expired reveal + no scoring + NEXT ROUND CTA", async ({
    browser,
  }) => {
    const session = await createMultiRoleSession(browser, 4)
    try {
      const [hostPage, p2, p3, p4] = session.pages

      // ─── Host creates room ──────────────────────────────────────────────
      await hostPage.goto(`${INSIDER_URL}/`, { waitUntil: "domcontentloaded" })
      await hostPage.getByTestId("insider-create-room-cta").click()
      await hostPage.getByTestId("insider-create-room-name-input").fill("Host")
      await hostPage.getByTestId("insider-create-room-submit").click()
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

      const insiderRow = roles.find((r) => r.role === "insider")!
      const insiderPage = pagePlayerIds.find(
        (e) => e.playerId === insiderRow.player_id,
      )!.page

      // ─── Insider readies → asking phase begins ──────────────────────────
      await expect(insiderPage.getByTestId("insider-ready-cta")).toBeEnabled({
        timeout: 15_000,
      })
      await insiderPage.getByTestId("insider-ready-cta").click()

      // ─── Wait for phase='asking' AND started_at set ─────────────────────
      const startedAt = await new Promise<string>((resolve, reject) => {
        const deadline = Date.now() + 15_000
        const tick = async () => {
          const { data } = await supabase
            .from("game_insider_round")
            .select("phase, started_at, time_limit_s")
            .eq("room_id", roomId)
            .eq("round_number", 1)
            .maybeSingle()
          if (data?.phase === "asking" && data.started_at) {
            return resolve(data.started_at as string)
          }
          if (Date.now() > deadline) {
            return reject(new Error("Timed out waiting for asking phase"))
          }
          setTimeout(tick, 300)
        }
        tick()
      })
      expect(startedAt).toBeTruthy()

      // ─── Force the deadline into the past via service role ──────────────
      // Backdate started_at so (now() >= started_at + time_limit_s) holds. Then
      // call expire_round to flip phase to 'result_failed'. This simulates the
      // client-side timer reaching zero in real-world play; expire_round is the
      // public RPC every client races to call when the countdown hits zero.
      const backdated = new Date(Date.now() - 10 * 60 * 1000).toISOString()
      const { error: updateError } = await supabase
        .from("game_insider_round")
        .update({ started_at: backdated })
        .eq("room_id", roomId)
        .eq("round_number", 1)
      expect(updateError).toBeNull()

      const { data: expired, error: expireError } = await supabase.rpc(
        "expire_round",
        { p_room_id: roomId, p_round: 1 },
      )
      expect(expireError).toBeNull()
      expect(expired).toBe(1)

      // ─── Phase advances to 'result_failed' AND scored_at stamps ─────────
      // advance_to_reveal fires from the Reveal mount on each client; with
      // result_failed it stamps scored_at without touching players.total_score.
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
        .toBe("result_failed")
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

      // ─── DB scoring contract: every player remains at 0 ─────────────────
      const { data: scored } = await supabase
        .from("players")
        .select("player_id, total_score")
        .eq("room_id", roomId)
      const scoreByPid = new Map(
        (scored ?? []).map((r) => [r.player_id as string, r.total_score as number]),
      )
      for (const r of roles) {
        expect(scoreByPid.get(r.player_id)).toBe(0)
      }

      // ─── All 4 pages see Screen 8c — time-expired reveal ────────────────
      for (const { page } of pagePlayerIds) {
        await expect(
          page.getByTestId("reveal-time-expired-shell"),
        ).toBeVisible({ timeout: 15_000 })
        // Dark mode background — bg-ink token = #0a0e1a → rgb(10, 14, 26).
        const shell = page.getByTestId("reveal-time-expired-shell")
        const bg = await shell.evaluate(
          (el) => getComputedStyle(el).backgroundColor,
        )
        expect(bg).toBe("rgb(10, 14, 26)")
        // "ROUND 1" header + TIME UP + Thai subtitle.
        await expect(
          page.getByTestId("reveal-time-expired-header"),
        ).toContainText(/TIME UP/i)
        await expect(
          page.getByTestId("reveal-time-expired-header"),
        ).toContainText("ทายไม่ทันเวลา")
        // BIG NAME secret card — secret_value rendered uppercase.
        await expect(page.getByTestId("reveal-secret-name")).toContainText(
          secret.toUpperCase(),
        )
        // "No voting" copy.
        await expect(
          page.getByTestId("reveal-no-voting-copy"),
        ).toBeVisible()
        // Variant must NOT show the caught/escaped insider badge or scoreboard.
        await expect(page.getByTestId("reveal-insider-badge")).toHaveCount(0)
        await expect(page.getByTestId(/^reveal-score-tile-/)).toHaveCount(0)
        await expect(page.getByTestId(/^reveal-leader-row-/)).toHaveCount(0)
        // NEXT ROUND CTA visible to all players (T-3.B).
        await expect(
          page.getByTestId("reveal-next-round-cta"),
        ).toBeVisible()
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
