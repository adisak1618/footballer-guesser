import { test, expect } from "@playwright/test"
import type { Page } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { createMultiRoleSession } from "./_helpers/multi-role"

// US-056 / Phase 5b.4b — Role reveal: MASTER view (the judge).
//
// Mirror of the Insider spec (US-055), but maps the page → 'master' role and
// asserts wireframe Screen 5b: info-blue role badge ("ผู้ตัดสิน / THE MASTER"),
// BIG NAME card on tag-pink (same color as Insider per D3 — phones look
// similar at a glance), instruction text "ตอบคำถามได้เพียง ใช่/ไม่ใช่/ไม่แน่ใจ".
// No warning scanline — that's Insider only.
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

test.describe.serial("insider role-reveal — MASTER view (US-056)", () => {
  test("Master sees judge badge, secret on tag-pink, advance_to_asking", async ({
    browser,
  }) => {
    const session = await createMultiRoleSession(browser, 4)
    try {
      const [hostPage, p2, p3, p4] = session.pages

      // ─── Host creates room via /new ───────────────────────────────────────
      await hostPage.goto(`${INSIDER_URL}/new`, {
        waitUntil: "domcontentloaded",
      })
      await hostPage.locator('input[type="text"]').first().fill("Host")
      await hostPage.getByTestId("pack-chip-football-premier-league").click()
      await hostPage.getByTestId("create-insider-room-cta").click()
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

      // ─── Wait for the round + roles to land ───────────────────────────────
      const masterPlayerId = await new Promise<string>((resolve, reject) => {
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
              .eq("role", "master")
              .maybeSingle()
            if (roles?.player_id) return resolve(roles.player_id as string)
          }
          if (Date.now() > deadline) {
            return reject(new Error("Timed out waiting for master role"))
          }
          setTimeout(tick, 300)
        }
        tick()
      })

      const { data: round } = await supabase
        .from("game_insider_round")
        .select("secret_value")
        .eq("room_id", roomId)
        .eq("round_number", 1)
        .single()
      const secret = (round!.secret_value as string).toUpperCase()

      // ─── Map masterPlayerId → page ────────────────────────────────────────
      const masterPage =
        pagePlayerIds.find((entry) => entry.playerId === masterPlayerId)
          ?.page ?? null
      expect(masterPage).not.toBeNull()

      // ─── Master sees judge treatment + secret on tag-pink ─────────────────
      // Wireframe Screen 5b: NO warning scanline (that's Insider only).
      await expect(
        masterPage!.getByTestId("insider-warning-scanline"),
      ).toHaveCount(0)

      const roleBadge = masterPage!.getByTestId("master-role-badge")
      await expect(roleBadge).toBeVisible({ timeout: 15_000 })
      await expect(roleBadge).toContainText("ผู้ตัดสิน")
      await expect(roleBadge).toContainText("THE MASTER")
      // info-blue #1d4ed8 outline — assert via computed border color so the
      // visual contract is locked to the test (per US-055 pattern).
      const borderColor = await roleBadge.evaluate(
        (el) => getComputedStyle(el).borderColor,
      )
      // rgb(29, 78, 216) === #1d4ed8
      expect(borderColor).toBe("rgb(29, 78, 216)")

      const secretCard = masterPage!.getByTestId("master-secret-card")
      await expect(secretCard).toBeVisible()
      await expect(secretCard).toContainText(secret)
      // tag-pink #ec4899 — same as Insider per D3 (phones look similar).
      const bg = await secretCard.evaluate(
        (el) => getComputedStyle(el).backgroundColor,
      )
      expect(bg).toBe("rgb(236, 72, 153)")

      const instruction = masterPage!.getByTestId("master-instruction-text")
      await expect(instruction).toContainText("ตอบคำถามได้เพียง")
      await expect(instruction).toContainText("ใช่")
      await expect(instruction).toContainText("ไม่ใช่")
      await expect(instruction).toContainText("ไม่แน่ใจ")

      // ─── CTA fires advance_to_asking; phase flips preparing → asking ──────
      const ready = masterPage!.getByTestId("insider-ready-cta")
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
