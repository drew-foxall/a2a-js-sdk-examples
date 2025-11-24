#!/usr/bin/env tsx

/**
 * A2A Agent Testing Orchestrator
 *
 * Manages inspector and agent processes with proper dependency management and cleanup.
 * When the parent process is stopped (Ctrl+C), all child processes are cleaned up.
 */

import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import * as readline from "node:readline";

interface Agent {
  name: string;
  port: number;
  description: string;
}

const AGENTS: Agent[] = [
  { name: "hello-world", port: 41244, description: "Simple greetings" },
  { name: "dice", port: 41245, description: "Roll dice & check primes" },
  { name: "github", port: 41246, description: "GitHub queries" },
  { name: "analytics", port: 41247, description: "Generate charts" },
  { name: "currency", port: 41248, description: "Currency conversion" },
  { name: "movie", port: 41249, description: "Movie search (TMDB)" },
  { name: "coder", port: 41250, description: "Code generation" },
  { name: "content-editor", port: 41251, description: "Text editing" },
  { name: "weather", port: 41252, description: "Weather forecasts" },
  { name: "airbnb", port: 41253, description: "Airbnb search" },
  { name: "planner", port: 41254, description: "Multi-agent planner" },
];

const INSPECTOR_PORT = 5001;
const INSPECTOR_CHECK_INTERVAL = 500; // ms
const INSPECTOR_MAX_WAIT = 30000; // 30 seconds

// Track child processes for cleanup
const childProcesses: ChildProcess[] = [];
let isShuttingDown = false;

async function question(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function checkInspectorDir(): boolean {
  const inspectorDir = join(homedir(), "Development", "a2a-inspector");
  return existsSync(inspectorDir);
}

async function checkPort(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}`, {
      method: "GET",
    });
    // Any response (including errors) means server is up
    return response.status >= 200 && response.status < 600;
  } catch {
    // Connection refused or network error = server not running
    return false;
  }
}

function startProcess(
  name: string,
  command: string,
  args: string[],
  options: { stdio?: "inherit" | "pipe"; shell?: boolean } = {}
): ChildProcess {
  const proc = spawn(command, args, {
    stdio: options.stdio || "inherit",
    shell: options.shell || true,
    env: { ...process.env },
    detached: false, // Keep attached to parent for cleanup
  });

  childProcesses.push(proc);

  proc.on("error", (err) => {
    if (!isShuttingDown) {
      console.error(`❌ ${name} error:`, err.message);
    }
  });

  proc.on("exit", (code, _signal) => {
    if (!isShuttingDown && code !== 0 && code !== null) {
      console.error(`❌ ${name} exited with code ${code}`);
    }
  });

  return proc;
}

async function startInspector(): Promise<void> {
  console.log("\n🔍 Starting A2A Inspector...");
  console.log("   URL: http://127.0.0.1:5001\n");

  // Check if inspector is already running
  if (await checkPort(INSPECTOR_PORT)) {
    console.log("✅ Inspector is already running!\n");
    return;
  }

  // Stop any existing inspector first
  console.log("🧹 Cleaning up any existing inspector...");
  const stopProc = spawn("pnpm", ["inspector:stop"], {
    stdio: "pipe",
    shell: true,
  });

  await new Promise((resolve) => {
    stopProc.on("close", () => resolve(void 0));
    setTimeout(() => resolve(void 0), 2000); // Timeout after 2s
  });

  // Give it a moment to fully stop
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Start inspector (pipe to hide noise, check logs if needed)
  startProcess("Inspector", "pnpm", ["dev:inspector"], { stdio: "pipe" });

  // Wait for inspector to be ready
  console.log("⏳ Waiting for inspector to be ready...");
  const startTime = Date.now();

  while (Date.now() - startTime < INSPECTOR_MAX_WAIT) {
    if (await checkPort(INSPECTOR_PORT)) {
      console.log("✅ Inspector is ready!\n");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, INSPECTOR_CHECK_INTERVAL));
  }

  throw new Error(
    "Inspector failed to start within 30 seconds. Check logs: tail -f /tmp/a2a-inspector-backend.log"
  );
}

function startAgents(agentNames: string[]): void {
  console.log(`🤖 Starting ${agentNames.length} agent(s)...\n`);

  for (const agentName of agentNames) {
    const agent = AGENTS.find((a) => a.name === agentName);
    if (!agent) {
      throw new Error(`Unknown agent: ${agentName}`);
    }

    console.log(`  ▶ ${agentName} on port ${agent.port}`);
    // Show agent output for debugging (use "inherit" to see logs)
    startProcess(`Agent (${agentName})`, "pnpm", [`agent:${agentName}`], { stdio: "inherit" });
  }

  console.log("\n📋 Testing Setup Ready:");
  console.log("  • Inspector: http://127.0.0.1:5001");
  for (const agentName of agentNames) {
    const agent = AGENTS.find((a) => a.name === agentName);
    if (agent) {
      console.log(`  • ${agentName.padEnd(16)}: http://localhost:${agent.port}`);
    }
  }
  console.log("\n💡 Press Ctrl+C to stop all services\n");
}

