import { test, expect } from "@playwright/test"
import type { Page } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { createMultiRoleSession } from "./_helpers/multi-role"

// US-059 / Phase 5b.5b — Asking phase MASTER view (D1).
//
// Master sees Screen 6a:
//   - ASKING phase tag + countdown timer (Bebas; turns red <30s)
//   - Small "Secret: [WORD]" reminder (Bebas 32px on-dark-soft) — kept from
//     US-058's asymmetric privacy mechanism
//   - 3 huge response buttons stacked vertically (Yes / No / Unsure), each at
//     least 96px tall, calling master_respond
//   - Collapsed feed accordion below ("ตอบล่าสุด: ✓✗✓?✓"); tap to expand
//   - Distinct goal-red "✓ ทายถูกแล้ว" CTA at bottom calling mark_correct_guess
//
// Test flow (4 contexts):
//   1. Host setup, players join, host starts the round.
//   2. Wait for roles + 'preparing' phase, identify the Master page via
//      localStorage probe (same scaffold as US-055/056/057/058).
//   3. Insider (or any role) clicks ฉันพร้อมแล้ว → advance_to_asking.
//   4. Master sees the new view; assert the wireframe contract.
//   5. Master taps the YES button → game_insider_responses row inserted.
//      Master's collapsed-feed trail updates via Realtime to include "✓".
//   6. Master taps "ทายถูกแล้ว" → phase = 'guessed' in DB.

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

// TODO(#16 follow-up): exercises master_respond Y/N/Unsure buttons + feed,
// all removed in #16. New compact-header E2E lives in
// insider-asking-simplified.spec.ts. Restore or drop once master_respond RPC
// is dropped in a follow-up migration.
test.describe.skip("insider asking phase — Master view (US-059) [DEPRECATED #16]", () => {
  test("Master sees Screen 6a, taps Yes → response inserted + feed updates via Realtime", async ({
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
      await hostPage.waitForURL(/\/room\/[A-Z0-9]{6}$/, { timeout: 15_000 })
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

      // Capture player_id per page so we can map page → role after roles land.
      const pagePlayerIds: Array<{ page: Page; playerId: string | null }> = []
      for (const page of session.pages) {
        pagePlayerIds.push({ page, playerId: await readInsiderPlayerId(page) })
      }
      for (const entry of pagePlayerIds) {
        expect(entry.playerId).not.toBeNull()
      }

      // ─── Host starts game ──────────────────────────────────────────────────
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
      expect(masterRow).toBeTruthy()
      expect(insiderRow).toBeTruthy()

      const masterPage =
        pagePlayerIds.find((e) => e.playerId === masterRow.player_id)?.page ??
        null
      const insiderPage =
        pagePlayerIds.find((e) => e.playerId === insiderRow.player_id)?.page ??
        null
      expect(masterPage).not.toBeNull()
      expect(insiderPage).not.toBeNull()

      // Insider clicks ฉันพร้อมแล้ว → advance_to_asking (T-3.B: any player can).
      const ready = insiderPage!.getByTestId("insider-ready-cta")
      await expect(ready).toBeEnabled({ timeout: 15_000 })
      await ready.click()

      // ─── Master sees the asking-master shell ──────────────────────────────
      await expect(masterPage!.getByTestId("asking-phase-shell")).toBeVisible({
        timeout: 15_000,
      })

      // Phase tag visible.
      await expect(masterPage!.getByTestId("asking-phase-tag")).toContainText(
        /ASKING/i,
      )

      // Timer visible, mm:ss format.
      const timer = masterPage!.getByTestId("asking-timer")
      await expect(timer).toBeVisible()
      await expect(timer).toContainText(/^\d{2}:\d{2}$/)

      // Bebas 32px on-dark-soft secret reminder still rendered (US-058 invariant).
      const reminder = masterPage!.getByTestId("master-asking-secret-reminder")
      await expect(reminder).toBeVisible()
      const reminderStyle = await reminder.evaluate((el) => {
        const cs = getComputedStyle(el)
        return { fontSize: cs.fontSize, color: cs.color }
      })
      expect(reminderStyle.fontSize).toBe("32px")
      expect(reminderStyle.color).toBe("rgb(156, 163, 175)")

      // 3 response buttons each ≥96px tall.
      for (const r of ["yes", "no", "unsure"] as const) {
        const btn = masterPage!.getByTestId(`master-respond-${r}`)
        await expect(btn).toBeVisible()
        const h = await btn.evaluate((el) => el.getBoundingClientRect().height)
        expect(h).toBeGreaterThanOrEqual(96)
      }

      // Collapsed feed accordion visible, trail rendered (empty marker).
      const accordionToggle = masterPage!.getByTestId(
        "master-feed-accordion-toggle",
      )
      await expect(accordionToggle).toBeVisible()
      await expect(accordionToggle).toHaveAttribute("aria-expanded", "false")

      // The "ทายถูกแล้ว" CTA is goal-red and present at the bottom.
      const guessCta = masterPage!.getByTestId("master-mark-correct-cta")
      await expect(guessCta).toBeVisible()
      const guessBg = await guessCta.evaluate(
        (el) => getComputedStyle(el).backgroundColor,
      )
      expect(guessBg).toBe("rgb(230, 57, 70)") // --color-goal #e63946

      // ─── Master taps YES → response inserted, Realtime updates trail ──────
      const yesBtn = masterPage!.getByTestId("master-respond-yes")
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

      // Feed trail on the Master page reflects the new response via Realtime.
      const trail = masterPage!.getByTestId("master-feed-trail")
      await expect(trail).toContainText("✓", { timeout: 10_000 })

      // Expanding the accordion reveals the response list with one row.
      await accordionToggle.click()
      await expect(accordionToggle).toHaveAttribute("aria-expanded", "true")
      const list = masterPage!.getByTestId("master-feed-list")
      await expect(list).toBeVisible()
      await expect(list.locator("li")).toHaveCount(1)

      // ─── Master taps ทายถูกแล้ว → phase flips to 'guessed' ───────────────
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
          { timeout: 10_000, intervals: [200, 500, 1000] },
        )
        .toBe("guessed")
    } finally {
      await session.dispose()
    }
  })
})
