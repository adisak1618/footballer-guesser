import { test, expect } from "@playwright/test"
import type { Page } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { createMultiRoleSession } from "./_helpers/multi-role"

// Issue #16 — Simplified Insider asking phase + compact in-game header.
//
// Replaces the bulk of insider-asking-master.spec.ts and
// insider-asking-other.spec.ts (both .skip'd in #16). The new asking flow:
//
//   - Master: shared compact header (badge + Thai how-to + timer) + secret
//     reminder + a single ทายถูกแล้ว action. No Y/N/Unsure, no feed.
//   - Insider: shared compact header + secret word inline + ASK OUT LOUD
//     instruction. No D2 hint, no feed.
//   - Common: shared compact header + ASK OUT LOUD instruction. No badge
//     or secret in header beyond the role label, no feed.
//
// Test flow (4 contexts):
//   1. Standard host setup, players join, host starts the round.
//   2. Map page → role via localStorage probe.
//   3. Insider clicks ฉันพร้อมแล้ว → advance_to_asking.
//   4. Assert per-role rubric contract on each of the three pages.
//   5. Master taps ทายถูกแล้ว → phase flips to 'guessed'.

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

test.describe.serial("insider asking phase — simplified (#16)", () => {
  test("each role shows compact header; Master CTA flips phase to guessed", async ({
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
      await hostPage.waitForURL(/\/room\/[A-Z0-9]{6}$/, { timeout: 30_000 })
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

      // ─── Wait for roles in 'preparing' ──────────────────────────────────
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
      const commonRow = roles.find((r) => r.role === "player")!

      const masterPage = pagePlayerIds.find(
        (e) => e.playerId === masterRow.player_id,
      )!.page
      const insiderPage = pagePlayerIds.find(
        (e) => e.playerId === insiderRow.player_id,
      )!.page
      const commonPage = pagePlayerIds.find(
        (e) => e.playerId === commonRow.player_id,
      )!.page

      // Capture the round secret for the inline-secret assertion below.
      const { data: roundRow } = await supabase
        .from("game_insider_round")
        .select("secret_value")
        .eq("room_id", roomId)
        .eq("round_number", 1)
        .single()
      const secret = (roundRow!.secret_value as string).toUpperCase()

      // Insider clicks ฉันพร้อมแล้ว → advance_to_asking.
      const ready = insiderPage.getByTestId("insider-ready-cta")
      await expect(ready).toBeEnabled({ timeout: 15_000 })
      await ready.click()

      // ─── Per-role rubric contract ───────────────────────────────────────
      // Common cross-role: header + ASKING tag + timer + role-specific copy.
      for (const page of [masterPage, insiderPage, commonPage]) {
        await expect(page.getByTestId("asking-phase-shell")).toBeVisible({
          timeout: 15_000,
        })
        await expect(page.getByTestId("asking-header")).toBeVisible()
        await expect(page.getByTestId("asking-phase-tag")).toContainText(
          /ASKING/i,
        )
        const timer = page.getByTestId("asking-timer")
        await expect(timer).toBeVisible()
        await expect(timer).toContainText(/^\d{2}:\d{2}$/)
      }

      // Master role badge + Thai how-to + ทายถูกแล้ว CTA + secret reminder.
      await expect(
        masterPage.getByTestId("asking-master-role-badge"),
      ).toBeVisible()
      await expect(masterPage.getByTestId("asking-master-howto")).toContainText(
        "รู้คำลับ ตอบคำถามด้วยปาก กดปุ่มเมื่อมีคนทายถูก",
      )
      await expect(
        masterPage.getByTestId("master-asking-secret-reminder"),
      ).toContainText(secret)
      const guessCta = masterPage.getByTestId("master-mark-correct-cta")
      await expect(guessCta).toBeVisible()
      await expect(guessCta).toContainText(/ทายถูกแล้ว/)
      // ทายถูกแล้ว is the ONLY primary action — no Y/N/Unsure buttons.
      await expect(masterPage.getByTestId("master-respond-yes")).toHaveCount(0)
      await expect(masterPage.getByTestId("master-respond-no")).toHaveCount(0)
      await expect(
        masterPage.getByTestId("master-respond-unsure"),
      ).toHaveCount(0)

      // Insider role badge + Thai how-to + secret inline; no ทายถูกแล้ว.
      await expect(
        insiderPage.getByTestId("asking-insider-role-badge"),
      ).toBeVisible()
      await expect(insiderPage.getByTestId("asking-insider-howto")).toContainText(
        "รู้คำลับ ช่วยให้กลุ่มทายถูกอย่างเนียน ๆ อย่าให้โดนจับ",
      )
      const insiderSecret = insiderPage.getByTestId("asking-insider-secret")
      await expect(insiderSecret).toBeVisible()
      await expect(insiderSecret).toContainText(secret)
      await expect(
        insiderPage.getByTestId("master-mark-correct-cta"),
      ).toHaveCount(0)
      // Removed in #16: Insider hint, response feed.
      await expect(
        insiderPage.getByTestId("asking-other-insider-hint"),
      ).toHaveCount(0)
      await expect(insiderPage.getByTestId("asking-other-feed")).toHaveCount(0)

      // Common role badge + Thai how-to; no secret, no ทายถูกแล้ว.
      await expect(
        commonPage.getByTestId("asking-common-role-badge"),
      ).toBeVisible()
      await expect(commonPage.getByTestId("asking-common-howto")).toContainText(
        "ไม่รู้คำลับ ถามคำถามให้กลุ่มหาคำให้เจอ และจับ Insider ให้ได้",
      )
      await expect(
        commonPage.getByTestId("asking-insider-secret"),
      ).toHaveCount(0)
      await expect(
        commonPage.getByTestId("master-mark-correct-cta"),
      ).toHaveCount(0)

      // ─── Master taps ทายถูกแล้ว → phase = 'guessed' (no regression) ─────
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
