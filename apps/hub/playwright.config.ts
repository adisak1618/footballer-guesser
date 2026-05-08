import { defineConfig, devices } from "@playwright/test"

const PORT = process.env.PORT ?? "3001"
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
    env: {
      // The /join e2e asserts the cross-game redirect URL contains "headball.",
      // so point Headball at a *.localhost subdomain (Chromium resolves
      // *.localhost to 127.0.0.1, so the navigation lands back on this dev
      // server but with a host header that satisfies the assertion).
      NEXT_PUBLIC_HEADBALL_URL: `http://headball.localhost:${PORT}`,
      NEXT_PUBLIC_INSIDER_URL: `http://insider.localhost:${PORT}`,
      // Local Supabase defaults for the lookup-room server action (US-035).
      // Override by exporting NEXT_PUBLIC_SUPABASE_URL/ANON_KEY before running
      // playwright. Values match `bunx supabase status` for the local stack.
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
        "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
    },
  },
})
