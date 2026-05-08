import { test, expect } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { createMultiRoleSession } from "./_helpers/multi-role"

// US-054 / Phase 5b.3 — Insider lobby screen with anyone-can-advance.
//
// Multi-context flow (4 phones at the table):
//   - Context 0: host visits /new, fills the form, creates a room → lands on
//     /room/<code>; host's player row is inserted by `create_insider_room`
//     (migration 0029).
//   - Contexts 1-3: navigate to /room/<code>, fill display name, click JOIN
//     (calls cross-game `join_room` RPC from migration 0002).
//   - All 4 see player chips populate via Realtime on `players`.
//   - Host clicks START GAME → `start_insider_round` (migration 0023) flips
//     rooms.status to PLAYING and inserts a `game_insider_round` row in
//     phase='preparing'.

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321"
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"

const INSIDER_PORT = process.env.INSIDER_PORT ?? "3002"
const INSIDER_URL = `http://localhost:${INSIDER_PORT}`

test.describe.serial("insider lobby (US-054)", () => {
  test("4 contexts join, START GAME advances to preparing", async ({
    browser,
  }) => {
    const session = await createMultiRoleSession(browser, 4)
    try {
      const [hostPage, p2, p3, p4] = session.pages

      // ─── Host: create room via /new ───────────────────────────────────────
      await hostPage.goto(`${INSIDER_URL}/new`, {
        waitUntil: "domcontentloaded",
      })
      await hostPage.locator('input[type="text"]').first().fill("Host")
      await hostPage
        .getByTestId("pack-chip-football-premier-league")
        .click()
      await hostPage.getByTestId("create-insider-room-cta").click()
      await hostPage.waitForURL(/\/room\/[A-Z0-9]{6}$/, { timeout: 15_000 })

      const roomUrl = hostPage.url()
      const code = new URL(roomUrl).pathname.split("/").pop() ?? ""
      expect(code).toMatch(/^[A-Z0-9]{6}$/)

      // Host sees the lobby with their own chip.
      await expect(hostPage.getByTestId("insider-room-code")).toHaveText(code)
      await expect(
        hostPage.getByTestId("insider-player-list"),
      ).toContainText("Host")

      // ─── Players 2-4: navigate to /room/<code> and join ───────────────────
      const joiners: Array<{ page: typeof p2; name: string }> = [
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
        await expect(page.getByTestId("insider-player-list")).toContainText(
          name,
        )
      }

      // ─── All 4 see all 4 player chips populate (Realtime) ─────────────────
      for (const page of session.pages) {
        const list = page.getByTestId("insider-player-list")
        await expect(list).toContainText("Host", { timeout: 15_000 })
        await expect(list).toContainText("Player Two", { timeout: 15_000 })
        await expect(list).toContainText("Player Three", { timeout: 15_000 })
        await expect(list).toContainText("Player Four", { timeout: 15_000 })
      }

      // ─── Host clicks START GAME (T-3.B: any-player UI; host RPC succeeds) ─
      const startCta = hostPage.getByTestId("insider-start-game-cta")
      await expect(startCta).toBeEnabled({ timeout: 15_000 })
      await startCta.click()

      // ─── Verify game_insider_round row exists with phase='preparing' ──────
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      await expect
        .poll(
          async () => {
            const { data: room } = await supabase
              .from("rooms")
              .select("id, status, current_round")
              .eq("code", code)
              .single()
            if (!room) return null
            const { data: round } = await supabase
              .from("game_insider_round")
              .select("phase, round_number")
              .eq("room_id", room.id)
              .eq("round_number", room.current_round ?? 1)
              .maybeSingle()
            return round?.phase ?? null
          },
          { timeout: 15_000, intervals: [500, 1000, 2000] },
        )
        .toBe("preparing")
    } finally {
      await session.dispose()
    }
  })
})
