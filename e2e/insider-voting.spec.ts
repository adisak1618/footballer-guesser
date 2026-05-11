import { test, expect } from "@playwright/test"
import type { Page } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { createMultiRoleSession } from "./_helpers/multi-role"

// US-061 / Phase 5b.6 — Voting phase screen (Screen 7 + D6).
//
// After Master clicks "ทายถูกแล้ว", phase flips to 'guessed' (with vote_deadline
// + eligible_voter_ids snapshotted by mark_correct_guess). After a 1-2s
// celebration UI the room auto-advances to 'voting' — a brand-new
// advance_to_voting RPC owns the guessed→voting edge per the C2.A state
// machine. Once 'voting' all 4 players see Screen 7:
//   - "VOTING" phase tag + 60s vote-deadline countdown
//   - "WHO IS THE INSIDER?" header (Anton 32px) + Thai subline
//   - 2-col grid of vote-target-card components (full tag-color bg, 120px tall,
//     player display name)
//   - Tap = goal-red ring + ✓ icon overlay; tap again de-selects; tap a
//     different player switches the selection
//   - NO per-player vote tallies during voting (D6 anti-herding)
//   - Group progress caption "X / 4 voted"
// After all 4 eligible voters cast → phase auto-advances to 'reveal' (driven
// by the cast_vote RPC's auto-flip when the final ballot lands).
//
// Test flow (4 contexts):
//   1. Host setup, players 2-4 join, host starts the round.
//   2. Wait for roles + 'preparing'; identify Master via localStorage probe.
//   3. Insider clicks ฉันพร้อมแล้ว → phase=asking.
//   4. Master taps ทายถูกแล้ว → phase=guessed → auto-advances to voting.
//   5. All 4 pages see voting-shell + 4 vote-target-cards.
//   6. Each page taps a target → cast_vote rows appear in DB.
//   7. Tap-toggle-deselect-then-reselect proves the selection contract.
//   8. After the final vote, phase flips to 'reveal'.

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

