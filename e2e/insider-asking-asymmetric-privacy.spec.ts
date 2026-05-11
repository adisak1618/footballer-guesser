import { test, expect } from "@playwright/test"
import type { Page } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { createMultiRoleSession } from "./_helpers/multi-role"

// US-058 / Phase 5b.5a — Asymmetric privacy during asking phase (D3, D4).
//
// After the round transitions from 'preparing' → 'asking' (via advance_to_asking,
// T-3.B), the role-reveal UI must collapse into an asking-phase shell that:
//   - Hides the Insider's role badge AND secret card (anti-cheat: a phone glanced
//     at during asking must not betray who the Insider is — D4).
//   - Hides the Common's role badge + ??? mystery placeholder (irrelevant once
//     the question phase begins; visual parity with the Insider so no observer
//     can distinguish role by what's on screen).
//   - Keeps a small Bebas 32px on-dark-soft "Secret: [WORD]" reminder for the
//     Master only (Master needs the secret to answer Yes/No/Unsure — D3).
//
// Multi-context flow (4 phones at the table) — same scaffold as the role-reveal
// specs (US-055/056/057). After the round is in 'preparing', the Insider clicks
// ฉันพร้อมแล้ว to fire advance_to_asking. We then assert the asymmetric privacy
// invariants on the Insider, Master, and Common pages.

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

// TODO(#16 follow-up): the D4 anti-cheat parity (Insider≡Common shell DOM)
// is intentionally relaxed in #16 — Insider now sees the secret word inline
// in the compact header, parity with Master's master-asking-secret-reminder.
// The asymmetric-privacy story changes shape; revisit this spec once the
// product decision settles. The new compact-header E2E lives in
// insider-asking-simplified.spec.ts.
test.describe.skip("insider asking phase — asymmetric privacy (US-058) [DEPRECATED #16]", () => {
  test("Insider role badge + secret hidden during asking; Master keeps small reminder", async ({
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

      // ─── Wait for round + roles to land in 'preparing' ────────────────────
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

      const insiderRow = roles.find((r) => r.role === "insider")!
      const masterRow = roles.find((r) => r.role === "master")!
      const commonRow = roles.find((r) => r.role === "player")!
      expect(insiderRow).toBeTruthy()
      expect(masterRow).toBeTruthy()
      expect(commonRow).toBeTruthy()

      const insiderPage =
        pagePlayerIds.find((e) => e.playerId === insiderRow.player_id)?.page ??
        null
      const masterPage =
        pagePlayerIds.find((e) => e.playerId === masterRow.player_id)?.page ??
        null
      const commonPage =
        pagePlayerIds.find((e) => e.playerId === commonRow.player_id)?.page ??
        null
      expect(insiderPage).not.toBeNull()
      expect(masterPage).not.toBeNull()
      expect(commonPage).not.toBeNull()

      // Fetch the secret via service role for Master assertion later.
      const { data: roundRow } = await supabase
        .from("game_insider_round")
        .select("secret_value")
        .eq("room_id", roomId)
        .eq("round_number", 1)
        .single()
      const secret = (roundRow!.secret_value as string).toUpperCase()

      // ─── Sanity: Insider sees role badge + secret card BEFORE asking ──────
      await expect(
        insiderPage!.getByTestId("insider-role-badge"),
      ).toBeVisible({ timeout: 15_000 })
      await expect(
        insiderPage!.getByTestId("insider-secret-card"),
      ).toBeVisible()

      // ─── Insider clicks ฉันพร้อมแล้ว → advance_to_asking ──────────────────
      const ready = insiderPage!.getByTestId("insider-ready-cta")
      await expect(ready).toBeEnabled()
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

      // ─── Asymmetric privacy: Insider page strips role + secret ────────────
      // The asking-phase shell mounts; the role-reveal-only testids are gone.
      await expect(
        insiderPage!.getByTestId("asking-phase-shell"),
      ).toBeVisible({ timeout: 15_000 })
      await expect(insiderPage!.getByTestId("insider-role-badge")).toHaveCount(
        0,
      )
      await expect(insiderPage!.getByTestId("insider-secret-card")).toHaveCount(
        0,
      )
      await expect(
        insiderPage!.getByTestId("insider-warning-scanline"),
      ).toHaveCount(0)
      // The Master-only secret reminder must NOT render on the Insider page.
      await expect(
        insiderPage!.getByTestId("master-asking-secret-reminder"),
      ).toHaveCount(0)

      // ─── Common page: identical asking shell, no role/secret ──────────────
      await expect(
        commonPage!.getByTestId("asking-phase-shell"),
      ).toBeVisible({ timeout: 15_000 })
      await expect(commonPage!.getByTestId("common-role-badge")).toHaveCount(0)
      await expect(commonPage!.getByTestId("common-mystery-card")).toHaveCount(
        0,
      )
      await expect(
        commonPage!.getByTestId("master-asking-secret-reminder"),
      ).toHaveCount(0)

      // The visible textContent of the asking-phase-shell on Insider and Common
      // pages must be identical (D4 — anti-cheat parity), EXCEPT for the
      // Insider-only D2 hint introduced in US-060: it is the lone legitimate
      // asymmetric DOM node (warning-yellow caption) and is initially
      // opacity-0; we strip it from both sides before comparing the rest.
      const evalShellTextWithoutHint = (page: Page) =>
        page.evaluate((sel: string) => {
          const root = document.querySelector(sel) as HTMLElement | null
          if (!root) return ""
          const clone = root.cloneNode(true) as HTMLElement
          clone
            .querySelectorAll('[data-testid="asking-other-insider-hint"]')
            .forEach((el) => el.remove())
          return clone.textContent?.replace(/\s+/g, " ").trim() ?? ""
        }, '[data-testid="asking-phase-shell"]')
      const insiderShellText = await evalShellTextWithoutHint(insiderPage!)
      const commonShellText = await evalShellTextWithoutHint(commonPage!)
      expect(insiderShellText).toBe(commonShellText)

      // ─── Master page: small Bebas 32px on-dark-soft secret reminder ───────
      await expect(
        masterPage!.getByTestId("asking-phase-shell"),
      ).toBeVisible({ timeout: 15_000 })
      await expect(masterPage!.getByTestId("master-role-badge")).toHaveCount(0)
      await expect(masterPage!.getByTestId("master-secret-card")).toHaveCount(0)

      const reminder = masterPage!.getByTestId("master-asking-secret-reminder")
      await expect(reminder).toBeVisible()
      await expect(reminder).toContainText(secret)

      // Bebas 32px on-dark-soft.
      // Insider's `--color-on-dark-soft` = #9ca3af = rgb(156, 163, 175).
      // Insider's `--font-hero` resolves to Bebas Neue (layout.tsx).
      const reminderStyle = await reminder.evaluate((el) => {
        const cs = getComputedStyle(el)
        return {
          fontSize: cs.fontSize,
          color: cs.color,
          fontFamily: cs.fontFamily,
        }
      })
      expect(reminderStyle.fontSize).toBe("32px")
      expect(reminderStyle.color).toBe("rgb(156, 163, 175)")
      expect(reminderStyle.fontFamily.toLowerCase()).toContain("bebas")
    } finally {
      await session.dispose()
    }
  })
})
