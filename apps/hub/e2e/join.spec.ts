import { test, expect } from "@playwright/test"
import { deleteRoomByCode, insertRoom } from "./_helpers/admin"

// US-034 introduced /join with a hardcoded Headball redirect.
// US-035 wires the lookup-room server action: the redirect target now comes
// from `rooms.game_type` in Supabase, so the e2e seeds a row first.
const TEST_CODE = "ABCDEF"

test.describe("/join — lookup-room dispatcher (US-035)", () => {
  test.beforeAll(async () => {
    await deleteRoomByCode(TEST_CODE)
    await insertRoom({ code: TEST_CODE, gameType: "headball" })
  })

  test.afterAll(async () => {
    await deleteRoomByCode(TEST_CODE)
  })

  test("typing a 6-char Headball code and clicking JOIN GAME redirects to headball /room/<code>", async ({
    page,
    context,
  }) => {
    // The redirect target is on a different origin than the hub dev server.
    // Stub it so Playwright captures the URL after navigation completes.
    await context.route(/headball\..*\/room\/[A-Z0-9]{6}$/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<html><head><title>Headball Room</title></head><body>headball room stub</body></html>",
      }),
    )

    await page.goto("/join")

    await expect(page.getByRole("heading", { name: /JOIN ROOM/i })).toBeVisible()

    const cta = page.getByRole("button", { name: /JOIN GAME/i })
    await expect(cta).toBeVisible()
    await expect(cta).toBeDisabled()

    await page.locator('[data-slot="slot-input-cell"]').first().focus()
    await page.keyboard.type(TEST_CODE)

    await expect(cta).toBeEnabled()

    await cta.click()

    await page.waitForURL(/headball\..*\/room\/ABCDEF/, { timeout: 10_000 })
    expect(page.url()).toContain("headball.")
    expect(page.url()).toContain(`/room/${TEST_CODE}`)
  })

  test("typing an unseeded code surfaces banner-error 'Room not found'", async ({
    page,
  }) => {
    await page.goto("/join")

    const cta = page.getByRole("button", { name: /JOIN GAME/i })
    // Use a code that exists in the alphabet but is not seeded.
    await page.locator('[data-slot="slot-input-cell"]').first().focus()
    await page.keyboard.type("ZZZZZZ")
    await expect(cta).toBeEnabled()
    await cta.click()

    const errorRegion = page.locator('[data-slot="join-error"]')
    await expect(errorRegion).toContainText(/Room not found/i)
  })

  test("typing a code for an ENDED room surfaces banner-error 'This room ended' (US-036)", async ({
    page,
  }) => {
    const ENDED_CODE = "ENDXYZ"
    await deleteRoomByCode(ENDED_CODE)
    await insertRoom({ code: ENDED_CODE, gameType: "headball", status: "ENDED" })

    try {
      await page.goto("/join")
      const cta = page.getByRole("button", { name: /JOIN GAME/i })
      await page.locator('[data-slot="slot-input-cell"]').first().focus()
      await page.keyboard.type(ENDED_CODE)
      await expect(cta).toBeEnabled()
      await cta.click()

      const errorRegion = page.locator('[data-slot="join-error"]')
      await expect(errorRegion).toContainText(/This room ended/i)
    } finally {
      await deleteRoomByCode(ENDED_CODE)
    }
  })

  test("error banner space (24px) is reserved above the CTA", async ({
    page,
  }) => {
    await page.goto("/join")

    const errorRegion = page.locator('[data-slot="join-error"]')
    await expect(errorRegion).toBeAttached()
    const box = await errorRegion.boundingBox()
    expect(box?.height).toBe(24)
  })
})
