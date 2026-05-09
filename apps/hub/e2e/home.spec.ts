import { test, expect } from "@playwright/test"

test("hub home renders stadium-gate metaphor with two game gates and ENTER CODE CTA", async ({
  page,
}) => {
  await page.goto("/")

  // Brand mark visible
  await expect(page.getByText(/HEADBALL SOCIAL GAMES/i)).toBeVisible()

  // Section header — "PICK YOUR GAME"
  await expect(page.getByRole("heading", { name: /PICK YOUR GAME/i })).toBeVisible()

  // GATE A — Headball
  const gateA = page.getByRole("link", { name: /GATE A/i })
  await expect(gateA).toBeVisible()
  await expect(gateA).toContainText(/HEADBALL/i)

  // GATE B — Insider
  const gateB = page.getByRole("link", { name: /GATE B/i })
  await expect(gateB).toBeVisible()
  await expect(gateB).toContainText(/INSIDER/i)

  // Bilingual copy — Thai present somewhere on the page
  await expect(page.getByText(/เลือกเกม/)).toBeVisible()

  // ENTER CODE CTA → /join
  const enterCode = page.getByRole("link", { name: /ENTER CODE/i })
  await expect(enterCode).toBeVisible()
  await expect(enterCode).toHaveAttribute("href", "/join")
})

test("each gate links to the correct subdomain via env var", async ({ page }) => {
  await page.goto("/")

  const gateA = page.getByRole("link", { name: /GATE A/i })
  const gateAHref = await gateA.getAttribute("href")
  expect(gateAHref).toBeTruthy()
  // Defaults to http://localhost:3000 when NEXT_PUBLIC_HEADBALL_URL is unset
  expect(gateAHref).toMatch(/^https?:\/\//)

  const gateB = page.getByRole("link", { name: /GATE B/i })
  const gateBHref = await gateB.getAttribute("href")
  expect(gateBHref).toBeTruthy()
  expect(gateBHref).toMatch(/^https?:\/\//)
})
