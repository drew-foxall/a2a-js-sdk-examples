/**
 * Dice Agent - A2A Server
 *
 * Exposes the Dice agent via the A2A protocol using Hono.
 * Demonstrates tool usage with pure computational functions.
 *
 * Port: 41245 (by default)
 *
 * Usage:
 *   pnpm agents:dice-agent
 *   # or
 *   cd samples/js
 *   pnpm tsx src/agents/dice-agent/index.ts
 */

import type { AgentCard, AgentSkill } from "@drew-foxall/a2a-js-sdk";
import {
  type AgentExecutor,
  DefaultRequestHandler,
  InMemoryTaskStore,
  type TaskStore,
} from "@drew-foxall/a2a-js-sdk/server";
import { A2AHonoApp } from "@drew-foxall/a2a-js-sdk/server/hono";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { A2AAdapter } from "../../shared/a2a-adapter.js";
import { getModel } from "../../shared/utils.js";
import { createDiceAgent } from "./agent.js";

// ============================================================================
// Configuration
// ============================================================================

const PORT = 41245;
const HOST = "0.0.0.0";
const BASE_URL = `http://localhost:${PORT}`;

// ============================================================================
// Agent Card Configuration
// ============================================================================

const rollDiceSkill: AgentSkill = {
  id: "f56cab88-3fe9-47ec-ba6e-86a13c9f1f74",
  name: "Roll Dice",
  description: "Rolls an N-sided dice and returns the result. By default uses a 6-sided dice.",
  tags: ["dice", "random", "game"],
  examples: ["Can you roll an 11-sided dice?", "Roll a 20-sided die", "Roll 2d6"],
};

const checkPrimeSkill: AgentSkill = {
  id: "33856129-d686-4a54-9c6e-fffffec3561b",
  name: "Prime Detector",
  description: "Determines which numbers from a list are prime numbers.",
  tags: ["prime", "math", "numbers"],
  examples: [
    "Which of these are prime numbers: 1, 4, 6, 7",
    "Is 17 a prime number?",
    "Check if 2, 3, 5, 7 are prime",
  ],
};

const agentCard: AgentCard = {
  name: "Dice Agent",
  description: "An agent that can roll arbitrary dice and answer if numbers are prime",
  url: `${BASE_URL}/.well-known/agent-card.json`,
  version: "1.0.0",
  protocolVersion: "0.3.0",
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
  capabilities: {
    streaming: true,
    pushNotifications: false,
    stateTransitionHistory: false,
  },
  skills: [rollDiceSkill, checkPrimeSkill],
};

// ============================================================================
// Agent Initialization
// ============================================================================

const model = getModel();
const agent = createDiceAgent(model);

// ============================================================================
// A2A Protocol Integration
// ============================================================================

const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
  mode: "generate", // Simple awaited response (like AI SDK's generateText)
  workingMessage: "Rolling dice...",
  debug: false,
});

const taskStore: TaskStore = new InMemoryTaskStore();

const requestHandler = new DefaultRequestHandler(agentCard, taskStore, agentExecutor);

// ============================================================================
// HTTP Server (Hono + A2A)
// ============================================================================

const app = new Hono();
const appBuilder = new A2AHonoApp(requestHandler);
appBuilder.setupRoutes(app);

// ============================================================================
// Start Server
// ============================================================================

console.log(`
🎲 Dice Agent - A2A Server Starting...

📍 Port: ${PORT}
🌐 URL: ${BASE_URL}
📋 Agent Card: ${BASE_URL}/.well-known/agent-card.json

🤖 Agent: Dice Agent (Tool Usage Example)
🔧 Framework: AI SDK v6 + Hono + A2A Protocol
🧠 Model: ${process.env.AI_PROVIDER || "openai"} / ${process.env.AI_MODEL || "default"}

✨ This agent demonstrates:
   - Tool usage with AI SDK ToolLoopAgent
   - Pure computational tools (no external APIs)
   - Zod schema validation for tool parameters
   - Type-safe tool implementations

🎯 Available Tools:
   1. rollDice(sides: number) - Roll N-sided dice
   2. checkPrime(numbers: number[]) - Check if numbers are prime

📝 Try it:
   curl -X POST ${BASE_URL}/message/send \\
     -H "Content-Type: application/json" \\
     -d '{"message": {"role": "user", "parts": [{"kind": "text", "text": "Roll a 20-sided die"}]}}'

🚀 Ready to roll...
`);

serve({
  fetch: app.fetch,
  port: PORT,
  hostname: HOST,
});
