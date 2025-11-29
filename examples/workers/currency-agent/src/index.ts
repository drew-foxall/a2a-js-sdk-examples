/**
 * Currency Agent - Cloudflare Worker
 *
 * Exposes the Currency agent via the A2A protocol on Cloudflare Workers.
 * Demonstrates multi-turn conversation and external API integration.
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
import type { AgentCard, AgentSkill, Artifact } from "@drew-foxall/a2a-js-sdk";
import {
  type AgentExecutor,
  DefaultRequestHandler,
  InMemoryTaskStore,
  type TaskStore,
} from "@drew-foxall/a2a-js-sdk/server";
import { A2AHonoApp } from "@drew-foxall/a2a-js-sdk/server/hono";
// Import agent factory from the shared agents package (NO CODE DUPLICATION!)
import { createCurrencyAgent } from "a2a-agents";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { HonoEnv } from "../../shared/types.js";
import { getModel, getModelInfo } from "../../shared/utils.js";

// ============================================================================
// Agent Card Configuration
// ============================================================================

const currencyConversionSkill: AgentSkill = {
  id: "convert_currency",
  name: "Currency Exchange Rates Tool",
  description: "Helps with exchange values between various currencies",
  tags: ["currency conversion", "currency exchange", "forex"],
  examples: [
    "What is exchange rate between USD and GBP?",
    "Convert 100 USD to EUR",
    "How much is 50 CAD in AUD?",
  ],
};

function createAgentCard(baseUrl: string): AgentCard {
  return {
    name: "Currency Agent",
    description: "Helps with exchange rates for currencies using Frankfurter API",
    url: baseUrl,
    version: "1.0.0",
    protocolVersion: "0.3.0",
    preferredTransport: "JSONRPC",
    defaultInputModes: ["text"],
    defaultOutputModes: ["text"],
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: true,
    },
    skills: [currencyConversionSkill],
  };
}

// ============================================================================
// Multi-Turn Conversation Support
// ============================================================================

function parseTaskState(response: string): "input-required" | "completed" {
  const lowerResponse = response.toLowerCase();

  const askingForInfo =
    lowerResponse.includes("please specify") ||
    lowerResponse.includes("which currency") ||
    lowerResponse.includes("what currency") ||
    lowerResponse.includes("need to know") ||
    lowerResponse.includes("could you specify") ||
    lowerResponse.includes("can you specify") ||
    (lowerResponse.includes("?") && lowerResponse.length < 200);

  return askingForInfo ? "input-required" : "completed";
}

async function generateConversionArtifacts(context: {
  taskId: string;
  contextId: string;
  responseText: string;
}): Promise<Artifact[]> {
  if (parseTaskState(context.responseText) === "input-required") {
    return [];
  }

  return [
    {
      artifactId: `conversion-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      name: "conversion_result",
      parts: [{ kind: "text" as const, text: context.responseText }],
    },
  ];
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
    agent: "Currency Agent",
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
  const agent = createCurrencyAgent(model);

  const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
    mode: "stream",
    generateArtifacts: generateConversionArtifacts,
    parseTaskState,
    workingMessage: "Looking up exchange rates...",
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
