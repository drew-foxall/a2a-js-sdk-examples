/**
 * Image Generator (Durable) - Cloudflare Worker
 *
 * A durable version of the Image Generator agent that demonstrates:
 * - Upstash Redis for persistent task storage across restarts
 * - Workflow DevKit integration for durable workflow execution
 * - Full A2A protocol compliance with streaming support
 *
 * Particularly valuable for image generation because:
 * - DALL-E calls take 10-30 seconds
 * - API calls cost money (avoid duplicate calls on failure)
 * - Transient failures should be automatically retried
 *
 * Features:
 * - Persistent task storage via Upstash Redis ✅
 * - Durable workflow execution via @drew-foxall/upstash-workflow-world ✅
 * - Automatic retry on DALL-E API failures
 * - Result caching across restarts
 *
 * Deployment:
 *   wrangler deploy
 *
 * Local Development:
 *   wrangler dev
 */

import { A2AAdapter } from "@drew-foxall/a2a-ai-sdk-adapter";
import type { AgentCard, AgentSkill } from "@drew-foxall/a2a-js-sdk";
import {
  type AgentExecutor,
  DefaultRequestHandler,
  InMemoryTaskStore,
  type TaskStore,
} from "@drew-foxall/a2a-js-sdk/server";
import { A2AHonoApp, ConsoleLogger, type Logger } from "@drew-foxall/a2a-js-sdk/server/hono";
import { createWorld } from "@drew-foxall/upstash-workflow-world";
import { createImageGeneratorAgent } from "a2a-agents";
import { createRedisClient, createRedisTaskStore, type RedisEnv } from "a2a-workers-shared";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { HonoEnv } from "../../shared/types.js";
import { getModel, getModelInfo } from "../../shared/utils.js";

// ============================================================================
// Environment Types
// ============================================================================

interface DurableImageGenEnv extends HonoEnv {
  Bindings: HonoEnv["Bindings"] &
    RedisEnv & {
      // OpenAI API key for DALL-E
      OPENAI_API_KEY: string;
      // Workflow DevKit uses these env var names
      WORKFLOW_UPSTASH_REDIS_REST_URL?: string;
      WORKFLOW_UPSTASH_REDIS_REST_TOKEN?: string;
      WORKFLOW_SERVICE_URL?: string;
    };
}

// ============================================================================
// Agent Card Configuration
// ============================================================================

const imageGenerationSkill: AgentSkill = {
  id: "image_generation_durable",
  name: "Image Generation (Durable)",
  description:
    "Generates images from text descriptions using DALL-E 3 with automatic retry and result caching. Supports various sizes, quality levels, and styles.",
  tags: ["image", "generation", "dall-e", "creative", "art", "durable"],
  examples: [
    "Generate an image of a sunset over mountains",
    "Create a photorealistic image of a cat wearing a hat",
    "Make an HD image of a futuristic cityscape in vivid style",
    "Generate a natural-style portrait of a person reading",
  ],
};

function createAgentCard(baseUrl: string): AgentCard {
  return {
    name: "Image Generator (Durable)",
    description:
      "A durable version of the image generator with persistent task storage and automatic retry capabilities. Generates images using DALL-E 3 with multiple size, quality, and style options.",
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
    skills: [imageGenerationSkill],
  };
}

// ============================================================================
// Task Store Factory
// ============================================================================

const logger: Logger = ConsoleLogger.create();

/**
 * Creates a task store based on environment configuration.
 * Uses Upstash Redis if credentials are available, otherwise falls back to in-memory.
 */
function getTaskStore(env: DurableImageGenEnv["Bindings"]): TaskStore {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    const redis = createRedisClient(env);
    return createRedisTaskStore(redis, {
      prefix: "a2a:image-durable:",
      ttlSeconds: 86400 * 7, // 7 days - images may be referenced later
    });
  }

  logger.warn("Redis credentials not found, using in-memory task store");
  return new InMemoryTaskStore();
}

// ============================================================================
// Workflow DevKit Configuration
// ============================================================================

/**
 * Creates a lazy-initialized Workflow World.
 * Only created when workflow routes are accessed.
 */
function getWorkflowWorld(env: DurableImageGenEnv["Bindings"]) {
  const redisUrl = env.WORKFLOW_UPSTASH_REDIS_REST_URL ?? env.UPSTASH_REDIS_REST_URL;
  const redisToken = env.WORKFLOW_UPSTASH_REDIS_REST_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    return null;
  }

  return createWorld({
    redisUrl,
    redisToken,
    keyPrefix: "image-generator-workflow",
  });
}

// ============================================================================
// Hono App Setup
// ============================================================================

const app = new Hono<DurableImageGenEnv>();

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
  const hasOpenAI = !!c.env.OPENAI_API_KEY;

  return c.json({
    status: hasOpenAI ? "healthy" : "degraded",
    agent: "Image Generator (Durable)",
    provider: modelInfo.provider,
    model: modelInfo.model,
    runtime: "Cloudflare Workers",
    features: {
      durableWorkflow: hasWorkflowWorld,
      persistentStorage: hasRedis,
      storageType: hasRedis ? "upstash-redis" : "in-memory",
      dalleAccess: hasOpenAI,
    },
  });
});

// ============================================================================
// Workflow DevKit Routes (for durable execution)
// ============================================================================

// Workflow DevKit step handler
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

// Workflow DevKit flow handler
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
  const url = new URL(c.req.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  const agentCard = createAgentCard(baseUrl);

  // Create agent - pass OPENAI_API_KEY for DALL-E access
  const model = getModel(c.env);
  const agent = createImageGeneratorAgent(model, c.env.OPENAI_API_KEY);

  const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
    mode: "stream",
    workingMessage: "Generating image (with durability)...",
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

