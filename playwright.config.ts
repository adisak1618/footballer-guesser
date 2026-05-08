import { defineConfig, devices } from "@playwright/test"

// Workspace-root multi-app Playwright config (T-3.A).
//
// Spawns hub + headball + insider in parallel via Turbo so cross-app /join
// bounce flows and Insider 4-context multi-role specs can drive all three
// origins in one run. Per-app configs (apps/<game>/playwright.config.ts) still
// exist for app-scoped runs; this root config is for cross-app E2E.
//
// Port assignments mirror the app dev scripts (next dev defaults / -p flags):
//   - headball: 3000  (apps/headball/package.json: "dev": "next dev")
//   - hub:      3001  (apps/hub/package.json:      "dev": "next dev -p 3001")
//   - insider:  3002  (apps/insider/package.json:  "dev": "next dev -p 3002")
//
// (Phase-5b PRD listed hub:3000 / headball:3001, but the apps were locked to
// the assignments above during Phase 0-5a. Reshuffling would break already-
// shipped per-app configs and the realtime-publication checker workflow, so
// we keep the existing ports here.)

const HEADBALL_PORT = process.env.HEADBALL_PORT ?? "3000"
const HUB_PORT = process.env.HUB_PORT ?? "3001"
const INSIDER_PORT = process.env.INSIDER_PORT ?? "3002"

const HEADBALL_URL = `http://localhost:${HEADBALL_PORT}`
const HUB_URL = `http://localhost:${HUB_PORT}`
const INSIDER_URL = `http://localhost:${INSIDER_PORT}`

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321"
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"

const sharedEnv: Record<string, string> = {
  NEXT_PUBLIC_HEADBALL_URL: HEADBALL_URL,
  NEXT_PUBLIC_HUB_URL: HUB_URL,
  NEXT_PUBLIC_INSIDER_URL: INSIDER_URL,
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
}

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
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
  webServer: [
    {
      command: `bunx turbo run dev --filter=@social-hub/headball`,
      url: HEADBALL_URL,
      reuseExistingServer: true,
      timeout: 180_000,
      stdout: "ignore",
      stderr: "pipe",
      env: sharedEnv,
    },
    {
      command: `bunx turbo run dev --filter=@social-hub/hub`,
      url: HUB_URL,
      reuseExistingServer: true,
      timeout: 180_000,
      stdout: "ignore",
      stderr: "pipe",
      env: sharedEnv,
    },
    {
      command: `bunx turbo run dev --filter=@social-hub/insider`,
      url: INSIDER_URL,
      reuseExistingServer: true,
      timeout: 180_000,
      stdout: "ignore",
      stderr: "pipe",
      env: sharedEnv,
    },
  ],
})
