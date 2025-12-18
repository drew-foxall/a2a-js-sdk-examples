/**
 * Travel Planner (Durable) - Cloudflare Worker
 *
 * A durable version of the Travel Planner orchestrator that demonstrates:
 * - Upstash Redis for persistent task storage across restarts
 * - Workflow DevKit integration for durable multi-agent coordination
 * - Full A2A protocol compliance with streaming support
 *
 * Particularly valuable for travel planning because:
 * - Multi-agent coordination involves multiple external calls
 * - Each sub-agent call (weather, accommodation) can fail transiently
 * - Complex travel plans shouldn't restart from scratch on failure
 *
 * Features:
 * - Persistent task storage via Upstash Redis ✅
 * - Durable workflow execution via @drew-foxall/workflow-ai ✅
 * - Automatic retry on sub-agent failures
 * - Result caching across restarts
 * - Multi-agent discovery and coordination
 *
 * This worker uses the DURABLE workflow (travelPlannerWorkflow) which provides:
 * - DurableAgent from @drew-foxall/workflow-ai/agent for AI SDK integration
 * - "use workflow" directive for workflow-level durability
 * - "use step" directives on sub-agent calls for step-level caching
 * - Automatic retry on transient sub-agent failures
 *
 * Deployment:
 *   wrangler deploy
 *
 * Local Development:
 *   wrangler dev
 */

import { DurableA2AAdapter } from "@drew-foxall/a2a-ai-sdk-adapter/durable";
import type { AgentCard, AgentSkill } from "@drew-foxall/a2a-js-sdk";
import {
  type AgentExecutor,
  DefaultRequestHandler,
  InMemoryTaskStore,
  type TaskStore,
} from "@drew-foxall/a2a-js-sdk/server";
import { A2AHonoApp, ConsoleLogger, type Logger } from "@drew-foxall/a2a-js-sdk/server/hono";
import { createWorld } from "@drew-foxall/upstash-workflow-world";
// Import the DURABLE workflow from the shared agents package
import {
  travelPlannerWorkflow,
  type TravelPlannerWorkflowConfig,
} from "a2a-agents/agents/travel-planner-multiagent/planner";
import { createRedisClient, createRedisTaskStore, type RedisEnv } from "a2a-workers-shared";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { HonoEnv } from "../../shared/types.js";
import { getModelInfo } from "../../shared/utils.js";

// ============================================================================
// Environment Types
// ============================================================================

interface DurablePlannerEnv extends HonoEnv {
  Bindings: HonoEnv["Bindings"] &
    RedisEnv & {
      // Sub-agent URLs
      WEATHER_AGENT_URL?: string;
      AIRBNB_AGENT_URL?: string;

      // Service Bindings (optional, for production)
      WEATHER_AGENT?: Fetcher;
      AIRBNB_AGENT?: Fetcher;

      // Workflow DevKit
      WORKFLOW_UPSTASH_REDIS_REST_URL?: string;
      WORKFLOW_UPSTASH_REDIS_REST_TOKEN?: string;
    };
}

// ============================================================================
// Agent Card Configuration
// ============================================================================

const weatherSkill: AgentSkill = {
  id: "weather_coordination",
  name: "Weather Coordination",
  description: "Coordinates with weather agents for destination weather forecasts",
  tags: ["weather", "forecast", "travel"],
  examples: ["What's the weather in Paris next week?"],
};

const accommodationSkill: AgentSkill = {
  id: "accommodation_coordination",
  name: "Accommodation Coordination",
  description: "Coordinates with accommodation agents to find places to stay",
  tags: ["accommodation", "airbnb", "lodging", "travel"],
  examples: ["Find places to stay in Tokyo for 3 nights"],
};

const planningSkill: AgentSkill = {
  id: "travel_planning_durable",
  name: "Durable Travel Planning",
  description:
    "Creates comprehensive travel plans with automatic retry and fault tolerance. Coordinates multiple agents for weather, accommodation, and activities.",
  tags: ["travel", "planning", "durable", "orchestration"],
  examples: ["Plan a week-long trip to Barcelona with weather forecast and accommodation"],
};

function createAgentCard(baseUrl: string): AgentCard {
  return {
    name: "Travel Planner (Durable)",
    description:
      "A durable multi-agent travel planner that coordinates weather and accommodation agents. Uses DurableAgent from @drew-foxall/workflow-ai for workflow-level durability. Features automatic retry on failures and persistent state across restarts.",
    url: baseUrl,
    protocolVersion: "0.3.0",
    version: "1.0.0",
    defaultInputModes: ["text"],
    defaultOutputModes: ["text"],
    preferredTransport: "JSONRPC",
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: true, // Enabled due to persistent storage
    },
    skills: [planningSkill, weatherSkill, accommodationSkill],
  };
}

// ============================================================================
// Task Store Configuration
// ============================================================================

const logger: Logger = ConsoleLogger.create();

function getTaskStore(env: DurablePlannerEnv["Bindings"]): TaskStore {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    const redis = createRedisClient(env);
    return createRedisTaskStore(redis, {
      prefix: "a2a:travel-durable:",
      ttlSeconds: 86400 * 7, // 7 days
    });
  }

  logger.warn("Redis credentials not found, using in-memory task store");
  return new InMemoryTaskStore();
}

