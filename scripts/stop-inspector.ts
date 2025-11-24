#!/usr/bin/env tsx

/**
 * Stop the A2A Inspector Docker container
 *
 * This script stops and removes the running inspector container.
 */

import { spawn } from "node:child_process";

const CONTAINER_NAME = "a2a-inspector";

/**
 * Check if container is running
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
 * Stop the container
 */
function stopContainer(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log("🛑 Stopping inspector container...\n");

    const docker = spawn("docker", ["stop", CONTAINER_NAME], {
      stdio: "inherit",
    });

    docker.on("error", (err) => {
      reject(new Error(`Failed to stop container: ${err.message}`));
    });

    docker.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Docker stop failed with code ${code}`));
      }
    });
  });
}

/**
 * Remove the container
 */
function removeContainer(): Promise<void> {
  return new Promise((resolve) => {
    const docker = spawn("docker", ["rm", CONTAINER_NAME], {
      stdio: "pipe",
    });
    docker.on("exit", () => resolve());
  });
}

/**
 * Main function
 */
async function main() {
  console.log("🔍 A2A Inspector - Stop\n");

  if (!(await checkContainerRunning())) {
    console.log("ℹ️  Inspector is not running\n");
    return;
  }

  await stopContainer();
  await removeContainer();

  console.log("\n✅ Inspector stopped successfully\n");
}

main().catch((error) => {
  console.error(`\n❌ Error: ${error.message}\n`);
  process.exit(1);
});
