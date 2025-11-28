/**
 * Hello World Agent - Cloudflare Worker
 *
 * Exposes the Hello World agent via the A2A protocol on Cloudflare Workers.
 * This demonstrates the simplest possible A2A agent integration.
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

// Import agent factory from the shared agents package (NO CODE DUPLICATION!)
import { createHelloWorldAgent } from "a2a-agents";

import { A2AAdapter } from "@drew-foxall/a2a-ai-sdk-adapter";
import type { AgentCard, AgentSkill } from "@drew-foxall/a2a-js-sdk";
import {
  type AgentExecutor,
  DefaultRequestHandler,
  InMemoryTaskStore,
  type TaskStore,
} from "@drew-foxall/a2a-js-sdk/server";
import { A2AHonoApp } from "@drew-foxall/a2a-js-sdk/server/hono";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { HonoEnv } from "../../shared/types.js";
import { getModel, getModelInfo } from "../../shared/utils.js";

// ============================================================================
// Agent Card Configuration
// ============================================================================

const helloWorldSkill: AgentSkill = {
  id: "hello_world",
  name: "Returns hello world",
  description: "A simple greeting agent that responds with friendly hello messages",
  tags: ["hello world", "greeting", "simple"],
  examples: ["hi", "hello world", "greet me", "say hello"],
};

function createAgentCard(baseUrl: string): AgentCard {
  return {
    name: "Hello World Agent",
    description: "The simplest possible A2A agent - responds with friendly greetings",
    url: baseUrl,
    protocolVersion: "0.3.0",
    version: "1.0.0",
    defaultInputModes: ["text"],
    defaultOutputModes: ["text"],
    preferredTransport: "JSONRPC",
    preferred_transport: "JSONRPC",
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: true,
    },
    skills: [helloWorldSkill],
  } as AgentCard;
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
    agent: "Hello World Agent",
    provider: modelInfo.provider,
    model: modelInfo.model,
    runtime: "Cloudflare Workers",
  });
});

// ============================================================================
// A2A Protocol Routes - Catch-all handler
// ============================================================================

app.all("/*", async (c, next) => {
  const url = new URL(c.req.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  const agentCard = createAgentCard(baseUrl);

  // Create agent using imported factory function
  const model = getModel(c.env);
  const agent = createHelloWorldAgent(model);

  const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
    mode: "stream",
    workingMessage: "Processing your greeting...",
    includeHistory: true,
  });

  const taskStore: TaskStore = new InMemoryTaskStore();
  const requestHandler = new DefaultRequestHandler(agentCard, taskStore, agentExecutor);

  const a2aRouter = new Hono();
  const appBuilder = new A2AHonoApp(requestHandler);
  appBuilder.setupRoutes(a2aRouter);

  // Try the A2A router first
  const a2aResponse = await a2aRouter.fetch(c.req.raw, c.env);
  
  // If A2A router handled it (not 404), return that response
  if (a2aResponse.status !== 404) {
    return a2aResponse;
  }

  // Otherwise continue to next handler (notFound)
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
