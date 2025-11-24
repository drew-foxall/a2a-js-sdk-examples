#!/usr/bin/env tsx

/**
 * View logs from the A2A Inspector Docker container
 *
 * This script displays the container logs in real-time.
 */

import { spawn } from "node:child_process";

const CONTAINER_NAME = "a2a-inspector";

/**
 * Check if container exists (running or stopped)
 */
function checkContainerExists(): Promise<boolean> {
  return new Promise((resolve) => {
    const docker = spawn("docker", ["ps", "-a", "-q", "-f", `name=${CONTAINER_NAME}`], {
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
 * Show container logs
 */
function showLogs(follow: boolean = false): void {
  console.log(`📋 A2A Inspector Logs ${follow ? "(live)" : ""}\n`);

  const args = ["logs"];
  if (follow) {
    args.push("-f"); // Follow log output
  }
  args.push("--tail", "100"); // Last 100 lines
  args.push(CONTAINER_NAME);

  const docker = spawn("docker", args, {
    stdio: "inherit",
  });

  docker.on("error", (err) => {
    console.error(`\n❌ Error: ${err.message}\n`);
    process.exit(1);
  });

  docker.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`\n❌ Docker logs failed with code ${code}\n`);
      process.exit(1);
    }
  });
}

/**
 * Main function
 */
async function main() {
  if (!(await checkContainerExists())) {
    console.log("ℹ️  Inspector container not found\n");
    console.log("Start it with: pnpm inspector\n");
    return;
  }

  // Check for --follow flag
  const follow = process.argv.includes("--follow") || process.argv.includes("-f");

  showLogs(follow);
}

main().catch((error) => {
  console.error(`\n❌ Error: ${error.message}\n`);
  process.exit(1);
});
