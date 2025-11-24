#!/usr/bin/env tsx

/**
 * Start the A2A Inspector using Docker
 *
 * This script:
 * 1. Checks if Docker is available
 * 2. Builds/pulls the a2a-inspector image if needed
 * 3. Runs the inspector in a Docker container
 * 4. Maps container port 8080 to host port 5001
 *
 * Benefits over local clone:
 * - No Python/Node.js dependencies
 * - Self-contained and reproducible
 * - Works consistently across all machines
 * - No need for external directory setup
 */

import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const CONTAINER_NAME = "a2a-inspector";
const IMAGE_NAME = "a2a-inspector";
const HOST_PORT = 5001;
const CONTAINER_PORT = 8080;
const INSPECTOR_REPO = "https://github.com/a2aproject/a2a-inspector.git";

/**
 * Check if Docker is available
 */
function checkDocker(): Promise<boolean> {
  return new Promise((resolve) => {
    const docker = spawn("docker", ["--version"], { stdio: "pipe" });
    docker.on("error", () => resolve(false));
    docker.on("exit", (code) => resolve(code === 0));
  });
}

/**
 * Check if the inspector image exists
 */
function checkImage(): Promise<boolean> {
  return new Promise((resolve) => {
    const docker = spawn("docker", ["image", "inspect", IMAGE_NAME], {
      stdio: "pipe",
    });
    docker.on("exit", (code) => resolve(code === 0));
  });
}

/**
 * Check if the container is already running
 */
function checkContainerRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    const docker = spawn("docker", ["ps", "-q", "-f", `name=${CONTAINER_NAME}`], {
      stdio: "pipe",
    });

    let output = "";
    docker.stdout.on("data", (data) => {
      output += data.toString();
    });

    docker.on("exit", (code) => {
      resolve(code === 0 && output.trim().length > 0);
    });
  });
}

/**
 * Build the inspector image from GitHub
 */
function buildImage(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log("📦 Building inspector image from GitHub...");
    console.log(`   Repo: ${INSPECTOR_REPO}`);
    console.log("   This may take a few minutes on first run...\n");

    const docker = spawn("docker", ["build", "-t", IMAGE_NAME, INSPECTOR_REPO], {
      stdio: "inherit",
    });

    docker.on("error", (err) => {
      reject(new Error(`Failed to build image: ${err.message}`));
    });

    docker.on("exit", (code) => {
      if (code === 0) {
        console.log("\n✅ Inspector image built successfully!\n");
        resolve();
      } else {
        reject(new Error(`Docker build failed with code ${code}`));
      }
    });
  });
}

/**
 * Stop and remove existing container
 */
function stopExistingContainer(): Promise<void> {
  return new Promise((resolve) => {
    const docker = spawn("docker", ["rm", "-f", CONTAINER_NAME], {
      stdio: "pipe",
    });
    docker.on("exit", () => resolve());
  });
}

/**
 * Start the inspector container
 */
function startContainer(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log("🚀 Starting inspector container...");
    console.log(`   Container: ${CONTAINER_NAME}`);
    console.log(`   Port: ${HOST_PORT} (host) → ${CONTAINER_PORT} (container)\n`);

    const docker = spawn(
      "docker",
      ["run", "-d", "--name", CONTAINER_NAME, "-p", `${HOST_PORT}:${CONTAINER_PORT}`, IMAGE_NAME],
      { stdio: "pipe" }
    );

    let containerId = "";
    docker.stdout.on("data", (data) => {
      containerId += data.toString();
    });

    docker.on("error", (err) => {
      reject(new Error(`Failed to start container: ${err.message}`));
    });

    docker.on("exit", (code) => {
      if (code === 0) {
        console.log(`✅ Inspector started: ${containerId.trim().substring(0, 12)}\n`);

        // Save container ID for cleanup
        try {
          writeFileSync("/tmp/a2a-inspector-container-id", containerId.trim());
        } catch (_err) {
          // Non-critical
        }

        resolve();
      } else {
        reject(new Error(`Docker run failed with code ${code}`));
      }
    });
  });
}

/**
 * Main function
 */
async function main() {
  console.log("🔍 A2A Inspector (Docker)\n");

  // Check Docker
  if (!(await checkDocker())) {
    console.error("❌ Docker is not available!");
    console.error("\nPlease install Docker:");
    console.error("  macOS: https://docs.docker.com/desktop/install/mac-install/");
    console.error("  Linux: https://docs.docker.com/engine/install/");
    console.error("  Windows: https://docs.docker.com/desktop/install/windows-install/");
    process.exit(1);
  }

  // Check if already running
  if (await checkContainerRunning()) {
    console.log("✅ Inspector is already running!");
    console.log(`   URL: http://127.0.0.1:${HOST_PORT}\n`);
    console.log("💡 To restart, first stop it with: pnpm inspector:stop\n");
    return;
  }

  // Check/build image
  if (!(await checkImage())) {
    console.log("📥 Inspector image not found locally");
    await buildImage();
  } else {
    console.log("✅ Inspector image found\n");
  }

  // Clean up any stopped containers with same name
  await stopExistingContainer();

  // Start container
  await startContainer();

  console.log("📋 Inspector Ready:");
  console.log(`   URL: http://127.0.0.1:${HOST_PORT}`);
  console.log(`   Container: ${CONTAINER_NAME}\n`);
  console.log("💡 Commands:");
  console.log("   Stop:  pnpm inspector:stop");
  console.log("   Logs:  pnpm inspector:logs");
  console.log("   Help:  pnpm inspector:help\n");
}

main().catch((error) => {
  console.error(`\n❌ Error: ${error.message}\n`);
  process.exit(1);
});
