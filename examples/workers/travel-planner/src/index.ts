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
 */

import { createOpenAI } from "@ai-sdk/openai";
import { A2AAdapter } from "@drew-foxall/a2a-ai-sdk-adapter";
import {
  DefaultRequestHandler,
  InMemoryTaskStore,
  type TaskStore,
} from "@drew-foxall/a2a-js-sdk/server";
import { A2AHonoApp, ConsoleLogger, type Logger } from "@drew-foxall/a2a-js-sdk/server/hono";
import { UpstashRedisTaskStore } from "@drew-foxall/a2a-js-taskstore-upstash-redis";
import { Redis } from "@upstash/redis";
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
// Task Store Configuration
// ============================================================================

// Module-level logger for use outside request handlers
const moduleLogger: Logger = ConsoleLogger.create();

/**
 * Create the appropriate task store based on environment configuration.
 *
 * Uses Redis if UPSTASH_REDIS_REST_URL is configured, otherwise falls back
 * to InMemoryTaskStore for local development.
 *
 * Redis provides:
 * - Persistent task state across worker restarts
 * - Multi-agent coordination state
 * - Task history for observability
 */
function createTaskStore(env: PlannerEnv): TaskStore {
  // Use Redis if configured
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    const redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });

    return new UpstashRedisTaskStore({
      client: redis,
      prefix: "a2a:travel:",
      ttlSeconds: 86400 * 7, // 7 days
    });
  }

  // Fall back to in-memory for local development
  moduleLogger.warn(
    "Redis not configured - using InMemoryTaskStore. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for persistence."
  );
  return new InMemoryTaskStore();
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
    includeHistory: true, // Enable conversation history for multi-turn context
  });

  // Create A2A request handler with shared Agent Card
  const requestUrl = new URL(c.req.url);
  const agentCard = createTravelPlannerCard(`${requestUrl.protocol}//${requestUrl.host}`);
  const taskStore = createTaskStore(env);
  const requestHandler = new DefaultRequestHandler(agentCard, taskStore, agentExecutor);

  // Build A2A Hono routes with native logger
  const logger: Logger = ConsoleLogger.create();
  const a2aApp = new A2AHonoApp(requestHandler, { logger });
  const subApp = new Hono();
  a2aApp.setupRoutes(subApp);

  // Forward request to A2A sub-app
  return subApp.fetch(c.req.raw, c.env);
});

// ============================================================================
// Worker Export
// ============================================================================

export default app;
