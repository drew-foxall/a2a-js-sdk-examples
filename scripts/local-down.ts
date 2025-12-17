#!/usr/bin/env tsx

/**
 * Stop local development infrastructure for A2A Workers
 *
 * Usage: pnpm local:down
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
 * Stop the services
 */
function stopServices(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log("🛑 Stopping local infrastructure...\n");

    const docker = spawn(
      "docker",
      ["compose", "-f", COMPOSE_FILE, "-p", PROJECT_NAME, "down"],
      { stdio: "inherit" }
    );

    docker.on("error", (err) => {
      reject(new Error(`Failed to stop services: ${err.message}`));
    });

    docker.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Docker compose down failed with code ${code}`));
      }
    });
  });
}

/**
 * Main function
 */
async function main() {
  console.log("🏠 A2A Local Development Infrastructure\n");

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

  // Stop services
  await stopServices();

  console.log("\n✅ Local infrastructure stopped!\n");
  console.log("💡 To start again: pnpm local:up\n");
}

main().catch((error) => {
  console.error(`\n❌ Error: ${error.message}\n`);
  process.exit(1);
});