function cleanup(): void {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log("\n\n🛑 Stopping all services...");

  // Kill all child processes
  for (const proc of childProcesses) {
    try {
      if (proc.pid && !proc.killed) {
        // Try SIGTERM first for graceful shutdown
        proc.kill("SIGTERM");

        // Force kill after 2 seconds if still running
        setTimeout(() => {
          if (proc.pid && !proc.killed) {
            proc.kill("SIGKILL");
          }
        }, 2000);
      }
    } catch (_err) {
      // Process may already be dead
    }
  }

  // Also stop the inspector (in case it was already running)
  spawn("pnpm", ["inspector:stop"], {
    stdio: "pipe",
    shell: true,
  });

  // Give processes time to clean up
  setTimeout(() => {
    console.log("✅ All services stopped");
    process.exit(0);
  }, 3000);
}

// Register cleanup handlers
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", cleanup);

async function main() {
  console.log("🚀 A2A Agent Testing Orchestrator\n");

  // Check if inspector is set up
  if (!checkInspectorDir()) {
    console.log("❌ Local inspector not found!\n");
    console.log("Please set it up first:");
    console.log("  cd ~/Development");
    console.log("  git clone https://github.com/a2aproject/a2a-inspector.git");
    console.log("  cd a2a-inspector");
    console.log("  uv sync");
    console.log("  cd frontend && npm install\n");
    console.log("See INSPECTOR_SETUP.md for details");
    process.exit(1);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    // Show available agents
    console.log("📋 Available agents:\n");
    for (const agent of AGENTS) {
      console.log(`  • ${agent.name.padEnd(16)} (port ${agent.port}) - ${agent.description}`);
    }
    console.log();
    console.log("💡 Tips:");
    console.log("  • Multiple agents: weather,airbnb");
    console.log("  • Planner auto-starts: planner → weather + airbnb + planner\n");

    // Ask which agent(s) to test
    const input = await question(rl, "Which agent(s) to test? (default: hello-world): ");
    const selectedInput = input.trim() || "hello-world";

    rl.close();

    // Parse agent selection
    let agentsToStart: string[] = [];

    if (selectedInput === "planner") {
      // Planner scenario: start all three agents
      console.log("\n🎭 Multi-agent scenario: Travel Planner");
      console.log("   Starting: weather → airbnb → planner\n");
      agentsToStart = ["weather", "airbnb", "planner"];
    } else {
      // Split by comma for multiple agents
      agentsToStart = selectedInput.split(",").map((s) => s.trim());
    }

    // Validate all agents exist
    for (const agentName of agentsToStart) {
      const agent = AGENTS.find((a) => a.name === agentName);
      if (!agent) {
        console.log(`\n❌ Unknown agent: ${agentName}`);
        console.log(`Available: ${AGENTS.map((a) => a.name).join(", ")}`);
        process.exit(1);
      }
    }

    // Start services in order (inspector → agents)
    await startInspector();
    startAgents(agentsToStart);

    // Keep process alive
    await new Promise(() => {}); // Infinite promise, will be killed by SIGINT
  } catch (err) {
    console.error("\n❌ Error:", err);
    cleanup();
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  cleanup();
  process.exit(1);
});
