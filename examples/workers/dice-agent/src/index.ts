/**
 * Dice Agent - Cloudflare Worker
 *
 * Exposes the Dice agent via the A2A protocol on Cloudflare Workers.
 * Demonstrates tool usage with pure computational functions.
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
import { A2AHonoApp } from "@drew-foxall/a2a-js-sdk/server/hono";
// Import agent factory from the shared agents package (NO CODE DUPLICATION!)
import { createDiceAgent } from "a2a-agents";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { HonoEnv } from "../../shared/types.js";
import { getModel, getModelInfo } from "../../shared/utils.js";

// ============================================================================
// Agent Card Configuration
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
    name: "Dice Agent",
    description: "An agent that can roll arbitrary dice and answer if numbers are prime",
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
    agent: "Dice Agent",
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
  const agent = createDiceAgent(model);

  const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
    mode: "generate",
    workingMessage: "Rolling dice...",
    debug: false,
  });

  const taskStore: TaskStore = new InMemoryTaskStore();
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
