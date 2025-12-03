/**
 * Expense Agent - Cloudflare Worker
 *
 * Exposes the Expense agent via the A2A protocol on Cloudflare Workers.
 * Processes expense reimbursement requests with multi-turn clarification.
 *
 * KEY ARCHITECTURE:
 * - Agent logic is imported from the shared `a2a-agents` package (no duplication!)
 * - Worker only handles deployment-specific concerns (env, routing)
 *
 * Task Store: Uses Redis for persistent task state (multi-step forms)
 *
 * Deployment:
 *   wrangler deploy
 *
 * Local Development:
 *   wrangler dev
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
import { A2AHonoApp } from "@drew-foxall/a2a-js-sdk/server/hono";
// Import agent factory from the shared agents package (NO CODE DUPLICATION!)
import { createExpenseAgent } from "a2a-agents";
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

type ExpenseHonoEnv = { Bindings: Env };

// ============================================================================
// Task Store Configuration
// ============================================================================

function createTaskStore(env: Env): TaskStore {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    const redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });

    return new UpstashRedisTaskStore({
      client: redis,
      prefix: "a2a:expense:",
      ttlSeconds: 86400 * 7, // 7 days
    });
  }

  return new InMemoryTaskStore();
}

// ============================================================================
// Agent Card Configuration
// ============================================================================

const expenseSkill: AgentSkill = {
  id: "expense_reimbursement",
  name: "Expense Reimbursement",
  description:
    "Process expense reimbursement requests by extracting details and submitting for approval",
  tags: ["expense", "reimbursement", "finance", "forms"],
  examples: [
    "Submit $50 for team lunch on 2024-01-15",
    "Expense: $200 travel to client site",
    "I need to expense $75 for office supplies",
  ],
};

function createAgentCard(baseUrl: string): AgentCard {
  return {
    name: "Expense Agent",
    description:
      "An agent that processes expense reimbursement requests with multi-turn data collection",
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
    skills: [expenseSkill],
  };
}

// ============================================================================
// Hono App Setup
// ============================================================================

const app = new Hono<ExpenseHonoEnv>();

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
    agent: "Expense Agent",
    provider: modelInfo.provider,
    model: modelInfo.model,
    runtime: "Cloudflare Workers",
  });
});

// ============================================================================
// A2A Protocol Routes
// ============================================================================

app.all("/*", async (c, next) => {
  const url = new URL(c.req.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  const agentCard = createAgentCard(baseUrl);

  // Create agent using imported factory function
  const model = getModel(c.env);
  const agent = createExpenseAgent(model);

  const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
    mode: "stream",
    workingMessage: "Processing expense request...",
  });

  const taskStore = createTaskStore(c.env);
  const requestHandler = new DefaultRequestHandler(agentCard, taskStore, agentExecutor);

  const a2aRouter = new Hono();
  const appBuilder = new A2AHonoApp(requestHandler);
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