test.describe.serial("insider voting phase (US-061)", () => {
  test("4-player vote → cast_vote rows + selection toggle + auto-advance to reveal", async ({
    browser,
  }) => {
    const session = await createMultiRoleSession(browser, 4)
    try {
      const [hostPage, p2, p3, p4] = session.pages

      // ─── Host creates room ───────────────────────────────────────────────
      await hostPage.goto(`${INSIDER_URL}/`, { waitUntil: "domcontentloaded" })
      await hostPage.getByTestId("insider-create-room-cta").click()
      await hostPage.getByTestId("insider-create-room-name-input").fill("Host")
      await hostPage.getByTestId("insider-create-room-submit").click()
      await hostPage.waitForURL(/\/room\/[A-Z0-9]{6}$/, { timeout: 15_000 })
      const code = new URL(hostPage.url()).pathname.split("/").pop() ?? ""
      expect(code).toMatch(/^[A-Z0-9]{6}$/)

      // ─── Players 2-4 join ────────────────────────────────────────────────
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

      // ─── Host starts game ────────────────────────────────────────────────
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

      // ─── Wait for roles in 'preparing' ───────────────────────────────────
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

      // ─── Insider readies → asking ────────────────────────────────────────
      await expect(insiderPage!.getByTestId("insider-ready-cta")).toBeEnabled({
        timeout: 15_000,
      })
      await insiderPage!.getByTestId("insider-ready-cta").click()

      // ─── Master sees asking shell, taps ทายถูกแล้ว ──────────────────────
      await expect(masterPage!.getByTestId("asking-phase-shell")).toBeVisible({
        timeout: 15_000,
      })
      const guessCta = masterPage!.getByTestId("master-mark-correct-cta")
      await expect(guessCta).toBeVisible()
      await guessCta.click()

      // Phase must transition: guessed (briefly) → voting (auto-advance).
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

      // ─── All 4 pages see the voting shell ────────────────────────────────
      for (const page of session.pages) {
        await expect(page.getByTestId("voting-phase-shell")).toBeVisible({
          timeout: 15_000,
        })
        await expect(page.getByTestId("voting-phase-tag")).toContainText(
          /VOTING/i,
        )
        await expect(page.getByTestId("voting-deadline-timer")).toContainText(
          /^\d{2}:\d{2}$/,
        )
        // Header copy.
        await expect(page.getByTestId("voting-header")).toContainText(
          /WHO IS THE INSIDER/i,
        )
        // 4 vote-target-cards (one per player).
        const cards = page.getByTestId(/^vote-target-card-/)
        await expect(cards).toHaveCount(4)
        // No per-player tallies visible (D6) — count testids should be zero.
        const tallies = page.getByTestId(/^vote-tally-/)
        await expect(tallies).toHaveCount(0)
        // Group progress caption visible.
        await expect(page.getByTestId("voting-progress")).toContainText(
          /0\s*\/\s*4/,
        )
      }

      // ─── Vote-target-card 120px tall on host page (visual contract) ────
      const hostFirstCard = hostPage
        .getByTestId(/^vote-target-card-/)
        .first()
      const cardHeight = await hostFirstCard.evaluate(
        (el) => el.getBoundingClientRect().height,
      )
      expect(cardHeight).toBeGreaterThanOrEqual(120)

      // ─── Selection contract: tap → ring + ✓; tap again → de-select; ─────
      // ─── tap different player → switch — exercise on hostPage. ──────────
      // Skip the host's own card (disabled — can't vote self).
      const hostPlayerId = pagePlayerIds.find((e) => e.page === hostPage)!
        .playerId!
      const otherPlayerIds = pagePlayerIds
        .filter((e) => e.page !== hostPage)
        .map((e) => e.playerId!)
      expect(otherPlayerIds.length).toBe(3)

      const firstTarget = hostPage.getByTestId(
        `vote-target-card-${otherPlayerIds[0]}`,
      )
      const secondTarget = hostPage.getByTestId(
        `vote-target-card-${otherPlayerIds[1]}`,
      )

      // Tap first → selected.
      await firstTarget.click()
      await expect(firstTarget).toHaveAttribute("aria-pressed", "true")
      await expect(
        firstTarget.locator('[data-testid="vote-target-check"]'),
      ).toBeVisible()

      // Tap first again → de-selected.
      await firstTarget.click()
      await expect(firstTarget).toHaveAttribute("aria-pressed", "false")

      // Tap second → selected.
      await secondTarget.click()
      await expect(secondTarget).toHaveAttribute("aria-pressed", "true")
      await expect(firstTarget).toHaveAttribute("aria-pressed", "false")

      // Now host has voted for second player. Cast votes for the other 3
      // players — each picks any non-self card to commit a vote.
      for (const { page: otherPage, playerId } of pagePlayerIds.filter(
        (e) => e.page !== hostPage,
      )) {
        const otherTargetIds = pagePlayerIds
          .map((e) => e.playerId!)
          .filter((id) => id !== playerId)
        const targetId = otherTargetIds[0]
        const target = otherPage.getByTestId(`vote-target-card-${targetId}`)
        await target.click()
        await expect(target).toHaveAttribute("aria-pressed", "true")
      }
      // Suppress the unused-variable lint for hostPlayerId (kept for clarity).
      void hostPlayerId

      // ─── DB: 4 vote rows ─────────────────────────────────────────────────
      await expect
        .poll(
          async () => {
            const { count } = await supabase
              .from("game_insider_votes")
              .select("voter_player_id", { count: "exact", head: true })
              .eq("room_id", roomId)
              .eq("round_number", 1)
            return count ?? 0
          },
          { timeout: 15_000, intervals: [200, 500, 1000] },
        )
        .toBe(4)

      // ─── Phase auto-advances to 'reveal' once all eligible voted ────────
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
    } finally {
      await session.dispose()
    }
  })
})
