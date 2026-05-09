import { test, expect } from "@playwright/test"
import type { Page } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { createMultiRoleSession } from "./_helpers/multi-role"

// US-060 / Phase 5b.5c — Asking phase non-Master view (Screen 6b).
//
// Insider and Common share an identical asking-phase shell:
//   - Phase tag (ASKING) + countdown timer (Bebas; turns red <30s)
//   - "ASK OUT LOUD / ถามดัง ๆ" instruction (Anton 24px)
//   - Full-height response feed (reverse-chronological, scrollable)
//   - Subscribes to game_insider_responses INSERTs via Realtime
//
// Insider-only addition (D2): a subtle warning-yellow caption "💡 Drop a
// question they can use" exists in the DOM and fades in after 30s of silence.
// Common's view never renders the hint at all (count=0) — the asymmetric
// element is structural, not just visual.
//
// Test flow (4 contexts):
//   1. Standard host setup, players join, host starts the round.
//   2. Map page → role via localStorage probe (same scaffold as US-058/059).
//   3. Insider clicks ฉันพร้อมแล้ว → advance_to_asking.
//   4. Both Insider and Common pages mount the asking-other shell.
//   5. Assert the wireframe contract on both.
//   6. Master responds Yes → both Insider's and Common's feeds receive the
//      INSERT via Realtime.
//   7. Hint testid exists only on Insider page; never on Common page.
//   8. The shared (non-hint) DOM is identical between Insider and Common.

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

