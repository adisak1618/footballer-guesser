import { test, expect } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"

// US-053 / Phase 5b.2 — Insider host setup screen.
//
// Verifies the full /new flow: visit, pick a pack, pick a time chip, adjust
// the round stepper, click CREATE ROOM, land on /room/<code>, and confirm
// the room exists in Postgres with game_type='insider' + the chosen config.

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321"
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"

const INSIDER_PORT = process.env.INSIDER_PORT ?? "3002"
const INSIDER_URL = `http://localhost:${INSIDER_PORT}`

test.describe.serial("insider host setup (/new)", () => {
  test("host picks pack/time/rounds → CREATE ROOM → redirects to /room/<code> with row in DB", async ({
    page,
  }) => {
    await page.goto(`${INSIDER_URL}/new`, { waitUntil: "domcontentloaded" })

    // Page heading present.
    await expect(
      page.getByRole("heading", { name: /new insider room/i }),
    ).toBeVisible()

    // Fill host name.
    const nameInput = page.locator('input[type="text"]').first()
    await nameInput.fill("Pong")

    // Pick the Premier League pack chip (seeded by migration 0013).
    const packChip = page.getByTestId("pack-chip-football-premier-league")
    await expect(packChip).toBeVisible()
    await packChip.click()
    await expect(packChip).toHaveAttribute("aria-checked", "true")

    // Pick the 5-minute time chip (selected by default — click 3min then 5min
    // to exercise the toggle behaviour).
    const time3 = page.getByTestId("time-chip-180")
    await time3.click()
    await expect(time3).toHaveAttribute("aria-checked", "true")
    const time5 = page.getByTestId("time-chip-300")
    await time5.click()
    await expect(time5).toHaveAttribute("aria-checked", "true")

    // Stepper: default is 5; bump to 7 and back down to 6.
    const incBtn = page.getByTestId("round-stepper-inc")
    const decBtn = page.getByTestId("round-stepper-dec")
    const value = page.getByTestId("round-count-value")
    await expect(value).toHaveText("5")
    await incBtn.click()
    await incBtn.click()
    await expect(value).toHaveText("7")
    await decBtn.click()
    await expect(value).toHaveText("6")

    // CREATE ROOM.
    const cta = page.getByTestId("create-insider-room-cta")
    await expect(cta).toBeEnabled()
    await cta.click()

    // Should land on /room/<6 alphanumeric>.
    await page.waitForURL(/\/room\/[A-Z0-9]{6}$/, { timeout: 15_000 })
    const url = new URL(page.url())
    const code = url.pathname.split("/").pop() ?? ""
    expect(code).toMatch(/^[A-Z0-9]{6}$/)

    // Placeholder lobby renders the code.
    await expect(page.getByTestId("insider-room-code")).toHaveText(code)

    // Verify the row exists in Postgres with the chosen config.
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, code, game_type, status, max_rounds")
      .eq("code", code)
      .single()
    expect(roomError).toBeNull()
    expect(room).toMatchObject({
      code,
      game_type: "insider",
      status: "LOBBY",
      max_rounds: 6,
    })

    const { data: config, error: configError } = await supabase
      .from("game_insider_room_config")
      .select("pack_slug, time_limit_s, round_count")
      .eq("room_id", room!.id)
      .single()
    expect(configError).toBeNull()
    expect(config).toEqual({
      pack_slug: "football-premier-league",
      time_limit_s: 300,
      round_count: 6,
    })
  })
})
