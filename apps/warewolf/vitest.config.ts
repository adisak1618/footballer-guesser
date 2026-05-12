import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "node:path"

export default defineConfig({
  plugins: [react()],
  test: {
    // Default to node for pure-TS lib/scripts tests; component tests opt in
    // via a top-of-file `// @vitest-environment jsdom` directive.
    environment: "node",
    globals: true,
    include: [
      "lib/**/*.test.ts",
      "lib/**/*.test.tsx",
      "components/**/*.test.ts",
      "components/**/*.test.tsx",
      "scripts/**/*.test.ts",
      "middleware.test.ts",
    ],
    exclude: ["e2e/**", "node_modules/**"],
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: [
      // Order matters — most-specific first.
      { find: /^@\/data\/(.*)$/, replacement: path.resolve(__dirname, "../../data/$1") },
      { find: "@", replacement: path.resolve(__dirname, ".") },
    ],
  },
})
