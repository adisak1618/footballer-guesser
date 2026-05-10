import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "node:path"

export default defineConfig({
  plugins: [react()],
  test: {
    // Per-file env override: lib/**/*.test.ts stays in node (existing RPC + migration
    // suites). lib/**/*.test.tsx uses jsdom for component tests via the
    // /// @vitest-environment jsdom directive at the top of the .tsx test file.
    environment: "node",
    globals: true,
    include: ["lib/**/*.test.ts", "lib/**/*.test.tsx"],
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: [{ find: "@", replacement: path.resolve(__dirname, ".") }],
  },
})
