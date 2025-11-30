/**
 * Load environment variables with fallback logic
 *
 * Priority:
 * 1. Agent-specific .env file (e.g., src/agents/hello-world/.env)
 * 2. Root .env file (../../.env from examples/agents/)
 *
 * This allows each agent to have its own API keys/config while
 * falling back to shared configuration.
 */

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Load environment variables for an agent
 *
 * @param agentDir - The directory of the agent (e.g., import.meta.url)
 * @returns void
 *
 * @example
 * ```typescript
 * // In your agent's index.ts:
 * import { loadEnv } from "../../shared/load-env";
 * loadEnv(import.meta.url);
 * ```
 */
export function loadEnv(agentModuleUrl: string): void {
  const agentDir = dirname(fileURLToPath(agentModuleUrl));

  // Try agent-specific .env first
  const agentEnvPath = resolve(agentDir, ".env");
  const rootEnvPath = resolve(agentDir, "../../../../.env");

  let loaded = false;

  // Load root .env first (as base)
  if (existsSync(rootEnvPath)) {
    try {
      process.loadEnvFile(rootEnvPath);
      console.log(`✅ Loaded root .env: ${rootEnvPath}`);
      loaded = true;
    } catch (error) {
      console.warn(`⚠️  Failed to load root .env: ${error}`);
    }
  }

  // Load agent-specific .env (overrides root)
  if (existsSync(agentEnvPath)) {
    try {
      process.loadEnvFile(agentEnvPath);
      console.log(`✅ Loaded agent .env: ${agentEnvPath}`);
      loaded = true;
    } catch (error) {
      console.warn(`⚠️  Failed to load agent .env: ${error}`);
    }
  }

  if (!loaded) {
    console.warn("⚠️  No .env file found (checked root and agent directory)");
  }
}
