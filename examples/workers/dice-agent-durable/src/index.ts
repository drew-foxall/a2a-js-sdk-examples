/**
 * Dice Agent (Durable) - Cloudflare Worker
 *
 * A durable version of the Dice agent that demonstrates:
 * - Upstash Redis for persistent task storage across restarts
 * - Workflow DevKit integration for durable workflow execution
 * - Full A2A protocol compliance with streaming support
 *
 * Features:
 * - Persistent task storage via Upstash Redis ✅
 * - Durable workflow execution via @drew-foxall/upstash-workflow-world ✅
 * - Automatic retry on failures
 * - Result caching across restarts
 *
 * This worker uses the DURABLE workflow (diceAgentWorkflow) which provides:
 * - "use workflow" directive for workflow-level durability
 * - "use step" directives on tool calls for step-level caching
 * - Automatic retry on transient failures
 * - Result caching if workflow restarts
 *
 * Deployment:
 *   wrangler deploy
 *
 * Local Development:
 *   wrangler dev
 */

import { DurableA2AAdapter } from "@drew-foxall/a2a-ai-sdk-adapter";
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
import { diceAgentWorkflow } from "a2a-agents/agents/dice-agent";
import { createRedisClient, createRedisTaskStore, type RedisEnv } from "a2a-workers-shared";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { HonoEnv } from "../../shared/types.js";
import { getModelInfo } from "../../shared/utils.js";

// ============================================================================
// Environment Types
// ============================================================================

interface DurableDiceEnv extends HonoEnv {
  Bindings: HonoEnv["Bindings"] &
    RedisEnv & {
      // Workflow DevKit uses these env var names
      WORKFLOW_UPSTASH_REDIS_REST_URL?: string;
      WORKFLOW_UPSTASH_REDIS_REST_TOKEN?: string;
      WORKFLOW_SERVICE_URL?: string;
    };
}

// ============================================================================
// Agent Card Configuration
// ============================================================================

const rollDiceSkill: AgentSkill = {
  id: "f56cab88-3fe9-47ec-ba6e-86a13c9f1f74",
  name: "Roll Dice",
  description: "Rolls an N-sided dice and returns the result. By default uses a 6-sided dice.",
  tags: ["dice", "random", "game", "durable"],
  examples: ["Can you roll an 11-sided dice?", "Roll a 20-sided die", "Roll 2d6"],
};

const checkPrimeSkill: AgentSkill = {
  id: "33856129-d686-4a54-9c6e-fffffec3561b",
  name: "Prime Detector",
  description: "Determines which numbers from a list are prime numbers.",
  tags: ["prime", "math", "numbers", "durable"],
  examples: [
    "Which of these are prime numbers: 1, 4, 6, 7",
    "Is 17 a prime number?",
    "Check if 2, 3, 5, 7 are prime",
  ],
};

function createAgentCard(baseUrl: string): AgentCard {
  return {
    name: "Dice Agent (Durable)",
    description:
      "A durable version of the dice agent with persistent task storage and automatic retry capabilities. Uses Workflow DevKit for workflow-level durability. Can roll arbitrary dice and check if numbers are prime.",
    url: baseUrl,
    version: "1.0.0",
    protocolVersion: "0.3.0",
    preferredTransport: "JSONRPC",
    defaultInputModes: ["text"],
    defaultOutputModes: ["text"],
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: true, // Enabled due to persistent storage
    },
    skills: [rollDiceSkill, checkPrimeSkill],
  };
}

// ============================================================================
// Task Store Factory
// ============================================================================

// Create a module-level logger for use outside request handlers
const logger: Logger = ConsoleLogger.create();

/**
 * Creates a task store based on environment configuration.
 * Uses Upstash Redis if credentials are available, otherwise falls back to in-memory.
 */
function getTaskStore(env: DurableDiceEnv["Bindings"]): TaskStore {
  // Check if Redis credentials are available
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    const redis = createRedisClient(env);
    return createRedisTaskStore(redis, {
      prefix: "dice-agent-durable",
      ttlSeconds: 86400, // 24 hours
    });
  }

  // Fallback to in-memory for local development without Redis
  logger.warn("Redis credentials not found, using in-memory task store");
  return new InMemoryTaskStore();
}

// ============================================================================
// Hono App Setup
// ============================================================================

const app = new Hono<DurableDiceEnv>();

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
  const hasRedis = !!(c.env.UPSTASH_REDIS_REST_URL && c.env.UPSTASH_REDIS_REST_TOKEN);
  const hasWorkflowWorld = !!(
    c.env.WORKFLOW_UPSTASH_REDIS_REST_URL && c.env.WORKFLOW_UPSTASH_REDIS_REST_TOKEN
  );

  return c.json({
    status: "healthy",
    agent: "Dice Agent (Durable)",
    provider: modelInfo.provider,
    model: modelInfo.model,
    runtime: "Cloudflare Workers",
    features: {
      // Now truly using durable workflow!
      durableWorkflow: true,
      workflowWorldConfigured: hasWorkflowWorld,
      persistentStorage: hasRedis,
      storageType: hasRedis ? "upstash-redis" : "in-memory",
    },
  });
});

// ============================================================================
// Workflow DevKit Routes (for durable execution)
// ============================================================================

/**
 * Creates a lazy-initialized Workflow World.
 * Only created when workflow routes are accessed.
 */
function getWorkflowWorld(env: DurableDiceEnv["Bindings"]) {
  // Use WORKFLOW_ prefixed env vars, falling back to standard UPSTASH_ vars
  const redisUrl = env.WORKFLOW_UPSTASH_REDIS_REST_URL ?? env.UPSTASH_REDIS_REST_URL;
  const redisToken = env.WORKFLOW_UPSTASH_REDIS_REST_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    return null;
  }

  return createWorld({
    redisUrl,
    redisToken,
    keyPrefix: "dice-agent-workflow",
  });
}

// Workflow DevKit step handler
app.post("/.well-known/workflow/v1/step", async (c) => {
  const world = getWorkflowWorld(c.env);
  if (!world) {
    return c.json({ error: "Workflow World not configured" }, 503);
  }

  const handler = world.createQueueHandler("__wkf_step_", async (message, meta) => {
    // The workflow runtime handles step execution
    logger.debug("Processing workflow step", { messageId: meta.messageId });
  });

  return handler(c.req.raw);
});

// Workflow DevKit flow handler
app.post("/.well-known/workflow/v1/flow", async (c) => {
  const world = getWorkflowWorld(c.env);
  if (!world) {
    return c.json({ error: "Workflow World not configured" }, 503);
  }

  const handler = world.createQueueHandler("__wkf_workflow_", async (message, meta) => {
    // The workflow runtime handles workflow execution
    logger.debug("Processing workflow", { messageId: meta.messageId });
  });

  return handler(c.req.raw);
});

// ============================================================================
// A2A Protocol Routes
// ============================================================================

app.all("/*", async (c, next) => {
  const url = new URL(c.req.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  const agentCard = createAgentCard(baseUrl);

  // Use the DURABLE workflow via DurableA2AAdapter
  // This provides:
  // - Automatic retry on failures (via "use step" directives)
  // - Result caching across restarts
  // - Observability via Workflow DevKit traces
  const agentExecutor: AgentExecutor = new DurableA2AAdapter(diceAgentWorkflow, {
    workingMessage: "Rolling dice (with durability)...",
    debug: false,
  });

  // Use persistent task store
  const taskStore = getTaskStore(c.env);
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
