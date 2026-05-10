import { test, expect } from "@playwright/test"
import type { Page } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { createMultiRoleSession } from "./_helpers/multi-role"

// US-068 / Phase 5c.3 — Mid-round reconnect during asking phase.
//
// The reconnect contract (per design doc, lobby.tsx phase router, and the
// AskingOther / AskingMaster components):
//
//   * Player identity is anchored in localStorage `insider_player_id`. As
//     long as a returning browser writes the same id, the lobby's `me`
//     resolution finds the same `players` row and the AskingPhase shell
//     re-loads the same role row from `game_insider_roles`.
//   * The asking-phase timer is computed client-side from `started_at +
//     time_limit_s` (server timestamps), NOT from a per-client countdown.
//     A reconnecting client therefore sees the correct remaining time
//     without any handshake — purely from the round row.
//   * `game_insider_responses` is the source of truth for the response
//     feed. Both AskingOther and AskingMaster fetch the full per-round
//     row set on mount BEFORE subscribing to inserts, so the reconnecting
//     client sees historical responses immediately rather than only
//     future ones.
//
// This spec drives a 4-player room to the 'asking' phase, has the Master
// record 5 responses (the "last 5 responses" the PRD calls out), then
// drops a non-master player by closing their browser context. After a
// real-time gap, a fresh context is created with the same player_id
// pre-seeded into localStorage and navigated to the same room URL. The
// reconnecting client must:
//
//   1. Land on the asking-phase shell (NOT the join view, NOT lobby —
//      `me` resolved correctly from the persisted player_id).
//   2. Render the role-correct view (AskingOther for the dropped Common,
//      asserted by absence of the Insider-only D2 hint AND presence of
//      the AskingOther feed).
//   3. Show a timer that reflects elapsed wall-clock time since
//      started_at — i.e. STRICTLY LESS than the original time_limit_s.
//      This proves the timer is anchored to server time, not reset on
//      reconnect.
//   4. Show all 5 responses in the feed — proves the initial fetch in
//      AskingOther runs and surfaces history that landed during the drop.
//
// We drop a Common player (role='player') rather than the Master because
// the Common DOM is the same as Insider (AskingOther) and avoids the
// Master-only secret-fetch path in AskingPhase, keeping the reconnect
// surface tight and uncoupled from getMyInsiderSecret.

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

// 30s mirrors the "after 30s" wording in the US-068 acceptance criterion.
// The insider asking timer defaults to 300s, so a 30s drop leaves plenty
// of headroom (~270s) for the reconnect+verify flow under the 120s test
// timeout.
const RECONNECT_DELAY_MS = 30_000

async function readInsiderPlayerId(page: Page): Promise<string | null> {
  return page.evaluate(() => window.localStorage.getItem("insider_player_id"))
}

function parseTimerToSeconds(text: string): number {
  // asking-timer renders as "MM:SS" (zero-padded, tabular-nums).
  const match = text.trim().match(/^(\d{2}):(\d{2})$/)
  if (!match) {
    throw new Error(`asking-timer text did not match MM:SS — got "${text}"`)
  }
  const mm = Number.parseInt(match[1], 10)
  const ss = Number.parseInt(match[2], 10)
  return mm * 60 + ss
}

