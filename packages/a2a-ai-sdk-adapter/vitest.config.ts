import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Use threads pool for better stability in parallel turbo runs
    pool: "threads",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["dist/**", "**/*.test.ts", "**/*.spec.ts"],
    },
  },
});