test.describe.serial("insider asking phase — non-Master view (US-060)", () => {
  test("Insider + Common see Screen 6b; Realtime feed updates; hint Insider-only", async ({
    browser,
  }) => {
    const session = await createMultiRoleSession(browser, 4)
    try {
      const [hostPage, p2, p3, p4] = session.pages

      // ─── Host creates room via /new ────────────────────────────────────────
      await hostPage.goto(`${INSIDER_URL}/new`, {
        waitUntil: "domcontentloaded",
      })
      await hostPage.locator('input[type="text"]').first().fill("Host")
      await hostPage.getByTestId("pack-chip-football-premier-league").click()
      await hostPage.getByTestId("create-insider-room-cta").click()
      // 30s tolerates the documented Next-16 cold-compile flake (progress.txt
      // note 68) when this spec runs late in a multi-spec suite.
      await hostPage.waitForURL(/\/room\/[A-Z0-9]{6}$/, { timeout: 30_000 })
      const code = new URL(hostPage.url()).pathname.split("/").pop() ?? ""
      expect(code).toMatch(/^[A-Z0-9]{6}$/)

      // ─── Players 2-4 join ──────────────────────────────────────────────────
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

      const pagePlayerIds: Array<{ page: Page; playerId: string | null }> = []
      for (const page of session.pages) {
        pagePlayerIds.push({ page, playerId: await readInsiderPlayerId(page) })
      }
      for (const entry of pagePlayerIds) {
        expect(entry.playerId).not.toBeNull()
      }

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

      // ─── Wait for round + roles in 'preparing' ────────────────────────────
      type RoleRow = { player_id: string; role: string }
      const roles = await new Promise<RoleRow[]>((resolve, reject) => {
        const deadline = Date.now() + 15_000
        const tick = async () => {
          const { data: round } = await supabase
            .from("game_insider_round")
            .select("phase")
            .eq("room_id", roomId)
            .eq("round_number", 1)
            .maybeSingle()
          if (round?.phase === "preparing") {
            const { data: rs } = await supabase
              .from("game_insider_roles")
              .select("player_id, role")
              .eq("room_id", roomId)
              .eq("round_number", 1)
            if (rs && rs.length === 4) return resolve(rs as RoleRow[])
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
      // The 4-player layout always assigns master + insider + two players.
      const commonRows = roles.filter((r) => r.role === "player")
      expect(masterRow).toBeTruthy()
      expect(insiderRow).toBeTruthy()
      expect(commonRows.length).toBeGreaterThanOrEqual(1)

      const masterPage =
        pagePlayerIds.find((e) => e.playerId === masterRow.player_id)?.page ??
        null
      const insiderPage =
        pagePlayerIds.find((e) => e.playerId === insiderRow.player_id)?.page ??
        null
      const commonPage =
        pagePlayerIds.find((e) => e.playerId === commonRows[0].player_id)
          ?.page ?? null
      expect(masterPage).not.toBeNull()
      expect(insiderPage).not.toBeNull()
      expect(commonPage).not.toBeNull()

      // Insider clicks ฉันพร้อมแล้ว → advance_to_asking (T-3.B: any player can).
      const ready = insiderPage!.getByTestId("insider-ready-cta")
      await expect(ready).toBeEnabled({ timeout: 15_000 })
      await ready.click()

      // Wait for phase flip in DB.
      await expect
        .poll(
          async () => {
            const { data: r } = await supabase
              .from("game_insider_round")
              .select("phase")
              .eq("room_id", roomId)
              .eq("round_number", 1)
              .maybeSingle()
            return r?.phase ?? null
          },
          { timeout: 15_000, intervals: [500, 1000, 2000] },
        )
        .toBe("asking")

      // ─── Assert Screen 6b on Insider + Common ────────────────────────────
      for (const page of [insiderPage!, commonPage!]) {
        await expect(page.getByTestId("asking-phase-shell")).toBeVisible({
          timeout: 15_000,
        })
        await expect(page.getByTestId("asking-phase-tag")).toContainText(
          /ASKING/i,
        )
        const timer = page.getByTestId("asking-timer")
        await expect(timer).toBeVisible()
        await expect(timer).toContainText(/^\d{2}:\d{2}$/)
        const instruction = page.getByTestId("asking-other-instruction")
        await expect(instruction).toBeVisible()
        await expect(instruction).toContainText(/ASK OUT LOUD/i)
        await expect(instruction).toContainText(/ถามดัง ๆ/)
        const feed = page.getByTestId("asking-other-feed")
        await expect(feed).toBeVisible()
        // Empty-state copy from DESIGN.md spec additions.
        await expect(feed).toContainText(/ยังไม่มีคำตอบ/)
      }

      // Hint exists on Insider only.
      await expect(
        insiderPage!.getByTestId("asking-other-insider-hint"),
      ).toHaveCount(1)
      await expect(
        commonPage!.getByTestId("asking-other-insider-hint"),
      ).toHaveCount(0)

      // Hint contains the canonical D2 caption.
      const hint = insiderPage!.getByTestId("asking-other-insider-hint")
      await expect(hint).toContainText(/Drop a question they can use/i)

      // ─── Master taps YES → both non-Master feeds update via Realtime ─────
      const yesBtn = masterPage!.getByTestId("master-respond-yes")
      await expect(yesBtn).toBeVisible({ timeout: 15_000 })
      await yesBtn.click()

      await expect
        .poll(
          async () => {
            const { count } = await supabase
              .from("game_insider_responses")
              .select("id", { count: "exact", head: true })
              .eq("room_id", roomId)
              .eq("round_number", 1)
              .eq("response", "yes")
            return count ?? 0
          },
          { timeout: 10_000, intervals: [200, 500, 1000] },
        )
        .toBe(1)

      for (const page of [insiderPage!, commonPage!]) {
        const feed = page.getByTestId("asking-other-feed")
        await expect(feed.locator("li")).toHaveCount(1, { timeout: 10_000 })
        await expect(feed).toContainText(/YES|ใช่/)
      }

      // ─── D4 parity: shared (non-hint) DOM identical for Insider + Common ──
      const sharedSelector = '[data-testid="asking-phase-shell"]'
      const evalShellText = (page: Page) =>
        page.evaluate((sel: string) => {
          const root = document.querySelector(sel) as HTMLElement | null
          if (!root) return ""
          const clone = root.cloneNode(true) as HTMLElement
          clone
            .querySelectorAll('[data-testid="asking-other-insider-hint"]')
            .forEach((el) => el.remove())
          // Collapse whitespace + neutralise the timer (ticks per-page).
          const timer = clone.querySelector('[data-testid="asking-timer"]')
          if (timer) timer.textContent = "TIMER"
          // Same for relative timestamps in feed rows.
          clone
            .querySelectorAll('[data-testid="asking-other-feed-time"]')
            .forEach((el) => {
              el.textContent = "TIME"
            })
          return clone.textContent?.replace(/\s+/g, " ").trim() ?? ""
        }, sharedSelector)
      const insiderText = await evalShellText(insiderPage!)
      const commonText = await evalShellText(commonPage!)
      expect(insiderText).toBe(commonText)
    } finally {
      await session.dispose()
    }
  })
})
