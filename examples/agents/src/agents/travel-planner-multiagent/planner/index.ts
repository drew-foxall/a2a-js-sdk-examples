/**
 * Travel Planner - Multi-Agent Orchestrator
 *
 * This is the orchestrator that coordinates Weather and Airbnb agents.
 * It demonstrates multi-agent orchestration using a2a-ai-provider within tools.
 *
 * Port: 41254
 *
 * Usage:
 *   1. Start Weather Agent (port 41252)
 *   2. Start Airbnb Agent (port 41253)
 *   3. Start this orchestrator (port 41254)
 *
 *   pnpm agent:planner
 */

import { A2AAdapter } from "@drew-foxall/a2a-ai-sdk-adapter";
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
import { loadEnv } from "../../../shared/load-env.js";
import { getModel } from "../../../shared/utils.js";
import { createPlannerAgent } from "./agent.js";

// Load environment variables
loadEnv(import.meta.url);

// ============================================================================
// Configuration
// ============================================================================

const PORT = 41254;
const HOST = "0.0.0.0";
const BASE_URL = `http://localhost:${PORT}`;

// Specialist agent URLs
const WEATHER_AGENT_URL = "http://localhost:41252/.well-known/agent-card.json";
const AIRBNB_AGENT_URL = "http://localhost:41253/.well-known/agent-card.json";

// ============================================================================
// Agent Creation (Standard Pattern - ToolLoopAgent)
// ============================================================================

const plannerAgent = createPlannerAgent({
  model: getModel(),
  weatherAgentUrl: WEATHER_AGENT_URL,
  airbnbAgentUrl: AIRBNB_AGENT_URL,
});

// ============================================================================
// A2A Adapter (Standard Pattern)
// ============================================================================

const agentExecutor: AgentExecutor = new A2AAdapter(plannerAgent, {
  mode: "stream",
  workingMessage: "Planning your trip...",
  debug: false,
});

// ============================================================================
// Agent Card Configuration
// ============================================================================

const travelPlanningSkill: AgentSkill = {
  id: "travel_planning",
  name: "Travel Planning",
  description:
    "Comprehensive travel planning by coordinating weather forecasts and accommodation searches",
  tags: ["travel", "planning", "orchestration", "multi-agent", "weather", "accommodations"],
  examples: [
    "Plan a trip to Paris for 2 people",
    "What's the weather in Los Angeles and find hotels",
    "I need accommodations in Tokyo and the weather forecast",
    "Plan a trip to New York, June 20-25, 2 adults",
  ],
};

const travelPlannerCard: AgentCard = {
  name: "Travel Planner",
  description:
    "Multi-agent orchestrator that coordinates weather and accommodation searches for comprehensive travel planning",
  url: BASE_URL,
  protocolVersion: "0.3.0",
  preferredTransport: "JSONRPC",
  preferred_transport: "JSONRPC", // Python compatibility (snake_case)
  version: "1.0.0",
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
  capabilities: {
    streaming: true, // Streams responses from specialist agents in real-time
    pushNotifications: false,
    stateTransitionHistory: true,
  },
  skills: [travelPlanningSkill],
} as AgentCard;

// ============================================================================
// HTTP Server (Hono + A2A)
// ============================================================================

async function main() {
  const taskStore: TaskStore = new InMemoryTaskStore();
  const requestHandler = new DefaultRequestHandler(travelPlannerCard, taskStore, agentExecutor);

  const app = new Hono();
  const appBuilder = new A2AHonoApp(requestHandler);
  appBuilder.setupRoutes(app);

  console.log(`
🎭 Travel Planner Orchestrator - A2A Server Starting...

📍 Port: ${PORT}
🌐 URL: ${BASE_URL}
📋 Agent Card: ${BASE_URL}/.well-known/agent-card.json

🤖 Agent: Travel Planner (Orchestrator)
🔧 Framework: AI SDK v6 (ToolLoopAgent) + a2a-ai-provider + A2A Protocol
🧠 Model: ${process.env.AI_PROVIDER || "openai"} / ${process.env.AI_MODEL || "default"}
🌊 Streaming: ENABLED (real-time responses from specialist agents)

✨ This is a STREAMING MULTI-AGENT ORCHESTRATOR:
   - Uses ToolLoopAgent (just like other agents!)
   - Tools delegate to specialist A2A agents via a2a()
   - Coordinates Weather Agent (port 41252) with real-time streaming
   - Coordinates Airbnb Agent (port 41253) with real-time streaming

🎯 Multi-Agent Architecture:
   
   User Request
        ↓
   Travel Planner (ToolLoopAgent) ⚡ STREAMING
        ├─→ getWeatherForecast tool → a2a(Weather Agent) → ⚡ Streams back
        └─→ searchAccommodations tool → a2a(Airbnb Agent) → ⚡ Streams back

🔑 Key Pattern (a2a-ai-provider within tools):
   
   import { a2a } from "a2a-ai-provider";
   import { tool, generateText } from "ai";
   
   const myTool = tool({
     execute: async ({ location }) => {
       const result = await generateText({
         model: a2a('http://localhost:41252/.well-known/agent-card.json'),
         prompt: \`Weather in \${location}\`,
       });
       return result.text;
     }
   });

📝 Try it (A2A Protocol - Streaming):
   curl -X POST ${BASE_URL}/message/send \\
     -H "Content-Type: application/json" \\
     -d '{"message": {"role": "user", "parts": [{"kind": "text", "text": "Plan a trip to Los Angeles"}]}}'

💡 Examples (watch them stream!):
   - "What's the weather in Paris?"
   - "Find accommodations in Tokyo for 3 people"
   - "Plan a trip to New York, June 20-25, 2 adults"
   - "Weather and hotels in Los Angeles"

⚠️  Prerequisites:
   Make sure the specialist agents are running:
   1. Weather Agent: ${WEATHER_AGENT_URL}
   2. Airbnb Agent: ${AIRBNB_AGENT_URL}

🔗 Inspector Compatible:
   Now with real-time streaming! See responses arrive as agents work!

🚀 Ready to orchestrate travel planning with streaming...
`);

  serve({
    fetch: app.fetch,
    port: PORT,
    hostname: HOST,
  });
}

main().catch(console.error);
