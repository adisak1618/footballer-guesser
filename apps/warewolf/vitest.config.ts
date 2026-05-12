import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: [
      "lib/**/*.test.ts",
      "lib/**/*.test.tsx",
      "middleware.test.ts",
    ],
    exclude: ["e2e/**", "node_modules/**"],
  },
})
