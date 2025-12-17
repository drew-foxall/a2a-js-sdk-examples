import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Use threads pool for better stability in parallel turbo runs
    pool: "threads",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
});
