import { defineConfig, devices } from "@playwright/test"

// Port override lets parallel pm-dev worktrees run their own dev server.
const PORT = process.env.PORT ?? "3000"
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    headless: true,
    viewport: { width: 414, height: 896 },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 414, height: 896 } },
    },
  ],
  webServer: {
    command: `PORT=${PORT} bun run dev`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
})
