#!/usr/bin/env tsx

/**
 * Start local development infrastructure for A2A Workers
 *
 * This script:
 * 1. Checks if Docker is available
 * 2. Starts Redis and Upstash adapter containers
 * 3. Waits for services to be healthy
 *
 * Usage: pnpm local:up
 *
 * Services started:
 * - Redis: localhost:6379
 * - Upstash REST API: localhost:8079
 *
 * See: https://developers.cloudflare.com/workers/development-testing/
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
 * Check if Docker Compose is available
 */
function checkDockerCompose(): boolean {
  // Try docker compose (v2)
  const result = spawnSync("docker", ["compose", "version"], { stdio: "pipe" });
  return result.status === 0;
}

/**
 * Check if services are already running
 */
function checkServicesRunning(): boolean {
  const result = spawnSync(
    "docker",
    ["compose", "-f", COMPOSE_FILE, "-p", PROJECT_NAME, "ps", "-q"],
    { stdio: "pipe" }
  );
  return result.status === 0 && result.stdout.toString().trim().length > 0;
}

/**
 * Start the services
 */
function startServices(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log("🚀 Starting local infrastructure...\n");

    const docker = spawn(
      "docker",
      ["compose", "-f", COMPOSE_FILE, "-p", PROJECT_NAME, "up", "-d", "--wait"],
      { stdio: "inherit" }
    );

    docker.on("error", (err) => {
      reject(new Error(`Failed to start services: ${err.message}`));
    });

    docker.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Docker compose up failed with code ${code}`));
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
    console.error("\nPlease install Docker:");
    console.error("  macOS: https://docs.docker.com/desktop/install/mac-install/");
    console.error("  Linux: https://docs.docker.com/engine/install/");
    console.error("  Windows: https://docs.docker.com/desktop/install/windows-install/");
    process.exit(1);
  }

  // Check Docker Compose
  if (!checkDockerCompose()) {
    console.error("❌ Docker Compose is not available!");
    console.error("\nDocker Compose v2 is required (docker compose, not docker-compose).");
    process.exit(1);
  }

  // Check if already running
  if (checkServicesRunning()) {
    console.log("✅ Local infrastructure is already running!\n");
    console.log("📋 Services:");
    console.log("   Redis:         localhost:6379");
    console.log("   Upstash REST:  http://localhost:8079\n");
    console.log("💡 To restart: pnpm local:down && pnpm local:up\n");
    return;
  }

  // Start services
  await startServices();

  console.log("\n✅ Local infrastructure started!\n");
  console.log("📋 Services:");
  console.log("   Redis:         localhost:6379");
  console.log("   Upstash REST:  http://localhost:8079\n");
  console.log("🔧 Worker Configuration (.dev.vars):");
  console.log("   UPSTASH_REDIS_REST_URL=http://localhost:8079");
  console.log("   UPSTASH_REDIS_REST_TOKEN=local-dev-token\n");
  console.log("📂 Copy from: examples/workers/shared/.dev.vars.example\n");
  console.log("💡 Commands:");
  console.log("   Stop:   pnpm local:down");
  console.log("   Logs:   pnpm local:logs");
  console.log("   Status: pnpm local:status\n");
}

main().catch((error) => {
  console.error(`\n❌ Error: ${error.message}\n`);
  process.exit(1);
});

