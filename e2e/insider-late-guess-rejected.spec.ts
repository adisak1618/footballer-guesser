import { test, expect } from "@playwright/test"
import type { Page } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { createMultiRoleSession } from "./_helpers/multi-role"

// US-069 / Phase 5c.4 — Late master action rejected (mark_correct_guess after
// deadline) per A3 mandatory time guards.
//
// Contract under test:
//
//   1. mark_correct_guess (migration 0025) calls reconcile_round_phase as its
//      first step. If the asking deadline has passed, reconcile flips
//      'asking' → 'result_failed' inside the transaction. The RPC then sees
//      v_phase = 'result_failed' and raises PGAME02 / PG002 ("round expired").
//   2. Per pattern note 40 (PG transaction rollback wipes reconcile when RPC
//      raises), the entire transaction rolls back when the RPC raises — the
//      phase column stays at 'asking' on disk even though the error message
//      says the deadline passed. A subsequent successful RPC (here:
//      expire_round) commits the phase flip.
//   3. The Master's UI surfaces PG002 as "หมดเวลาแล้ว" via mapGuessError
//      (asking-master.tsx). After expire_round commits the flip, lobby.tsx
//      routes phase='result_failed' into the Reveal component (Screen 8c),
//      so the Master and other clients land on reveal-time-expired-shell.
//
// Disabled-button caveat: master-mark-correct-cta is NOT gated on
// remainingS <= 0 (only the response buttons are). That's deliberate so a
// Master who clicks at the moment the timer hits 0 still reaches the server
// guard rather than a silent UI no-op. This test exercises that path.
//
// Deadline simulation: rather than waiting the full time_limit_s window,
// service-role backdates started_at by 10 minutes after the asking phase has
// mounted. The Master's AskingMaster component cached startedAt as a prop on
// mount, so the Master's client-side button remains enabled — exactly
// modelling a click "just before" the server-side deadline.

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

test.describe.serial("insider — late master action rejected (US-069)", () => {
  test("master clicks ทายถูกแล้ว past deadline → PGAME02 + UI lands on result_failed", async ({
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

      // ─── Wait for roles + secret on round 1 ─────────────────────────────
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

      // ─── Insider readies → asking phase begins ──────────────────────────
      await expect(insiderPage.getByTestId("insider-ready-cta")).toBeEnabled({
        timeout: 15_000,
      })
      await insiderPage.getByTestId("insider-ready-cta").click()

      // ─── Wait for asking phase + master CTA visible ─────────────────────
      await expect(masterPage.getByTestId("asking-phase-shell")).toBeVisible({
        timeout: 15_000,
      })
      const guessCta = masterPage.getByTestId("master-mark-correct-cta")
      await expect(guessCta).toBeVisible()
      await expect(guessCta).toBeEnabled()

      const startedAt = await new Promise<string>((resolve, reject) => {
        const deadline = Date.now() + 15_000
        const tick = async () => {
          const { data } = await supabase
            .from("game_insider_round")
            .select("phase, started_at")
            .eq("room_id", roomId)
            .eq("round_number", 1)
            .maybeSingle()
          if (data?.phase === "asking" && data.started_at) {
            return resolve(data.started_at as string)
          }
          if (Date.now() > deadline) {
            return reject(new Error("Timed out waiting for asking phase"))
          }
          setTimeout(tick, 300)
        }
        tick()
      })
      expect(startedAt).toBeTruthy()

      // ─── Backdate started_at: server-side deadline now provably in past ─
      // The Master's AskingMaster cached startedAt on mount, so its CTA stays
      // enabled — modelling a real "click just before the deadline" race.
      const backdated = new Date(Date.now() - 10 * 60 * 1000).toISOString()
      const { error: backdateErr } = await supabase
        .from("game_insider_round")
        .update({ started_at: backdated })
        .eq("room_id", roomId)
        .eq("round_number", 1)
      expect(backdateErr).toBeNull()

      // ─── Master clicks ทายถูกแล้ว → server rejects with PGAME02 ─────────
      // The CTA is NOT disabled on remainingS<=0 (only response buttons are),
      // so this click reaches the RPC. The server's reconcile_round_phase
      // flips asking→result_failed inside the TX, then the function raises
      // PG002 ("round expired") which rolls the entire TX back — phase stays
      // 'asking' on disk until a subsequent RPC commits the reconcile.
      await guessCta.click()

      // UI surfaces PG002 via mapGuessError → "หมดเวลาแล้ว".
      const guessErrorAlert = masterPage.locator(
        '[role="alert"]:has-text("หมดเวลา")',
      )
      await expect(guessErrorAlert).toBeVisible({ timeout: 10_000 })

      // Phase is still 'asking' on disk (transaction rolled back per
      // pattern note 40) — confirms the rollback contract end-to-end.
      const { data: postClickRound } = await supabase
        .from("game_insider_round")
        .select("phase, scored_at")
        .eq("room_id", roomId)
        .eq("round_number", 1)
        .maybeSingle()
      expect(postClickRound?.phase).toBe("asking")
      expect(postClickRound?.scored_at).toBeNull()

      // ─── Commit the reconcile via expire_round (next RPC fires it) ──────
      // In production any subsequent successful RPC (or any client whose
      // timer expires) drives this. Here we make it explicit so the test
      // can deterministically assert the UI lands on result_failed.
      const { data: expired, error: expireErr } = await supabase.rpc(
        "expire_round",
        { p_room_id: roomId, p_round: 1 },
      )
      expect(expireErr).toBeNull()
      expect(expired).toBe(1)

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
        .toBe("result_failed")

      // ─── Master's UI routes from asking → reveal (Screen 8c) ────────────
      // lobby.tsx renders <Reveal/> for phase ∈ {'reveal','result_failed'};
      // the Reveal component fires advance_to_reveal on mount which stamps
      // scored_at without applying scores (failure branch).
      await expect(
        masterPage.getByTestId("reveal-time-expired-shell"),
      ).toBeVisible({ timeout: 15_000 })
      await expect(
        masterPage.getByTestId("reveal-time-expired-header"),
      ).toContainText(/TIME UP/i)
      await expect(masterPage.getByTestId("reveal-secret-name")).toContainText(
        secret.toUpperCase(),
      )
      // Variant invariants: no caught/escaped badge, no scoreboard tiles.
      await expect(
        masterPage.getByTestId("reveal-insider-badge"),
      ).toHaveCount(0)
      await expect(
        masterPage.getByTestId(/^reveal-score-tile-/),
      ).toHaveCount(0)

      // Other clients also land on the same time-expired shell.
      for (const { page } of pagePlayerIds) {
        await expect(
          page.getByTestId("reveal-time-expired-shell"),
        ).toBeVisible({ timeout: 15_000 })
      }
    } finally {
      await session.dispose()
    }
  })
})
