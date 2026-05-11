import { test, expect } from "@playwright/test"
import type { Page } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { createMultiRoleSession } from "./_helpers/multi-role"

// US-073 / Phase 5c.8 — A11y: prefers-reduced-motion respected on reveal screen.
//
// All 4 contexts opt into `reducedMotion: 'reduce'` so the OS-level media
// query `(prefers-reduced-motion: reduce)` matches inside Chromium. The spec
// drives a full Insider round to the CAUGHT reveal variant (Screen 8a — the
// most decoration-heavy of the three reveal variants) and asserts that the
// flagship reveal animations the Phase 5d polish pass will introduce all
// degrade gracefully under reduced-motion:
//
//   1. BIG NAME card has NO transform animation. Computed `transform` is
//      `none` (no scale/rotate/translate is mid-flight).
//   2. NO confetti DOM elements anywhere on the page (count of any element
//      whose `data-testid` matches `^reveal-confetti` is zero — a
//      future-proof contract for the polish-pass implementation).
//   3. Score tiles render their final value INSTANTLY. Sampled within the
//      same JS turn as the reveal-shell becoming visible, every non-Insider
//      tile already shows its final `+2` text — no count-up roll animation.
//
// Today (pre-5d) none of those animations exist, so all three assertions
// pass trivially. The value of the spec is that it locks the contract: when
// 5d adds the flip / confetti / score-roll, they MUST be gated behind the
// reduced-motion media query, or this spec turns red.
//
// Test flow mirrors `insider-caught.spec.ts` exactly (we reuse the same
// caught-variant scoring contract — Master + 2 Commons each vote the
// Insider, so the Insider lands in the top-voted set and the round is
// "caught" → Screen 8a renders).

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

test.describe.serial("insider reveal — reduced-motion (US-073)", () => {
  test("under prefers-reduced-motion: no flip transform, no confetti, scores instant", async ({
    browser,
  }) => {
    const session = await createMultiRoleSession(browser, 4, {
      reducedMotion: "reduce",
      colorScheme: "dark",
    })
    try {
      const [hostPage, p2, p3, p4] = session.pages

      // Sanity-check that prefers-reduced-motion is actually matching inside
      // Chromium for this context — guards against a Playwright/Chromium
      // version regression silently disabling the option.
      for (const page of session.pages) {
        await page.goto(`${INSIDER_URL}/`, { waitUntil: "domcontentloaded" })
        const matches = await page.evaluate(() =>
          window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        )
        expect(matches).toBe(true)
      }

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

      const masterRow = roles.find((r) => r.role === "master")!
      const insiderRow = roles.find((r) => r.role === "insider")!

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

      // ─── Voting — Master + 2 Commons → Insider; Insider → Master ───────
      // Insider gets 3 votes → top set → caught → Screen 8a.
      for (const { page, playerId } of pagePlayerIds) {
        const target =
          playerId === insiderRow.player_id
            ? masterRow.player_id
            : insiderRow.player_id
        await expect(page.getByTestId("voting-phase-shell")).toBeVisible({
          timeout: 15_000,
        })
        const card = page.getByTestId(`vote-target-card-${target}`)
        await expect(card).toBeVisible()
        await card.click()
        await expect(card).toHaveAttribute("aria-pressed", "true")
      }

      // ─── Wait for phase=reveal AND scoring (scored_at stamped) ─────────
      await expect
        .poll(
          async () => {
            const { data } = await supabase
              .from("game_insider_round")
              .select("phase, scored_at")
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

      // ─── A11y assertions on every page ──────────────────────────────────
      const nonInsiderRoles = roles.filter((r) => r.role !== "insider")

      for (const { page } of pagePlayerIds) {
        // Reveal shell is visible — caught variant (Screen 8a).
        const shell = page.getByTestId("reveal-caught-shell")
        await expect(shell).toBeVisible({ timeout: 15_000 })

        // (1) BIG NAME secret card has no transform animation.
        //     Computed `transform` is `none` — no scale/rotate/translate is
        //     mid-flight, so the card is at rest visually. A future flip
        //     animation that ignores prefers-reduced-motion would surface
        //     here as a non-`none` matrix(...) value.
        const secretCard = page.getByTestId("reveal-secret-name")
        await expect(secretCard).toContainText(secret.toUpperCase())
        const transformValue = await secretCard.evaluate(
          (el) => getComputedStyle(el).transform,
        )
        expect(transformValue).toBe("none")
        // Same for the secret card's parent wrapper — the transform might
        // live on the surrounding tile rather than the text node.
        const secretCardWrapper = await secretCard.evaluateHandle(
          (el) => el.parentElement,
        )
        const wrapperTransform = await secretCardWrapper.evaluate(
          (el: HTMLElement | null) =>
            el ? getComputedStyle(el).transform : "none",
        )
        expect(wrapperTransform).toBe("none")

        // (2) NO confetti DOM elements. The Phase 5d polish pass will likely
        //     add a confetti burst on the caught variant; under reduced-motion
        //     it MUST be skipped entirely. We assert by counting any element
        //     whose data-testid matches /^reveal-confetti/ (the agreed naming
        //     prefix for confetti particles in this contract).
        const confettiCount = await page
          .locator('[data-testid^="reveal-confetti"]')
          .count()
        expect(confettiCount).toBe(0)

        // (3) Score tiles render their final value INSTANTLY. We sample the
        //     textContent of every score tile in the same JS turn as the
        //     shell becoming visible — any count-up roll animation that
        //     ignores prefers-reduced-motion would show an intermediate
        //     "+0"/"+1" here for non-Insider tiles, failing the regex.
        const scoreTileTexts = await page
          .locator('[data-testid^="reveal-score-tile-"]')
          .evaluateAll((els) =>
            els.map((el) => ({
              id: el.getAttribute("data-testid") ?? "",
              text: (el.textContent ?? "").replace(/\s+/g, " ").trim(),
            })),
          )
        for (const r of nonInsiderRoles) {
          const tile = scoreTileTexts.find(
            (t) => t.id === `reveal-score-tile-${r.player_id}`,
          )
          expect(tile, `score tile for ${r.player_id} should be present`).toBeDefined()
          expect(tile!.text).toMatch(/\+2\s*pts/)
        }
        const insiderTile = scoreTileTexts.find(
          (t) => t.id === `reveal-score-tile-${insiderRow.player_id}`,
        )
        expect(insiderTile).toBeDefined()
        // Insider should show "0 pts" — also instant, no roll.
        expect(insiderTile!.text).toMatch(/0\s*pts/)
      }
    } finally {
      await session.dispose()
    }
  })
})
