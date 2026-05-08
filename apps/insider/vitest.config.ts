import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["lib/**/*.test.ts"],
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
  },
  resolve: {
    alias: [{ find: "@", replacement: path.resolve(__dirname, ".") }],
  },
})
