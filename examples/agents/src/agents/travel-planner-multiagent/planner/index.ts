/**
 * Travel Planner - Multi-Agent Orchestrator
 *
 * This is the orchestrator that coordinates Weather and Airbnb agents.
 * It demonstrates multi-agent orchestration using a2a-ai-provider.
 *
 * Port: 41252 (by default)
 *
 * Usage:
 *   1. Start Weather Agent (port 41250)
 *   2. Start Airbnb Agent (port 41251)
 *   3. Start this orchestrator (port 41252)
 *
 *   pnpm agents:travel-planner
 *   # or
 *   cd samples/js
 *   pnpm tsx src/agents/travel-planner-multiagent/planner/index.ts
 */

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { getModel } from "../../../shared/utils";
import { TravelPlannerOrchestrator } from "./orchestrator";

// ============================================================================
// Configuration
// ============================================================================

const PORT = 41252;
const HOST = "0.0.0.0";
const BASE_URL = `http://localhost:${PORT}`;

// Specialist agent URLs
const WEATHER_AGENT_URL = "http://localhost:41250/.well-known/agent-card.json";
const AIRBNB_AGENT_URL = "http://localhost:41251/.well-known/agent-card.json";

// ============================================================================
// Orchestrator Initialization
// ============================================================================

const orchestrator = new TravelPlannerOrchestrator({
  model: getModel(), // Primary LLM for orchestration logic
  weatherAgent: {
    name: "Weather Agent",
    agentCardUrl: WEATHER_AGENT_URL,
    description: "Provides weather forecasts",
  },
  airbnbAgent: {
    name: "Airbnb Agent",
    agentCardUrl: AIRBNB_AGENT_URL,
    description: "Searches for accommodations",
  },
  logger: console,
});

// ============================================================================
// HTTP Server (Simple Hono API)
// ============================================================================

const app = new Hono();

// Health check
app.get("/", (c) => {
  return c.json({
    name: "Travel Planner Orchestrator",
    version: "1.0.0",
    status: "running",
    specialists: orchestrator.getAvailableAgents(),
  });
});

// Process travel planning request
app.post("/plan", async (c) => {
  try {
    const body = await c.req.json();
    const query = body.query || body.message || "";

    if (!query) {
      return c.json({ error: "Missing query or message in request body" }, 400);
    }

    console.log(`\n📝 Received request: "${query}"`);
    const response = await orchestrator.processRequest(query);
    console.log("✅ Response generated\n");

    return c.json({ query, response });
  } catch (error) {
    console.error("Error processing request:", error);
    return c.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

// ============================================================================
// Start Server
// ============================================================================

console.log(`
🎭 Travel Planner Orchestrator - Starting...

📍 Port: ${PORT}
🌐 URL: ${BASE_URL}

🤖 Orchestrator: Travel Planner
🔧 Framework: AI SDK v6 + a2a-ai-provider
🧠 Model: ${process.env.AI_PROVIDER || "openai"} / ${process.env.AI_MODEL || "default"}

✨ This is a MULTI-AGENT ORCHESTRATOR:
   - Coordinates Weather Agent (port 41250)
   - Coordinates Airbnb Agent (port 41251)
   - Delegates tasks using a2a-ai-provider
   - Synthesizes responses from multiple agents

🎯 Multi-Agent Architecture:
   
   User Request
        ↓
   Travel Planner (Orchestrator)
        ├─→ Weather Agent (Specialist)
        └─→ Airbnb Agent (Specialist)

🔑 Key Pattern (a2a-ai-provider):
   
   import { a2a } from "a2a-ai-provider";
   import { generateText } from "ai";
   
   const result = await generateText({
     model: a2a('${WEATHER_AGENT_URL}'),
     prompt: 'What is the weather in Paris?',
   });

📝 Try it:
   curl -X POST ${BASE_URL}/plan \\
     -H "Content-Type: application/json" \\
     -d '{"query": "Plan a trip to Los Angeles for 2 people"}'

💡 Examples:
   - "What's the weather in Paris?"
   - "Find accommodations in Tokyo for 3 people"
   - "Plan a trip to New York, June 20-25, 2 adults"
   - "Weather and hotels in Los Angeles"

⚠️  Prerequisites:
   Make sure the specialist agents are running:
   1. Weather Agent: ${WEATHER_AGENT_URL}
   2. Airbnb Agent: ${AIRBNB_AGENT_URL}

🚀 Ready to orchestrate travel planning...
`);

serve({
  fetch: app.fetch,
  port: PORT,
  hostname: HOST,
});
