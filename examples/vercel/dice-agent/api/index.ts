/**
 * Dice Agent - Vercel Edge Function
 *
 * Exposes the Dice agent via the A2A protocol on Vercel Edge.
 * Demonstrates platform portability: same agent logic, different runtime.
 *
 * KEY ARCHITECTURE:
 * - Agent logic is imported from the shared `a2a-agents` package (no duplication!)
 * - This file only handles Vercel-specific concerns (config, env)
 * - Same agent works on Cloudflare Workers, Local Node.js, and Vercel Edge
 *
 * Deployment:
 *   vercel deploy
 *
 * Local Development:
 *   vercel dev
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { A2AAdapter } from "@drew-foxall/a2a-ai-sdk-adapter";
import type { AgentCard, AgentSkill } from "@drew-foxall/a2a-js-sdk";
import {
  type AgentExecutor,
  DefaultRequestHandler,
  InMemoryTaskStore,
  type TaskStore,
} from "@drew-foxall/a2a-js-sdk/server";
import { A2AHonoApp, ConsoleLogger } from "@drew-foxall/a2a-js-sdk/server/hono";
import { UpstashRedisTaskStore } from "@drew-foxall/a2a-js-taskstore-upstash-redis";
import { Redis } from "@upstash/redis";
// Import agent factory from the shared agents package (NO CODE DUPLICATION!)
import { createDiceAgent } from "a2a-agents";
import { Hono } from "hono";
import { cors } from "hono/cors";

// ============================================================================
// Vercel Edge Runtime Config
// ============================================================================

export const config = {
  runtime: "edge",
};

// ============================================================================
// Environment Access (Vercel uses process.env)
// ============================================================================

interface Env {
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  AI_PROVIDER?: string;
  AI_MODEL?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
}

function getEnv(): Env {
  return {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    AI_PROVIDER: process.env.AI_PROVIDER,
    AI_MODEL: process.env.AI_MODEL,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  };
}

// ============================================================================
// Model Configuration (same logic as Cloudflare Workers)
// ============================================================================

function getModel(env: Env) {
  const provider = env.AI_PROVIDER || "openai";
  const modelName = env.AI_MODEL;

  switch (provider.toLowerCase()) {
    case "openai": {
      if (!env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is required. Set it using: vercel env add OPENAI_API_KEY");
      }
      const openai = createOpenAI({
        apiKey: env.OPENAI_API_KEY,
      });
      return openai.chat(modelName || "gpt-4o-mini");
    }

    case "anthropic": {
      if (!env.ANTHROPIC_API_KEY) {
        throw new Error("ANTHROPIC_API_KEY is required when using anthropic provider");
      }
      const anthropic = createAnthropic({
        apiKey: env.ANTHROPIC_API_KEY,
      });
      return anthropic(modelName || "claude-3-5-sonnet-20241022");
    }

    case "google": {
      if (!env.GOOGLE_API_KEY) {
        throw new Error("GOOGLE_API_KEY is required when using google provider");
      }
      const google = createGoogleGenerativeAI({
        apiKey: env.GOOGLE_API_KEY,
      });
      return google(modelName || "gemini-2.0-flash-exp");
    }

    default:
      throw new Error(
        `Unknown AI provider: "${provider}"\n\n` +
          "Supported providers:\n" +
          "  - openai (default)\n" +
          "  - anthropic\n" +
          "  - google\n\n" +
          "Set AI_PROVIDER environment variable."
      );
  }
}

function getModelInfo(env: Env) {
  return {
    provider: env.AI_PROVIDER || "openai",
    model: env.AI_MODEL || "gpt-4o-mini",
  };
}

// ============================================================================
// Task Store Configuration (same as Cloudflare Workers)
// ============================================================================

function createTaskStore(env: Env): TaskStore {
  // Use Redis if configured (same Redis works across platforms!)
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    const redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });

    return new UpstashRedisTaskStore({
      client: redis,
      prefix: "a2a:dice-vercel:",
      ttlSeconds: 86400 * 7, // 7 days
    });
  }

  // Fall back to in-memory
  return new InMemoryTaskStore();
}

// ============================================================================
// Agent Card Configuration (same as Cloudflare Workers)
// ============================================================================

const rollDiceSkill: AgentSkill = {
  id: "f56cab88-3fe9-47ec-ba6e-86a13c9f1f74",
  name: "Roll Dice",
  description: "Rolls an N-sided dice and returns the result. By default uses a 6-sided dice.",
  tags: ["dice", "random", "game"],
  examples: ["Can you roll an 11-sided dice?", "Roll a 20-sided die", "Roll 2d6"],
};

const checkPrimeSkill: AgentSkill = {
  id: "33856129-d686-4a54-9c6e-fffffec3561b",
  name: "Prime Detector",
  description: "Determines which numbers from a list are prime numbers.",
  tags: ["prime", "math", "numbers"],
  examples: [
    "Which of these are prime numbers: 1, 4, 6, 7",
    "Is 17 a prime number?",
    "Check if 2, 3, 5, 7 are prime",
  ],
};

function createAgentCard(baseUrl: string): AgentCard {
  return {
    name: "Dice Agent (Vercel)",
    description:
      "An agent that can roll arbitrary dice and answer if numbers are prime. Running on Vercel Edge.",
    url: baseUrl,
    version: "1.0.0",
    protocolVersion: "0.3.0",
    preferredTransport: "JSONRPC",
    defaultInputModes: ["text"],
    defaultOutputModes: ["text"],
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    skills: [rollDiceSkill, checkPrimeSkill],
  };
}

// ============================================================================
// Hono App Setup (same pattern as Cloudflare Workers)
// ============================================================================

const app = new Hono();

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
  const env = getEnv();
  const modelInfo = getModelInfo(env);
  const hasRedis = !!(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);

  return c.json({
    status: "healthy",
    agent: "Dice Agent",
    provider: modelInfo.provider,
    model: modelInfo.model,
    runtime: "Vercel Edge",
    features: {
      persistentStorage: hasRedis,
      storageType: hasRedis ? "upstash-redis" : "in-memory",
    },
  });
});

// A2A Protocol routes
app.all("/*", async (c, next) => {
  const env = getEnv();
  const url = new URL(c.req.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  const agentCard = createAgentCard(baseUrl);

  // Create agent using imported factory function (SAME AS CLOUDFLARE WORKERS!)
  const model = getModel(env);
  const agent = createDiceAgent(model);

  const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
    mode: "generate",
    workingMessage: "Rolling dice...",
    debug: false,
  });

  const taskStore = createTaskStore(env);
  const requestHandler = new DefaultRequestHandler(agentCard, taskStore, agentExecutor);

  const a2aRouter = new Hono();
  const logger = ConsoleLogger.create();
  const appBuilder = new A2AHonoApp(requestHandler, { logger });
  appBuilder.setupRoutes(a2aRouter);

  const a2aResponse = await a2aRouter.fetch(c.req.raw);
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
// Export for Vercel Edge
// ============================================================================

export default app.fetch;

