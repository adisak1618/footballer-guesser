import { test, expect } from "@playwright/test"
import type { Page } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { createMultiRoleSession } from "./_helpers/multi-role"

// US-055 / Phase 5b.4a — Role reveal: INSIDER view (the asymmetric drama).
//
// Multi-context flow (4 phones at the table):
//   - Host creates a room via /new and joins as host.
//   - Players 2-4 join via /room/<code>.
//   - Host clicks START GAME → start_insider_round (migration 0023) flips
//     rooms.status to PLAYING and inserts a `game_insider_round` row in
//     phase='preparing'. Roles are randomly assigned: 1 master, 1 insider,
//     N-2 commons.
//   - The page whose player_id was assigned 'insider' renders the INSIDER
//     variant of the role-reveal screen with the secret + warning treatment.
//   - That page clicks ฉันพร้อมแล้ว → advance_to_asking (T-3.B), phase flips
//     'preparing' → 'asking'.

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321"
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"

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

test.describe.serial("insider role-reveal — INSIDER view (US-055)", () => {
  test("Insider sees warning treatment, secret on tag-pink, advance_to_asking", async ({
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
      const insiderPlayerId = await new Promise<string>((resolve, reject) => {
        const deadline = Date.now() + 15_000
        const tick = async () => {
          const { data: round } = await supabase
            .from("game_insider_round")
            .select("phase, secret_value")
            .eq("room_id", roomId)
            .eq("round_number", 1)
            .maybeSingle()
          if (round?.phase === "preparing") {
            const { data: roles } = await supabase
              .from("game_insider_roles")
              .select("player_id, role")
              .eq("room_id", roomId)
              .eq("round_number", 1)
              .eq("role", "insider")
              .maybeSingle()
            if (roles?.player_id) return resolve(roles.player_id as string)
          }
          if (Date.now() > deadline) {
            return reject(new Error("Timed out waiting for insider role"))
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

      // ─── Map insiderPlayerId → page ───────────────────────────────────────
      const insiderPage =
        pagePlayerIds.find((entry) => entry.playerId === insiderPlayerId)
          ?.page ?? null
      expect(insiderPage).not.toBeNull()

      // ─── Insider sees the warning treatment + secret on tag-pink ──────────
      const scanline = insiderPage!.getByTestId("insider-warning-scanline")
      await expect(scanline).toBeVisible({ timeout: 15_000 })

      const roleBadge = insiderPage!.getByTestId("insider-role-badge")
      await expect(roleBadge).toBeVisible()
      await expect(roleBadge).toContainText("คนวงใน")
      await expect(roleBadge).toContainText("THE INSIDER")

      const secretCard = insiderPage!.getByTestId("insider-secret-card")
      await expect(secretCard).toBeVisible()
      await expect(secretCard).toContainText(secret)
      // tag-pink #ec4899 is set on the secret card via bg-tag-pink utility.
      const bg = await secretCard.evaluate(
        (el) => getComputedStyle(el).backgroundColor,
      )
      // rgb(236, 72, 153) === #ec4899
      expect(bg).toBe("rgb(236, 72, 153)")

      const mission = insiderPage!.getByTestId("insider-mission-text")
      await expect(mission).toContainText("คุณรู้คำตอบแล้ว")

      // ─── CTA fires advance_to_asking; phase flips preparing → asking ──────
      const ready = insiderPage!.getByTestId("insider-ready-cta")
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
