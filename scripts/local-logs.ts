#!/usr/bin/env tsx

/**
 * View logs from local development infrastructure
 *
 * Usage: pnpm local:logs
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
 * Show logs from services
 */
function showLogs(): Promise<void> {
  return new Promise((resolve, reject) => {
    const docker = spawn(
      "docker",
      ["compose", "-f", COMPOSE_FILE, "-p", PROJECT_NAME, "logs", "-f", "--tail=100"],
      { stdio: "inherit" }
    );

    docker.on("error", (err) => {
      reject(new Error(`Failed to show logs: ${err.message}`));
    });

    docker.on("exit", (code) => {
      // Exit code doesn't matter for logs (user may Ctrl+C)
      resolve();
    });
  });
}

/**
 * Main function
 */
async function main() {
  console.log("📋 A2A Local Infrastructure Logs\n");

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

  console.log("Press Ctrl+C to stop viewing logs\n");
  console.log("─".repeat(60) + "\n");

  // Show logs
  await showLogs();
}

main().catch((error) => {
  console.error(`\n❌ Error: ${error.message}\n`);
  process.exit(1);
});

