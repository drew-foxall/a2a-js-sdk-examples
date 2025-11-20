/**
 * Airbnb Agent - A2A Server
 *
 * A specialist agent for Airbnb accommodation search.
 * Part of the Travel Planner Multi-Agent System.
 *
 * Port: 41251 (by default)
 *
 * Usage:
 *   pnpm agents:airbnb-agent
 *   # or
 *   cd samples/js
 *   pnpm tsx src/agents/travel-planner-multiagent/airbnb-agent/index.ts
 */

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import type { AgentCard, AgentSkill } from "@drew-foxall/a2a-js-sdk";
import {
  InMemoryTaskStore,
  TaskStore,
  AgentExecutor,
  DefaultRequestHandler,
} from "@drew-foxall/a2a-js-sdk/server";
import { A2AHonoApp } from "@drew-foxall/a2a-js-sdk/server/hono";
import { A2AAdapter } from "../../../shared/a2a-adapter.js";
import { createAirbnbAgent } from "./agent.js";
import { getModel } from "../../../shared/utils.js";
import {
  getAirbnbMCPTools,
  setupMCPShutdownHandlers,
} from "./mcp-client.js";

// ============================================================================
// Configuration
// ============================================================================

const PORT = 41251;
const HOST = "0.0.0.0";
const BASE_URL = `http://localhost:${PORT}`;

// Note: Agent initialization moved to main() to support async MCP setup

// ============================================================================
// A2A Protocol Integration
// ============================================================================

// Note: agentExecutor initialization moved to main() to support async MCP setup

// ============================================================================
// Agent Card Configuration
// ============================================================================

const accommodationSearchSkill: AgentSkill = {
  id: "accommodation_search",
  name: "Accommodation Search",
  description: "Searches for Airbnb accommodations in various locations",
  tags: ["airbnb", "accommodation", "hotel", "booking", "travel"],
  examples: [
    "Find a room in Los Angeles for June 20-25, 2025, two adults",
    "Search for accommodations in Paris for 4 people",
    "Show me Airbnb listings in Tokyo",
  ],
};

const airbnbAgentCard: AgentCard = {
  name: "Airbnb Agent",
  description: "Specialized assistant for Airbnb accommodation search",
  url: `${BASE_URL}/.well-known/agent-card.json`,
  protocolVersion: "0.3.0",
  version: "1.0.0",
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
  capabilities: {
    streaming: true,
    pushNotifications: false,
    stateTransitionHistory: true,
  },
  skills: [accommodationSearchSkill],
};

// ============================================================================
// HTTP Server (Hono + A2A)
// ============================================================================

async function main() {
  // Setup MCP shutdown handlers for graceful cleanup
  setupMCPShutdownHandlers();

  console.log("🚀 Initializing Airbnb Agent with MCP tools...\n");

  // Initialize MCP client and get real Airbnb tools
  const mcpTools = await getAirbnbMCPTools();

  // Create agent with MCP tools
  const model = getModel();
  const agent = createAirbnbAgent(model, mcpTools);

  // Create A2A adapter
  const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
    workingMessage: "Searching for accommodations...",
    debug: false,
  });

  const taskStore: TaskStore = new InMemoryTaskStore();

  const requestHandler = new DefaultRequestHandler(
    airbnbAgentCard,
    taskStore,
    agentExecutor
  );

  const app = new Hono();
  const appBuilder = new A2AHonoApp(requestHandler);
  appBuilder.setupRoutes(app);

  console.log(`
🏠 Airbnb Agent - A2A Server Starting...

📍 Port: ${PORT}
🌐 URL: ${BASE_URL}
📋 Agent Card: ${BASE_URL}/.well-known/agent-card.json

🤖 Agent: Airbnb Agent (Specialist)
🔧 Framework: AI SDK v6 + Hono + A2A Protocol
🧠 Model: ${process.env.AI_PROVIDER || "openai"} / ${process.env.AI_MODEL || "default"}

✨ This agent is a SPECIALIST agent:
   - Searches for Airbnb accommodations
   - Filters by location, dates, and guests
   - Provides detailed listing information
   - Can be consumed by orchestrator agents

🏨 Accommodation Features:
   - REAL Airbnb search via MCP (@openbnb/mcp-server-airbnb)
   - Search by location and dates
   - Filter by guest capacity
   - Detailed listings with prices and amenities
   - Direct booking links
   - ✨ PRODUCTION-READY with real data!

📝 Try it standalone:
   curl -X POST ${BASE_URL}/message/send \\
     -H "Content-Type: application/json" \\
     -d '{"message": {"role": "user", "parts": [{"kind": "text", "text": "Find a room in Los Angeles for 2 people"}]}}'

🔗 Multi-Agent Usage:
   This agent can be consumed by an orchestrator using a2a-ai-provider:
   
   import { a2a } from "a2a-ai-provider";
   import { generateText } from "ai";
   
   const result = await generateText({
     model: a2a('${BASE_URL}/.well-known/agent-card.json'),
     prompt: 'Find accommodations in Paris for 4 people, June 20-25',
   });

🚀 Ready to search for accommodations...
`);

  serve({
    fetch: app.fetch,
    port: PORT,
    hostname: HOST,
  });
}

main().catch(console.error);
