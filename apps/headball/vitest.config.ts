import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "node:path"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["lib/**/*.test.ts", "lib/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: [
      // Order matters — list more-specific patterns first so vitest doesn't
      // match `@/data` against the generic `@` alias.
      { find: /^@\/data\/(.*)$/, replacement: path.resolve(__dirname, "../../data/$1") },
      { find: "@", replacement: path.resolve(__dirname, ".") },
    ],
  },
})