// TODO(#16 follow-up): asserts master_respond-driven feed restoration on
// reconnect, all removed in #16. The reconnect contract (timer + role
// identity) is still valid; rewrite around the new compact header in a
// follow-up.
test.describe.skip("insider asking — mid-round reconnect (US-068) [DEPRECATED #16]", () => {
  test("dropped Common reconnects after 30s → role + timer + last 5 responses restored", async ({
    browser,
  }) => {
    const session = await createMultiRoleSession(browser, 4)
    let droppedReconnectContext: Awaited<
      ReturnType<typeof browser.newContext>
    > | null = null
    try {
      const [hostPage, p2, p3, p4] = session.pages

      // ─── Host creates room ──────────────────────────────────────────────
      await hostPage.goto(`${INSIDER_URL}/new`, {
        waitUntil: "domcontentloaded",
      })
      await hostPage.locator('input[type="text"]').first().fill("Host")
      await hostPage.getByTestId("pack-chip-football-premier-league").click()
      await hostPage.getByTestId("create-insider-room-cta").click()
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

      // ─── Wait for roles to be assigned ──────────────────────────────────
      type RoleRow = { player_id: string; role: string }
      const { roles } = await new Promise<{ roles: RoleRow[] }>(
        (resolve, reject) => {
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
                return resolve({ roles: rs as RoleRow[] })
              }
            }
            if (Date.now() > deadline) {
              return reject(new Error("Timed out waiting for roles"))
            }
            setTimeout(tick, 300)
          }
          tick()
        },
      )

      const masterRow = roles.find((r) => r.role === "master")!
      const insiderRow = roles.find((r) => r.role === "insider")!
      const commonRows = roles.filter((r) => r.role === "player")
      expect(commonRows).toHaveLength(2)
      // Drop the FIRST Common — both are equivalent (AskingOther DOM is
      // identical). The other Common stays online so we have a live
      // reference page to compare timer/feed parity against.
      const [dropCommon, liveCommon] = commonRows

      const dropPage = pagePlayerIds.find(
        (e) => e.playerId === dropCommon.player_id,
      )!.page
      const liveCommonPage = pagePlayerIds.find(
        (e) => e.playerId === liveCommon.player_id,
      )!.page
      const insiderPage = pagePlayerIds.find(
        (e) => e.playerId === insiderRow.player_id,
      )!.page

      // ─── Insider readies → asking phase ─────────────────────────────────
      await expect(insiderPage.getByTestId("insider-ready-cta")).toBeEnabled({
        timeout: 15_000,
      })
      await insiderPage.getByTestId("insider-ready-cta").click()

      await expect(dropPage.getByTestId("asking-phase-shell")).toBeVisible({
        timeout: 15_000,
      })

      // ─── Capture round timing ───────────────────────────────────────────
      const { data: roundRowBefore } = await supabase
        .from("game_insider_round")
        .select("started_at, time_limit_s, phase")
        .eq("room_id", roomId)
        .eq("round_number", 1)
        .maybeSingle()
      expect(roundRowBefore?.phase).toBe("asking")
      const startedAtMs = new Date(
        roundRowBefore!.started_at as string,
      ).getTime()
      const timeLimitS = roundRowBefore!.time_limit_s as number
      expect(timeLimitS).toBeGreaterThan(60) // sanity: default is 300

      // ─── Master records 5 responses (the "last 5 responses" of the PRD) ─
      // We drive the RPC directly rather than clicking through the UI —
      // 5 sequential clicks would add ~5s of UI churn for no extra coverage
      // (master_respond is already exercised by the asking-master spec).
      const responseSequence: Array<"yes" | "no" | "unsure"> = [
        "yes",
        "no",
        "unsure",
        "yes",
        "no",
      ]
      for (const r of responseSequence) {
        const { error } = await supabase.rpc("master_respond", {
          p_room_id: roomId,
          p_round: 1,
          p_player_id: masterRow.player_id,
          p_response: r,
        })
        expect(error).toBeNull()
      }

      // Wait for the live Common's feed to render all 5 — confirms the
      // INSERTs landed and the realtime channel works as a control before
      // we drop our subject.
      await expect(
        liveCommonPage.getByTestId("asking-other-feed-row"),
      ).toHaveCount(5, { timeout: 15_000 })

      // ─── DROP: capture identity + close context ─────────────────────────
      const dropPlayerId = pagePlayerIds.find((e) => e.page === dropPage)!
        .playerId
      const dropContext = dropPage.context()
      await dropContext.close()

      // ─── Wait the full 30s before reconnect ─────────────────────────────
      // This is the critical interval — "reconnects after 30s". The timer
      // assertion below depends on a meaningful elapsed gap to prove the
      // UI computes from started_at rather than restarting at time_limit_s.
      await new Promise((r) => setTimeout(r, RECONNECT_DELAY_MS))

      // Sanity: phase must still be 'asking' when we reconnect (otherwise
      // we'd be testing the wrong screen). Expire guard at default 300s
      // means asking is still alive at ~30-40s in.
      const { data: roundRowMid } = await supabase
        .from("game_insider_round")
        .select("phase")
        .eq("room_id", roomId)
        .eq("round_number", 1)
        .maybeSingle()
      expect(roundRowMid?.phase).toBe("asking")

      // ─── RECONNECT: fresh context with player_id pre-seeded ─────────────
      // addInitScript runs BEFORE any page script on every navigation, so
      // the lobby's first useEffect sees the persisted player_id and
      // resolves `me` immediately — bypassing the JoinView path.
      droppedReconnectContext = await browser.newContext({
        viewport: { width: 414, height: 896 },
      })
      await droppedReconnectContext.addInitScript((pid) => {
        window.localStorage.setItem("insider_player_id", pid)
      }, dropPlayerId)
      const reconnectedPage = await droppedReconnectContext.newPage()
      await reconnectedPage.goto(`${INSIDER_URL}/room/${code}`, {
        waitUntil: "domcontentloaded",
      })

      // ─── Assert 1: lands on asking-phase shell (role identity preserved)
      await expect(
        reconnectedPage.getByTestId("asking-phase-shell"),
      ).toBeVisible({ timeout: 15_000 })

      // Negative checks — proves we didn't fall back to JoinView or any
      // wrong-role view:
      //   - JoinView would render the name input
      //   - Master view would render the response buttons
      //   - Insider view would render the D2 hint testid
      await expect(
        reconnectedPage.getByTestId("insider-join-name-input"),
      ).toHaveCount(0)
      await expect(
        reconnectedPage.getByTestId("master-response-buttons"),
      ).toHaveCount(0)
      await expect(
        reconnectedPage.getByTestId("asking-other-insider-hint"),
      ).toHaveCount(0)

      // The AskingOther feed container is rendered for non-master roles —
      // its presence is the positive role-correct check.
      await expect(
        reconnectedPage.getByTestId("asking-other-feed"),
      ).toBeVisible()

      // ─── Assert 2: timer reflects elapsed wall-clock from started_at ────
      // The timer ticks on a 1s interval (setInterval in AskingOther).
      // We poll for two consecutive readings to (a) wait past the first
      // tick and (b) confirm the timer is decreasing rather than frozen
      // at timeLimitS (which would happen if it were locally seeded).
      const readTimerSeconds = async () => {
        const text = await reconnectedPage
          .getByTestId("asking-timer")
          .innerText()
        return parseTimerToSeconds(text)
      }

      // Wait for the timer to render its first computed value.
      await expect(reconnectedPage.getByTestId("asking-timer")).toBeVisible()
      const firstReading = await readTimerSeconds()

      const elapsedAtFirstReadMs = Date.now() - startedAtMs
      const expectedRemainingS = Math.max(
        0,
        Math.floor(timeLimitS - elapsedAtFirstReadMs / 1000),
      )

      // The timer is computed from server-anchored started_at; allow ±3s
      // slack for tick alignment + clock skew on the local Supabase docker
      // container.
      expect(firstReading).toBeGreaterThan(0)
      expect(firstReading).toBeLessThan(timeLimitS) // hard proof: NOT reset
      expect(Math.abs(firstReading - expectedRemainingS)).toBeLessThanOrEqual(3)

      // Wait one tick and re-read — the timer must be counting down.
      await new Promise((r) => setTimeout(r, 1500))
      const secondReading = await readTimerSeconds()
      expect(secondReading).toBeLessThan(firstReading)

      // ─── Assert 3: feed restored — all 5 historical responses present ───
      // AskingOther's mount-time fetch must paint the responses created
      // during the drop window before the realtime subscription is even
      // useful. This is the "last 5 responses" criterion.
      await expect(
        reconnectedPage.getByTestId("asking-other-feed-row"),
      ).toHaveCount(5, { timeout: 15_000 })
    } finally {
      if (droppedReconnectContext) {
        await droppedReconnectContext.close()
      }
      await session.dispose()
    }
  })
})
