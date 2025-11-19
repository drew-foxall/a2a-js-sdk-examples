/**
 * Hello World Agent - A2A Server
 *
 * Exposes the Hello World agent via the A2A protocol using Hono.
 * This demonstrates the simplest possible A2A agent integration.
 *
 * Port: 41244 (by default)
 *
 * Usage:
 *   pnpm start:hello-world
 *   # or
 *   cd samples/js
 *   pnpm tsx src/agents/hello-world/index.ts
 */

import { serve } from "@hono/node-server";
import { A2AHonoApp } from "@drew-foxall/a2a-js-sdk/hono";
import {
  AgentCard,
  AgentSkill,
  AgentCapabilities,
} from "@drew-foxall/a2a-js-sdk";
import { A2AAdapter } from "../../shared/a2a-adapter.js";
import { createHelloWorldAgent } from "./agent.js";
import { getModel } from "../../shared/utils.js";

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
  examples: [
    "hi",
    "hello world",
    "greet me",
    "say hello",
  ],
};

const agentCard: AgentCard = {
  name: "Hello World Agent",
  description: "The simplest possible A2A agent - responds with friendly greetings",
  url: `${BASE_URL}/.well-known/agent-card.json`,
  version: "1.0.0",
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
  capabilities: new AgentCapabilities({
    streaming: true,
    statefulness: "stateless",
  }),
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

const adapter = new A2AAdapter({
  agent,
  agentCard,
  logger: console,
});

// ============================================================================
// HTTP Server (Hono + A2A)
// ============================================================================

const app = new A2AHonoApp({
  agentCard,
  agentExecutor: adapter.createAgentExecutor(),
});

// ============================================================================
// Start Server
// ============================================================================

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

serve({
  fetch: app.fetch,
  port: PORT,
  hostname: HOST,
});

