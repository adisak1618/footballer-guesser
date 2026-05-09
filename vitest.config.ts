import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    projects: ["apps/*", "packages/core", "packages/ui", "packages/content"],
  },
})
