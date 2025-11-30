/**
 * Travel Planner - Cloudflare Worker
 *
 * Multi-agent orchestrator deployed as a Cloudflare Worker.
 * Coordinates Weather and Airbnb agents using the Python airbnb_planner_multiagent pattern:
 * - Dynamic agent discovery via Service Bindings or HTTP
 * - Single sendMessage tool for routing to any agent
 * - Active agent state tracking for follow-ups
 *
 * Architecture:
 * - Agent logic: Imported from a2a-agents (platform-agnostic)
 * - Agent Card: Imported from a2a-agents (shared definition)
 * - Communication: Worker-specific (Service Bindings + HTTP fallback)
 * - Discovery: Worker-specific (fetches Agent Cards via bindings or HTTP)
 */

import { createOpenAI } from "@ai-sdk/openai";
import { A2AAdapter } from "@drew-foxall/a2a-ai-sdk-adapter";
import { DefaultRequestHandler, InMemoryTaskStore } from "@drew-foxall/a2a-js-sdk/server";
import { A2AHonoApp } from "@drew-foxall/a2a-js-sdk/server/hono";
// Import shared agent logic and card from a2a-agents
import { createPlannerAgent, createTravelPlannerCard } from "a2a-agents";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createWorkerSendMessage } from "./communication.js";
import { buildWorkerAgentRegistry } from "./registry.js";
// Import worker-specific modules
import type { PlannerEnv } from "./types.js";

// ============================================================================
// Model Configuration
// ============================================================================

function getModel(env: PlannerEnv) {
  const openai = createOpenAI({
    apiKey: env.OPENAI_API_KEY,
  });

  const modelId = env.AI_MODEL || "gpt-4o-mini";
  return openai.chat(modelId);
}

// ============================================================================
// Hono Application
// ============================================================================

const app = new Hono<{ Bindings: PlannerEnv }>();

// CORS for browser-based clients
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

// Health check endpoint
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    agent: "Travel Planner",
    pattern: "Multi-Agent Orchestrator (Python airbnb_planner_multiagent)",
  });
});

// A2A Protocol routes
app.all("/*", async (c) => {
  const env = c.env;

  // Build agent registry (discovers agents via Service Bindings or HTTP)
  const registry = await buildWorkerAgentRegistry(env);

  // Track active agent state for this request
  let activeAgent: string | null = null;

  // Create the planner agent with worker-specific sendMessage
  // Agent logic is imported from a2a-agents (platform-agnostic)
  const plannerAgent = createPlannerAgent({
    model: getModel(env),
    agentRoster: registry.buildAgentRoster(),
    activeAgent,
    availableAgents: registry.getAgentNames(),
    sendMessage: createWorkerSendMessage(registry),
    onActiveAgentChange: (name) => {
      activeAgent = name;
    },
  });

  // Wrap with A2A adapter for protocol handling
  const agentExecutor = new A2AAdapter(plannerAgent, {
    mode: "stream",
    workingMessage: "Planning your trip...",
  });

  // Create A2A request handler with shared Agent Card
  const requestUrl = new URL(c.req.url);
  const agentCard = createTravelPlannerCard(`${requestUrl.protocol}//${requestUrl.host}`);
  const taskStore = new InMemoryTaskStore();
  const requestHandler = new DefaultRequestHandler(agentCard, taskStore, agentExecutor);

  // Build A2A Hono routes
  const a2aApp = new A2AHonoApp(requestHandler);
  const subApp = new Hono();
  a2aApp.setupRoutes(subApp);

  // Forward request to A2A sub-app
  return subApp.fetch(c.req.raw, c.env);
});

// ============================================================================
// Worker Export
// ============================================================================

export default app;
