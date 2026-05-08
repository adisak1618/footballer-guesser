import { test, expect } from "@playwright/test"

// US-034 (Phase 4.3): /join page with slot-input + JOIN GAME CTA
//
// US-034 hardcodes the Headball redirect target — the actual lookup-room
// server action lands in US-035. This spec asserts the full end-to-end
// behavior: type a 6-char valid Headball code, click JOIN GAME, and the
// browser navigates to a URL on the headball subdomain at /room/<code>.
test("/join: typing 6-char code and clicking JOIN GAME redirects to headball /room/<code>", async ({
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

  // Header is the Anton 56px "JOIN ROOM" title (bilingual subhead allowed)
  await expect(page.getByRole("heading", { name: /JOIN ROOM/i })).toBeVisible()

  // CTA exists and is disabled before any code entered
  const cta = page.getByRole("button", { name: /JOIN GAME/i })
  await expect(cta).toBeVisible()
  await expect(cta).toBeDisabled()

  // Type a 6-char valid Headball room code (alphabet excludes I, O, 0, 1).
  const code = "ABCDEF"
  await page.locator('[data-slot="slot-input-cell"]').first().focus()
  await page.keyboard.type(code)

  // After 6 chars the CTA is enabled
  await expect(cta).toBeEnabled()

  await cta.click()

  // Redirect URL contains "headball." (subdomain) and "/room/<code>"
  await page.waitForURL(/headball\..*\/room\/ABCDEF/, { timeout: 10_000 })
  expect(page.url()).toContain("headball.")
  expect(page.url()).toContain(`/room/${code}`)
})

test("/join: error banner space (24px) is reserved above the CTA", async ({
  page,
}) => {
  await page.goto("/join")

  // The reserved error region is rendered (live region) so layout doesn't
  // shift when an error message appears (room not found / room full).
  const errorRegion = page.locator('[data-slot="join-error"]')
  await expect(errorRegion).toBeAttached()
  // Height is 24px (1.5rem / h-6 in tailwind).
  const box = await errorRegion.boundingBox()
  expect(box?.height).toBe(24)
})
