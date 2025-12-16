import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"],
    testTimeout: 30000, // 30s for network requests
    hookTimeout: 10000,
    // Load environment variables from .dev.vars for tests
    env: {
      // These will be overridden by actual env vars if set
      TEST_BASE_URL: "http://localhost:8787",
    },
  },
});


