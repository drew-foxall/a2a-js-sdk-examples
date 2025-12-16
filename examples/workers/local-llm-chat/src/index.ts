/**
 * Local LLM Chat Agent - Cloudflare Worker
 *
 * This worker exposes the Local LLM Chat agent via the A2A protocol.
 * While the agent is designed for local LLMs, the worker version uses
 * cloud providers (OpenAI by default) since Workers can't run Ollama.
 *
 * For true edge inference, consider using Cloudflare Workers AI.
 *
 * Task Store: Uses Redis for persistent chat history (multi-turn conversations)
 */

import { Redis } from "@upstash/redis";
import { UpstashRedisTaskStore } from "@drew-foxall/a2a-js-taskstore-upstash-redis";
import { A2AAdapter } from "@drew-foxall/a2a-ai-sdk-adapter";
import type { AgentCard, AgentSkill } from "@drew-foxall/a2a-js-sdk";
import {
  type AgentExecutor,
  DefaultRequestHandler,
  InMemoryTaskStore,
  type TaskStore,
} from "@drew-foxall/a2a-js-sdk/server";
import { A2AHonoApp, ConsoleLogger } from "@drew-foxall/a2a-js-sdk/server/hono";
import { createLocalLLMChatAgent } from "a2a-agents";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env as BaseEnv } from "../../shared/types.js";
import { getModel, getModelInfo } from "../../shared/utils.js";

// ============================================================================
// Types
// ============================================================================

interface Env extends BaseEnv {
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
}

type LocalLLMHonoEnv = { Bindings: Env };

// ============================================================================
// Task Store Configuration
// ============================================================================

/**
 * Create the appropriate task store based on environment configuration.
 * Uses Redis if configured (for chat history persistence).
 */
function createTaskStore(env: Env): TaskStore {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    const redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });

    return new UpstashRedisTaskStore({
      client: redis,
      prefix: "a2a:local-llm:",
      ttlSeconds: 86400 * 7, // 7 days
    });
  }

  return new InMemoryTaskStore();
}

/**
 * Agent skill definition for chat
 */
const chatSkill: AgentSkill = {
  id: "chat_with_tools",
  name: "Chat with Tools",
  description:
    "General chat with access to web search and weather information",
  tags: ["chat", "search", "weather", "assistant"],
  examples: [
    "What's the weather in Tokyo?",
    "Search for the latest news about AI",
    "Tell me about yourself",
  ],
};

/**
 * Create the agent card for service discovery
 */
function createAgentCard(baseUrl: string): AgentCard {
  return {
    name: "Local LLM Chat Agent",
    description:
      "A chat agent that works with local or cloud LLMs. Includes web search and weather tools. This worker version uses cloud providers.",
    url: baseUrl,
    protocolVersion: "0.3.0",
    version: "1.0.0",
    defaultInputModes: ["text"],
    defaultOutputModes: ["text"],
    preferredTransport: "JSONRPC",
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    skills: [chatSkill],
  };
}

const app = new Hono<LocalLLMHonoEnv>();

// CORS middleware
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
  return c.json({
    status: "healthy",
    agent: "Local LLM Chat Agent",
    provider: modelInfo.provider,
    model: modelInfo.model,
    runtime: "Cloudflare Workers",
    note: "Worker version uses cloud LLM providers",
  });
});

// A2A protocol handler
app.all("/*", async (c, next) => {
  const url = new URL(c.req.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  const agentCard = createAgentCard(baseUrl);

  const model = getModel(c.env);
  const agent = createLocalLLMChatAgent(model);

  const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
    mode: "stream",
    workingMessage: "Thinking...",
    debug: false,
    includeHistory: true, // Enable conversation history for multi-turn context
  });

  const taskStore = createTaskStore(c.env);
  const requestHandler = new DefaultRequestHandler(
    agentCard,
    taskStore,
    agentExecutor
  );

  const a2aRouter = new Hono();
  const logger = ConsoleLogger.create();
  const appBuilder = new A2AHonoApp(requestHandler, { logger });
  appBuilder.setupRoutes(a2aRouter);

  const a2aResponse = await a2aRouter.fetch(c.req.raw, c.env);

  if (a2aResponse.status !== 404) {
    return a2aResponse;
  }

  return next();
});

// 404 handler with helpful information
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

export default app;

