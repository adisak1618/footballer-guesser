import { test, expect } from "@playwright/test"
import { createMultiRoleSession } from "./_helpers/multi-role"

test.describe.serial("multi-role smoke", () => {
  test("4 isolated contexts each open insider home with independent localStorage", async ({
    browser,
  }) => {
    const session = await createMultiRoleSession(browser, 4)

    try {
      expect(session.contexts).toHaveLength(4)
      expect(session.pages).toHaveLength(4)

      await Promise.all(
        session.pages.map(page =>
          page.goto("http://localhost:3002/", { waitUntil: "domcontentloaded" }),
        ),
      )

      // Confirm each context loaded the insider app body.
      for (const page of session.pages) {
        await expect(page.locator("body")).toContainText(/insider/i)
      }

      // Write a unique value into localStorage per context.
      await Promise.all(
        session.pages.map((page, idx) =>
          page.evaluate(value => {
            window.localStorage.setItem("multi-role-smoke", value)
          }, `player-${idx}`),
        ),
      )

      // Read back — each context must see only its own value.
      const values = await Promise.all(
        session.pages.map(page =>
          page.evaluate(() => window.localStorage.getItem("multi-role-smoke")),
        ),
      )

      expect(values).toEqual(["player-0", "player-1", "player-2", "player-3"])
      expect(new Set(values).size).toBe(4)
    } finally {
      await session.dispose()
    }
  })
})
