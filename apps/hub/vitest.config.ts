import { defineConfig } from "vitest/config"

// Exclude the Playwright e2e dir so the workspace-root `bunx vitest run`
// doesn't try to collect e2e specs as vitest tests. Server-action unit
// tests live alongside the action under `app/actions/__tests__/`.
export default defineConfig({
  test: {
    environment: "node",
    include: [
      "lib/**/*.test.ts",
      "lib/**/*.test.tsx",
      "app/**/*.test.ts",
      "app/**/*.test.tsx",
    ],
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
  },
})
