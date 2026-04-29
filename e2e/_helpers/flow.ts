import { expect, type Page } from "@playwright/test"

export async function createRoom(page: Page, displayName: string): Promise<string> {
  await page.goto("/")
  await page.getByRole("button", { name: /สร้างห้อง/ }).first().click()

  const dialog = page.getByRole("dialog", { name: "ใส่ชื่อของคุณ" })
  await expect(dialog).toBeVisible()
  await dialog.getByPlaceholder("ชื่อเล่น").fill(displayName)
  await dialog.getByRole("button", { name: /^สร้างห้อง$/ }).click()

  await page.waitForURL(/\/room\/[A-Z0-9]{6}$/, { timeout: 30_000 })
  const url = page.url()
  const match = url.match(/\/room\/([A-Z0-9]{6})/)
  if (!match) throw new Error(`expected /room/<code> URL, got ${url}`)
  return match[1]
}

export async function joinRoom(
  page: Page,
  code: string,
  displayName: string,
): Promise<void> {
  await page.goto("/join")
  await page.locator("#join-code").fill(code)
  await page.locator("#join-name").fill(displayName)
  await page.getByRole("button", { name: /^เข้าห้อง$/ }).click()
  await page.waitForURL(`/room/${code}`, { timeout: 30_000 })
}

export async function startGameAsHost(page: Page): Promise<void> {
  const startButton = page.getByRole("button", { name: /Start Game/i })
  await expect(startButton).toBeEnabled({ timeout: 15_000 })
  await startButton.click()
}

export async function submitGuessFromCard(
  page: Page,
  guess: string,
): Promise<void> {
  const tapTarget = page.getByRole("button", { name: "แตะเพื่อเปิดตัวเลือก" })
  await expect(tapTarget).toBeVisible({ timeout: 15_000 })
  await tapTarget.click()

  const overlay = page.getByRole("dialog", { name: "ตัวเลือกของผู้เล่น" })
  await expect(overlay).toBeVisible()
  await overlay.getByRole("button", { name: /ทายชื่อ/ }).click()

  const modal = page.getByRole("dialog", { name: "ทายชื่อนักเตะของคุณ" })
  await expect(modal).toBeVisible()
  await modal.locator("#guess-input").fill(guess)
  await modal.getByRole("button", { name: /ส่งคำตอบ/ }).click()
  await expect(modal).toBeHidden({ timeout: 15_000 })
}
