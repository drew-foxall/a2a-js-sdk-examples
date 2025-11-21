/**
 * Hello World Agent - A2A Server
 *
 * Exposes the Hello World agent via the A2A protocol using Hono.
 * This demonstrates the simplest possible A2A agent integration.
 *
 * ⚠️ IMPORTANT: This file follows the CORRECT A2A integration pattern.
 * If you're creating a new agent, copy this pattern exactly!
 * See: /A2A_INTEGRATION_PATTERN.md for detailed documentation.
 *
 * Port: 41244 (by default)
 *
 * Usage:
 *   pnpm start:hello-world
 *   # or
 *   cd samples/js
 *   pnpm tsx src/agents/hello-world/index.ts
 */

// Core A2A types (from main package)
import type { AgentCard, AgentSkill } from "@drew-foxall/a2a-js-sdk";
// Server components (from /server subpath) ✅
import {
  type AgentExecutor,
  DefaultRequestHandler,
  InMemoryTaskStore,
  type TaskStore,
} from "@drew-foxall/a2a-js-sdk/server";
// Hono integration (from /server/hono subpath) ✅ NOT just /hono!
import { A2AHonoApp } from "@drew-foxall/a2a-js-sdk/server/hono";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
// Our adapter that bridges AI SDK agents to A2A
import { A2AAdapter } from "../../shared/a2a-adapter.js";
import { getModel } from "../../shared/utils.js";
import { createHelloWorldAgent } from "./agent.js";

// ============================================================================
// Configuration
// ============================================================================

const PORT = 41244;
const HOST = "0.0.0.0";
const BASE_URL = `http://localhost:${PORT}`;

// ============================================================================
// Agent Card Configuration
// ============================================================================

const helloWorldSkill: AgentSkill = {
  id: "hello_world",
  name: "Returns hello world",
  description: "A simple greeting agent that responds with friendly hello messages",
  tags: ["hello world", "greeting", "simple"],
  examples: ["hi", "hello world", "greet me", "say hello"],
};

const agentCard: AgentCard = {
  name: "Hello World Agent",
  description: "The simplest possible A2A agent - responds with friendly greetings",
  url: `${BASE_URL}/.well-known/agent-card.json`,
  protocolVersion: "0.3.0", // ✅ Required field
  version: "1.0.0",
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
  capabilities: {
    // ✅ Plain object (NOT new AgentCapabilities())
    streaming: true,
    pushNotifications: false,
    stateTransitionHistory: true,
  },
  skills: [helloWorldSkill],
};

// ============================================================================
// Agent Initialization
// ============================================================================

const model = getModel();
const agent = createHelloWorldAgent(model);

// ============================================================================
// A2A Protocol Integration
// ============================================================================

// ✅ A2AAdapter IS the AgentExecutor - use it directly
// ❌ WRONG: new A2AAdapter({ agent, agentCard })
// ❌ WRONG: adapter.createAgentExecutor()
const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
  mode: "stream", // Real-time text streaming (like AI SDK's streamText)
  workingMessage: "Processing your greeting...",
  includeHistory: true,
  debug: false,
});

// ============================================================================
// Server Setup
// ============================================================================

async function main() {
  // Step 1: Create task store for managing conversation state
  const taskStore: TaskStore = new InMemoryTaskStore();

  // Step 2: Create request handler (combines agentCard, taskStore, executor)
  // ✅ CORRECT: DefaultRequestHandler takes 3 arguments
  const requestHandler = new DefaultRequestHandler(agentCard, taskStore, agentExecutor);

  // Step 3: Create Hono app and set up A2A routes
  const app = new Hono();
  // ✅ CORRECT: A2AHonoApp takes a single requestHandler argument
  // ❌ WRONG: new A2AHonoApp({ agentCard, agentExecutor })
  const appBuilder = new A2AHonoApp(requestHandler);
  appBuilder.setupRoutes(app); // Registers /.well-known/agent-card.json, /message/send, etc.

  console.log(`
🎉 Hello World Agent - A2A Server Starting...

📍 Port: ${PORT}
🌐 URL: ${BASE_URL}
📋 Agent Card: ${BASE_URL}/.well-known/agent-card.json

🤖 Agent: Hello World (Simplest A2A Example)
🔧 Framework: AI SDK v6 + Hono + A2A Protocol
🧠 Model: ${process.env.AI_PROVIDER || "openai"} / ${process.env.AI_MODEL || "default"}

✨ This agent demonstrates:
   - Basic AI SDK ToolLoopAgent usage
   - A2A protocol integration via A2AAdapter
   - Protocol-agnostic agent design
   - Foundation pattern for all agents

📝 Try it:
   curl -X POST ${BASE_URL}/message/send \\
     -H "Content-Type: application/json" \\
     -d '{"message": {"role": "user", "parts": [{"kind": "text", "text": "Hello!"}]}}'

🚀 Ready to accept A2A requests...
`);

  // Step 4: Start server
  // ✅ Use app.fetch (the Hono instance), NOT appBuilder.fetch
  serve({
    fetch: app.fetch,
    port: PORT,
    hostname: HOST,
  });
}

main().catch(console.error);
