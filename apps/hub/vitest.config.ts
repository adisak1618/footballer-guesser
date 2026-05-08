import { defineConfig } from "vitest/config"

// Hub has no unit tests yet — exclude the Playwright e2e dir so the
// workspace-root `bunx vitest run` doesn't try to collect e2e specs as
// vitest tests. When unit tests land, drop `include` and re-scope.
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "lib/**/*.test.tsx"],
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
  },
})