// ============================================================================
// Workflow DevKit Configuration
// ============================================================================

function getWorkflowWorld(env: DurablePlannerEnv["Bindings"]) {
  const redisUrl = env.WORKFLOW_UPSTASH_REDIS_REST_URL ?? env.UPSTASH_REDIS_REST_URL;
  const redisToken = env.WORKFLOW_UPSTASH_REDIS_REST_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    return null;
  }

  return createWorld({
    redisUrl,
    redisToken,
    keyPrefix: "travel-planner-workflow",
  });
}

// ============================================================================
// Hono App Setup
// ============================================================================

const app = new Hono<DurablePlannerEnv>();

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
  const modelInfo = getModelInfo(c.env);
  const hasRedis = !!(c.env.UPSTASH_REDIS_REST_URL && c.env.UPSTASH_REDIS_REST_TOKEN);
  const hasWorkflowWorld = !!(
    c.env.WORKFLOW_UPSTASH_REDIS_REST_URL ?? c.env.UPSTASH_REDIS_REST_URL
  );

  return c.json({
    status: "healthy",
    agent: "Travel Planner (Durable)",
    provider: modelInfo.provider,
    model: modelInfo.model,
    runtime: "Cloudflare Workers",
    features: {
      // Now truly using durable workflow!
      durableWorkflow: true,
      workflowWorldConfigured: hasWorkflowWorld,
      persistentStorage: hasRedis,
      storageType: hasRedis ? "upstash-redis" : "in-memory",
      multiAgentCoordination: true,
    },
    subAgents: {
      weather: c.env.WEATHER_AGENT_URL ?? "(Service Binding)",
      airbnb: c.env.AIRBNB_AGENT_URL ?? "(Service Binding)",
    },
  });
});

// ============================================================================
// Workflow DevKit Routes
// ============================================================================

app.post("/.well-known/workflow/v1/step", async (c) => {
  const world = getWorkflowWorld(c.env);
  if (!world) {
    return c.json({ error: "Workflow World not configured" }, 503);
  }

  const handler = world.createQueueHandler("__wkf_step_", async (message, meta) => {
    logger.debug("Processing workflow step", { messageId: meta.messageId });
  });

  return handler(c.req.raw);
});

app.post("/.well-known/workflow/v1/flow", async (c) => {
  const world = getWorkflowWorld(c.env);
  if (!world) {
    return c.json({ error: "Workflow World not configured" }, 503);
  }

  const handler = world.createQueueHandler("__wkf_workflow_", async (message, meta) => {
    logger.debug("Processing workflow", { messageId: meta.messageId });
  });

  return handler(c.req.raw);
});

// ============================================================================
// A2A Protocol Routes
// ============================================================================

app.all("/*", async (c, next) => {
  const env = c.env;
  const url = new URL(c.req.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  const agentCard = createAgentCard(baseUrl);

  // Build workflow configuration with sub-agent URLs
  const weatherUrl = env.WEATHER_AGENT_URL ?? "http://localhost:41252";
  const airbnbUrl = env.AIRBNB_AGENT_URL ?? "http://localhost:41253";

  const workflowConfig: TravelPlannerWorkflowConfig = {
    agentUrls: [weatherUrl, airbnbUrl],
    fallbacks: {
      [weatherUrl]: { name: "Weather Agent", description: "Provides weather forecasts" },
      [airbnbUrl]: { name: "Airbnb Agent", description: "Finds accommodation listings" },
    },
  };

  // Use the DURABLE workflow via DurableA2AAdapter
  // The workflow uses DurableAgent from @drew-foxall/workflow-ai/agent internally
  // This provides:
  // - Automatic retry on sub-agent failures (via "use step" directives)
  // - Result caching across restarts
  // - Observability via Workflow DevKit traces
  const agentExecutor: AgentExecutor = new DurableA2AAdapter<[TravelPlannerWorkflowConfig]>(
    travelPlannerWorkflow,
    {
      workflowArgs: [workflowConfig],
      workingMessage: "Planning your trip (with durability)...",
      includeHistory: true,
      debug: false,
    }
  );

  const taskStore = getTaskStore(env);
  const requestHandler = new DefaultRequestHandler(agentCard, taskStore, agentExecutor);

  const a2aRouter = new Hono();
  const appBuilder = new A2AHonoApp(requestHandler, { logger });
  appBuilder.setupRoutes(a2aRouter);

  const a2aResponse = await a2aRouter.fetch(c.req.raw, c.env);
  if (a2aResponse.status !== 404) {
    return a2aResponse;
  }

  return next();
});

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      error: "Not Found",
      message: "Use /.well-known/agent-card.json to discover this agent",
      endpoints: {
        agentCard: "/.well-known/agent-card.json",
        sendMessage: "/message/send",
        health: "/health",
      },
    },
    404
  );
});

// ============================================================================
// Export for Cloudflare Workers
// ============================================================================

export default app;
