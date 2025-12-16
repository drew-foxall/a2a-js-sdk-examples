/**
 * Content Planner Agent - Cloudflare Worker
 *
 * Exposes the Content Planner agent via the A2A protocol on Cloudflare Workers.
 * Creates detailed content outlines from high-level descriptions.
 *
 * KEY ARCHITECTURE:
 * - Agent logic is imported from the shared `a2a-agents` package (no duplication!)
 * - Worker only handles deployment-specific concerns (env, routing)
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
import { A2AHonoApp, ConsoleLogger } from "@drew-foxall/a2a-js-sdk/server/hono";
// Import agent factory from the shared agents package (NO CODE DUPLICATION!)
import { createContentPlannerAgent } from "a2a-agents";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { HonoEnv } from "../../shared/types.js";
import { getModel, getModelInfo } from "../../shared/utils.js";

// ============================================================================
// Agent Card Configuration
// ============================================================================

const contentPlanningSkill: AgentSkill = {
  id: "content_planning",
  name: "Content Planning",
  description:
    "Creates detailed content outlines with sections, key points, and word count recommendations",
  tags: ["content", "planning", "outline", "writing"],
  examples: [
    "Create an outline for a blog post about AI agents",
    "Plan a tutorial on building REST APIs",
    "Outline a guide to TypeScript best practices",
  ],
};

function createAgentCard(baseUrl: string): AgentCard {
  return {
    name: "Content Planner",
    description:
      "An agent that creates detailed, actionable content outlines from high-level descriptions",
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
    skills: [contentPlanningSkill],
  };
}

// ============================================================================
// Hono App Setup
// ============================================================================

const app = new Hono<HonoEnv>();

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
    agent: "Content Planner",
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
  const agent = createContentPlannerAgent(model);

  const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
    mode: "stream",
    workingMessage: "Planning content structure...",
  });

  const taskStore: TaskStore = new InMemoryTaskStore();
  const requestHandler = new DefaultRequestHandler(agentCard, taskStore, agentExecutor);

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

