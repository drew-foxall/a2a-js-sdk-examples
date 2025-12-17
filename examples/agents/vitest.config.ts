import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    testTimeout: 30000, // 30s default timeout for LLM calls
    hookTimeout: 10000, // 10s for setup/teardown
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "dist/", "**/*.test.ts", "**/*.spec.ts", "src/test-utils/"],
    },
    // Use threads pool with single thread for sequential execution
    // This avoids API rate limits and is more stable in parallel turbo runs
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
  },
});
