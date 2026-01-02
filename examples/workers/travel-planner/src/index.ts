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
 * - Task Store: Redis for persistent multi-agent coordination
 *
 * NOTE: Uses custom implementation due to dynamic agent registry
 * and multi-agent coordination requirements.
 */

import { A2AAdapter } from "@drew-foxall/a2a-ai-sdk-adapter";
import { DefaultRequestHandler } from "@drew-foxall/a2a-js-sdk/server";
import { A2AHonoApp, ConsoleLogger, type Logger } from "@drew-foxall/a2a-js-sdk/server/hono";
import { createPlannerAgent, createTravelPlannerCard } from "a2a-agents";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  createTaskStore,
  getModel,
  getModelInfo,
  isRedisConfigured,
} from "a2a-workers-shared";
import { createWorkerSendMessage } from "./communication.js";
import { buildWorkerAgentRegistry } from "./registry.js";
import type { PlannerEnv } from "./types.js";

// ============================================================================
// Hono Application
// ============================================================================

const app = new Hono<{ Bindings: PlannerEnv }>();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

app.get("/health", (c) => {
  const modelInfo = getModelInfo(c.env);
  return c.json({
    status: "healthy",
    agent: "Travel Planner",
    provider: modelInfo.provider,
    model: modelInfo.model,
    runtime: "Cloudflare Workers",
    pattern: "Multi-Agent Orchestrator",
    features: {
      persistentStorage: isRedisConfigured(c.env),
      storageType: isRedisConfigured(c.env) ? "upstash-redis" : "in-memory",
    },
  });
});

app.all("/*", async (c) => {
  const env = c.env;

  // Build agent registry (discovers agents via Service Bindings or HTTP)
  const registry = await buildWorkerAgentRegistry(env);

  // Track active agent state for this request
  let activeAgent: string | null = null;

  // Create the planner agent with worker-specific sendMessage
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
    includeHistory: true,
  });

  // Create A2A request handler with shared Agent Card
  const requestUrl = new URL(c.req.url);
  const agentCard = createTravelPlannerCard(`${requestUrl.protocol}//${requestUrl.host}`);
  const taskStore = createTaskStore({ type: "redis", prefix: "a2a:travel:" }, env);
  const requestHandler = new DefaultRequestHandler(agentCard, taskStore, agentExecutor);

  // Build A2A Hono routes
  const logger: Logger = ConsoleLogger.create();
  const a2aApp = new A2AHonoApp(requestHandler, { logger });
  const subApp = new Hono();
  a2aApp.setupRoutes(subApp);

  return subApp.fetch(c.req.raw, c.env);
});

export default app;
