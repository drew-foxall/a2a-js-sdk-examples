#!/usr/bin/env tsx

/**
 * Start Local A2A Inspector
 *
 * This script starts the local A2A inspector in the background.
 * It handles:
 * - Backend server (Python/uv)
 * - Frontend build (one-time, no watch mode)
 * - Process management
 * - Logging
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const INSPECTOR_DIR = join(homedir(), "Development", "a2a-inspector");
const BACKEND_LOG = "/tmp/a2a-inspector-backend.log";
const FRONTEND_LOG = "/tmp/a2a-inspector-frontend.log";
const PORT = 5001;

interface SpawnResult {
  success: boolean;
  pid?: number;
  error?: string;
}

async function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const net = require("node:net");
    const server = net.createServer();

    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        resolve(true); // Port is in use
      } else {
        resolve(false);
      }
    });

    server.once("listening", () => {
      server.close();
      resolve(false); // Port is free
    });

    server.listen(port);
  });
}

async function killPort(port: number): Promise<void> {
  return new Promise((resolve) => {
    const killer = spawn("lsof", ["-ti", `:${port}`]);
    let pids = "";

    killer.stdout.on("data", (data) => {
      pids += data.toString();
    });

    killer.on("close", () => {
      if (pids.trim()) {
        const pidList = pids.trim().split("\n");
        for (const pid of pidList) {
          try {
            process.kill(Number.parseInt(pid, 10), "SIGKILL");
          } catch {
            // Process might already be dead
          }
        }
      }
      setTimeout(resolve, 500); // Give time for cleanup
    });

    killer.on("error", () => resolve()); // lsof not found or error
  });
}

async function buildFrontend(): Promise<SpawnResult> {
  return new Promise((resolve) => {
    console.log("Building frontend...");

    const build = spawn("npm", ["run", "build"], {
      cwd: join(INSPECTOR_DIR, "frontend"),
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });

    const logStream = require("node:fs").createWriteStream(FRONTEND_LOG);
    build.stdout.pipe(logStream);
    build.stderr.pipe(logStream);

    build.on("close", (code) => {
      logStream.end();
      if (code === 0) {
        resolve({ success: true });
      } else {
        resolve({
          success: false,
          error: `Frontend build failed with code ${code}. Check ${FRONTEND_LOG}`,
        });
      }
    });

    build.on("error", (err) => {
      logStream.end();
      resolve({ success: false, error: err.message });
    });
  });
}

async function startBackend(): Promise<SpawnResult> {
  return new Promise((resolve) => {
    console.log("Starting backend server...");

    const backend = spawn("uv", ["run", "app.py"], {
      cwd: join(INSPECTOR_DIR, "backend"),
      stdio: ["ignore", "pipe", "pipe"],
      detached: true, // Run in background
    });

    if (!backend.pid) {
      resolve({ success: false, error: "Failed to spawn backend process" });
      return;
    }

    const logStream = require("node:fs").createWriteStream(BACKEND_LOG);
    backend.stdout.pipe(logStream);
    backend.stderr.pipe(logStream);

    // Unref so this process can exit
    backend.unref();

    // Give backend time to start
    setTimeout(() => {
      resolve({ success: true, pid: backend.pid });
    }, 2000);
  });
}

async function main() {
  console.log("🔍 Starting local A2A Inspector...\n");

  // Check if inspector directory exists
  if (!existsSync(INSPECTOR_DIR)) {
    console.error(`❌ Inspector not found at: ${INSPECTOR_DIR}`);
    console.error("\nPlease clone it first:");
    console.error("  cd ~/Development");
    console.error("  git clone https://github.com/a2aproject/a2a-inspector.git");
    console.error("  cd a2a-inspector");
    console.error("  uv sync");
    console.error("  cd frontend && npm install");
    process.exit(1);
  }

  // Check if port is already in use
  const portInUse = await checkPort(PORT);
  if (portInUse) {
    console.log(`⚠️  Port ${PORT} is already in use`);

    // Check if running in non-interactive mode (piped input)
    const isInteractive = process.stdin.isTTY;

    if (!isInteractive) {
      console.log("Non-interactive mode: stopping existing inspector...");
      await killPort(PORT);
    } else {
      const readline = require("node:readline");
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise<string>((resolve) => {
        rl.question("Kill existing process? (y/n): ", resolve);
      });
      rl.close();

      if (answer.toLowerCase() === "y") {
        console.log("Stopping existing inspector...");
        await killPort(PORT);
      } else {
        console.log("Exiting...");
        process.exit(0);
      }
    }
  }

  // Build frontend
  const frontendResult = await buildFrontend();
  if (!frontendResult.success) {
    console.error(`❌ ${frontendResult.error}`);
    process.exit(1);
  }

  // Start backend
  const backendResult = await startBackend();
  if (!backendResult.success) {
    console.error(`❌ ${backendResult.error}`);
    process.exit(1);
  }

  console.log("\n✅ A2A Inspector is running!\n");
  console.log(`📍 URL: http://127.0.0.1:${PORT}`);
  console.log(`🔧 Backend PID: ${backendResult.pid}`);
  console.log("📁 Logs:");
  console.log(`   Backend:  tail -f ${BACKEND_LOG}`);
  console.log(`   Frontend: cat ${FRONTEND_LOG}`);
  console.log("\nTo stop:");
  console.log("  pnpm inspector:stop");
  console.log("  # or");
  console.log(`  kill ${backendResult.pid}`);
  console.log("\n⚠️  Note: Frontend is built once (not watching for changes).");
  console.log(
    "   For inspector development with live reload, use manual mode (see INSPECTOR_SETUP.md)"
  );
  console.log();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
