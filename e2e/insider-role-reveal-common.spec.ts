import { test, expect } from "@playwright/test"
import type { Page } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { createMultiRoleSession } from "./_helpers/multi-role"

// US-057 / Phase 5b.4c — Role reveal: COMMON view (mystery placeholder).
//
// Multi-context flow (4 phones at the table) — same scaffold as Insider/Master.
// One of the 4 contexts is a Common; we identify it by reading
// `game_insider_roles` for role='player' and mapping back to the
// localStorage `insider_player_id`. The Common page must render wireframe 5c:
// hairline-neutral role badge ("ผู้เล่น / PLAYER"), ??? mystery placeholder
// card on surface-elevated bg, instruction "ถามคำถามใช่/ไม่ใช่ เพื่อหาคำลับ",
// warning hint "มีคนวงในซ่อนอยู่ในกลุ่ม" in warning-yellow.
//
// Common players still call get_my_insider_secret — the RPC returns NULL
// for them (column-RLS protected; see migration 0021 / pattern note 30) and
// the UI must not blow up on the null return.
//
// CTA → advance_to_asking; phase flips 'preparing' → 'asking' (T-3.B: any
// player can fire).

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

test.describe.serial("insider role-reveal — COMMON view (US-057)", () => {
  test("Common sees neutral badge, ??? placeholder, warning hint, advance_to_asking", async ({
    browser,
  }) => {
    const session = await createMultiRoleSession(browser, 4)
    try {
      const [hostPage, p2, p3, p4] = session.pages

      // ─── Host creates room via /new ───────────────────────────────────────
      await hostPage.goto(`${INSIDER_URL}/`, { waitUntil: "domcontentloaded" })
      await hostPage.getByTestId("insider-create-room-cta").click()
      await hostPage.getByTestId("insider-create-room-name-input").fill("Host")
      await hostPage.getByTestId("insider-create-room-submit").click()
      await hostPage.waitForURL(/\/room\/[A-Z0-9]{6}$/, { timeout: 15_000 })
      const code = new URL(hostPage.url()).pathname.split("/").pop() ?? ""
      expect(code).toMatch(/^[A-Z0-9]{6}$/)

      // ─── Players 2-4 join ─────────────────────────────────────────────────
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

      // Capture each context's localStorage player_id BEFORE start (so we can
      // map page → player after roles are assigned).
      const pagePlayerIds: Array<{ page: Page; playerId: string | null }> = []
      for (const page of session.pages) {
        pagePlayerIds.push({ page, playerId: await readInsiderPlayerId(page) })
      }
      for (const entry of pagePlayerIds) {
        expect(entry.playerId).not.toBeNull()
      }

      // ─── Host starts game ─────────────────────────────────────────────────
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

      // ─── Wait for the round + roles to land; pick first 'player' role ─────
      const commonPlayerId = await new Promise<string>((resolve, reject) => {
        const deadline = Date.now() + 15_000
        const tick = async () => {
          const { data: round } = await supabase
            .from("game_insider_round")
            .select("phase")
            .eq("room_id", roomId)
            .eq("round_number", 1)
            .maybeSingle()
          if (round?.phase === "preparing") {
            const { data: roles } = await supabase
              .from("game_insider_roles")
              .select("player_id, role")
              .eq("room_id", roomId)
              .eq("round_number", 1)
              .eq("role", "player")
              .limit(1)
              .maybeSingle()
            if (roles?.player_id) return resolve(roles.player_id as string)
          }
          if (Date.now() > deadline) {
            return reject(new Error("Timed out waiting for common role"))
          }
          setTimeout(tick, 300)
        }
        tick()
      })

      // ─── Map commonPlayerId → page ────────────────────────────────────────
      const commonPage =
        pagePlayerIds.find((entry) => entry.playerId === commonPlayerId)
          ?.page ?? null
      expect(commonPage).not.toBeNull()

      // ─── Common sees neutral treatment + mystery placeholder ──────────────
      // Wireframe Screen 5c: NO warning scanline (Insider only).
      await expect(
        commonPage!.getByTestId("insider-warning-scanline"),
      ).toHaveCount(0)

      const roleBadge = commonPage!.getByTestId("common-role-badge")
      await expect(roleBadge).toBeVisible({ timeout: 15_000 })
      await expect(roleBadge).toContainText("ผู้เล่น")
      await expect(roleBadge).toContainText("PLAYER")
      // hairline-neutral #2a3146 outline — assert via computed border color
      // so the visual contract is locked to the test (per US-055 pattern).
      const borderColor = await roleBadge.evaluate(
        (el) => getComputedStyle(el).borderColor,
      )
      // rgb(42, 49, 70) === #2a3146
      expect(borderColor).toBe("rgb(42, 49, 70)")

      // ??? mystery placeholder — surface-elevated #1c2236 bg.
      const mysteryCard = commonPage!.getByTestId("common-mystery-card")
      await expect(mysteryCard).toBeVisible()
      await expect(mysteryCard).toContainText("???")
      const mysteryBg = await mysteryCard.evaluate(
        (el) => getComputedStyle(el).backgroundColor,
      )
      // rgb(28, 34, 54) === #1c2236
      expect(mysteryBg).toBe("rgb(28, 34, 54)")

      const instruction = commonPage!.getByTestId("common-instruction-text")
      await expect(instruction).toContainText("ถามคำถามใช่/ไม่ใช่")
      await expect(instruction).toContainText("เพื่อหาคำลับ")

      // Warning hint in warning-yellow (--color-warning #fbbf24).
      const warning = commonPage!.getByTestId("common-warning-hint")
      await expect(warning).toContainText("มีคนวงในซ่อนอยู่ในกลุ่ม")
      const warningColor = await warning.evaluate(
        (el) => getComputedStyle(el).color,
      )
      // rgb(251, 191, 36) === #fbbf24 (warning-yellow per tokens.css)
      expect(warningColor).toBe("rgb(251, 191, 36)")

      // ─── CTA fires advance_to_asking; phase flips preparing → asking ──────
      const ready = commonPage!.getByTestId("insider-ready-cta")
      await expect(ready).toBeEnabled()
      await ready.click()

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
    } finally {
      await session.dispose()
    }
  })
})
