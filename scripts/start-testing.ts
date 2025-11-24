#!/usr/bin/env tsx

/**
 * Interactive A2A Agent Testing Setup
 *
 * Guides the user through starting the local inspector and choosing an agent to test.
 */

import { spawn } from "node:child_process";
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

async function question(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function checkInspectorDir(): Promise<boolean> {
  const { existsSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { homedir } = await import("node:os");

  const inspectorDir = join(homedir(), "Development", "a2a-inspector");
  return existsSync(inspectorDir);
}

function startInspector(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log("\n🔍 Starting local inspector...");
    console.log("   URL: http://127.0.0.1:5001\n");

    const inspector = spawn("pnpm", ["inspector"], {
      stdio: "inherit",
      shell: true,
    });

    inspector.on("error", reject);

    // Give inspector time to start
    setTimeout(() => resolve(), 3000);
  });
}

function startAgent(agentName: string): void {
  console.log(`\n🤖 Starting ${agentName} agent...`);
  console.log("   Check port above for connection URL\n");
  console.log("Next steps:");
  console.log("  1. Inspector is at: http://127.0.0.1:5001");
  console.log(
    `  2. Connect to agent at: http://localhost:${AGENTS.find((a) => a.name === agentName)?.port || 41244}`
  );
  console.log("\nPress Ctrl+C to stop the agent\n");

  const agent = spawn("pnpm", [`agent:${agentName}`], {
    stdio: "inherit",
    shell: true,
  });

  agent.on("error", (err) => {
    console.error(`\n❌ Failed to start agent: ${err.message}`);
    process.exit(1);
  });

  // Handle Ctrl+C
  process.on("SIGINT", () => {
    console.log("\n\n🛑 Stopping agent...");
    agent.kill("SIGINT");
    process.exit(0);
  });
}

async function main() {
  console.log("🚀 A2A Agent Testing Setup\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    // Check if inspector is set up
    const hasInspector = await checkInspectorDir();
    if (!hasInspector) {
      console.log("❌ Local inspector not found!\n");
      console.log("Please set it up first:");
      console.log("  cd ~/Development");
      console.log("  git clone https://github.com/a2aproject/a2a-inspector.git");
      console.log("  cd a2a-inspector");
      console.log("  uv sync");
      console.log("  cd frontend && npm install\n");
      console.log("See INSPECTOR_SETUP.md for details");
      rl.close();
      process.exit(1);
    }

    // Show available agents
    console.log("📋 Available agents:\n");
    for (const agent of AGENTS) {
      console.log(`  • ${agent.name.padEnd(15)} (port ${agent.port}) - ${agent.description}`);
    }
    console.log();

    // Ask which agent to test
    const agentName = await question(rl, "Which agent to test? (default: hello-world): ");
    const selectedAgent = agentName.trim() || "hello-world";

    // Validate agent exists
    const agent = AGENTS.find((a) => a.name === selectedAgent);
    if (!agent) {
      console.log(`\n❌ Unknown agent: ${selectedAgent}`);
      console.log(`Available: ${AGENTS.map((a) => a.name).join(", ")}`);
      rl.close();
      process.exit(1);
    }

    rl.close();

    // Start inspector (in background via pnpm inspector)
    await startInspector();

    // Start agent (foreground)
    startAgent(agent.name);
  } catch (err) {
    console.error("\n❌ Error:", err);
    rl.close();
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
