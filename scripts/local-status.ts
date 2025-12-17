#!/usr/bin/env tsx

/**
 * Check status of local development infrastructure
 *
 * Usage: pnpm local:status
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const COMPOSE_FILE = "docker-compose.local.yml";
const PROJECT_NAME = "a2a-local";

/**
 * Check if Docker is available
 */
function checkDocker(): boolean {
  const result = spawnSync("docker", ["--version"], { stdio: "pipe" });
  return result.status === 0;
}

/**
 * Show service status
 */
function showStatus(): Promise<void> {
  return new Promise((resolve, reject) => {
    const docker = spawn(
      "docker",
      ["compose", "-f", COMPOSE_FILE, "-p", PROJECT_NAME, "ps", "-a"],
      { stdio: "inherit" }
    );

    docker.on("error", (err) => {
      reject(new Error(`Failed to show status: ${err.message}`));
    });

    docker.on("exit", (code) => {
      resolve();
    });
  });
}

/**
 * Test Upstash adapter health
 */
async function testUpstashHealth(): Promise<boolean> {
  try {
    const response = await fetch("http://localhost:8079/health");
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log("🏠 A2A Local Infrastructure Status\n");

  // Check compose file exists
  const composeFilePath = resolve(process.cwd(), COMPOSE_FILE);
  if (!existsSync(composeFilePath)) {
    console.error(`❌ Compose file not found: ${COMPOSE_FILE}`);
    console.error("\nMake sure you're running this from the project root.");
    process.exit(1);
  }

  // Check Docker
  if (!checkDocker()) {
    console.error("❌ Docker is not available!");
    process.exit(1);
  }

  // Show container status
  console.log("📦 Container Status:\n");
  await showStatus();

  // Test Upstash health
  console.log("\n🔍 Service Health:\n");
  const upstashHealthy = await testUpstashHealth();
  
  if (upstashHealthy) {
    console.log("   ✅ Upstash REST API: http://localhost:8079 (healthy)");
  } else {
    console.log("   ❌ Upstash REST API: http://localhost:8079 (not responding)");
    console.log("\n   💡 Start with: pnpm local:up");
  }

  console.log("\n💡 Commands:");
  console.log("   Start: pnpm local:up");
  console.log("   Stop:  pnpm local:down");
  console.log("   Logs:  pnpm local:logs\n");
}

main().catch((error) => {
  console.error(`\n❌ Error: ${error.message}\n`);
  process.exit(1);
});

