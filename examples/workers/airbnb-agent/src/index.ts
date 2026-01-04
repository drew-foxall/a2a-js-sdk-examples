/**
 * Airbnb Agent - A2A Worker
 *
 * This agent searches for Airbnb accommodations using the Airbnb MCP Server.
 * It's designed as a specialist agent for the Travel Planner orchestrator.
 *
 * KEY ARCHITECTURE:
 * - Agent logic is imported from the shared `a2a-agents` package
 * - MCP client uses HTTP transport for Cloudflare Workers compatibility
 * - Supports both Service Binding and HTTP URL for MCP server
 *
 * NOTE: Uses custom implementation due to Service Binding injection
 * and custom error handling requirements.
 */

import type { AgentSkill } from "@drew-foxall/a2a-js-sdk";
import { A2AHonoApp, ConsoleLogger, type Logger } from "@drew-foxall/a2a-js-sdk/server/hono";
import { DefaultRequestHandler } from "@drew-foxall/a2a-js-sdk/server";
import { createAirbnbAgentHttp } from "a2a-agents";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  buildAgentCard,
  createA2AExecutor,
  createTaskStore,
  getModel,
  getModelInfo,
  isRedisConfigured,
  type WorkerEnvWithRedis,
} from "a2a-workers-shared";

// ============================================================================
// Types
// ============================================================================

interface AirbnbEnv extends WorkerEnvWithRedis {
  AIRBNB_MCP_URL?: string;
  AIRBNB_MCP?: Fetcher;
}

// ============================================================================
// Skills
// ============================================================================

const airbnbSearchSkill: AgentSkill = {
  id: "airbnb-search",
  name: "Search Airbnb Listings",
  description:
    "Search for Airbnb accommodations by location, dates, number of guests, and price range.",
  tags: ["accommodation", "airbnb", "vacation-rental", "search"],
  examples: [
    "Find Airbnb listings in Paris for 2 adults, checking in December 20 and out December 27",
    "Search for pet-friendly Airbnbs in Tokyo under $200/night",
    "Look for Airbnb rentals in Barcelona for a family of 4",
  ],
};

const listingDetailsSkill: AgentSkill = {
  id: "listing-details",
  name: "Get Listing Details",
  description:
    "Get detailed information about a specific Airbnb listing including amenities, reviews, and pricing.",
  tags: ["accommodation", "airbnb", "details"],
  examples: [
    "Get details for Airbnb listing 12345678",
    "Show me more information about this Airbnb",
  ],
};

// ============================================================================
// Hono App
// ============================================================================

const app = new Hono<{ Bindings: AirbnbEnv }>();

app.use("/*", cors());

app.get("/health", (c) => {
  const modelInfo = getModelInfo(c.env);
  return c.json({
    status: "healthy",
    agent: "Airbnb Agent",
    provider: modelInfo.provider,
    model: modelInfo.model,
    runtime: "Cloudflare Workers",
    features: {
      mcpTransport: c.env.AIRBNB_MCP ? "service-binding" : "http",
      persistentStorage: isRedisConfigured(c.env),
      storageType: isRedisConfigured(c.env) ? "upstash-redis" : "in-memory",
    },
  });
});

app.all("/*", async (c, next) => {
  try {
    const url = new URL(c.req.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    const agentCard = buildAgentCard(baseUrl, {
      name: "Airbnb Agent",
      description:
        "Specialist agent for searching Airbnb accommodations. Finds vacation rentals based on location, dates, and guest requirements.",
      skills: [airbnbSearchSkill, listingDetailsSkill],
    });

    const llmModel = getModel(c.env);
    const mcpUrl = c.env.AIRBNB_MCP_URL || "http://localhost:8788";

    // Create agent with MCP client (Service Binding or HTTP)
    const agent = createAirbnbAgentHttp({
      model: llmModel,
      mcp: c.env.AIRBNB_MCP
        ? { url: "https://internal", fetcher: c.env.AIRBNB_MCP }
        : { url: mcpUrl },
    });

    const agentExecutor = createA2AExecutor(
      {
        agentName: "Airbnb Agent",
        createAgent: () => agent,
        createAgentCard: () => agentCard,
        adapterOptions: {
          mode: "stream",
          includeHistory: true,
        },
      },
      llmModel,
      c.env
    );

    const taskStore = createTaskStore({ type: "redis", prefix: "a2a:airbnb:" }, c.env);
    const requestHandler = new DefaultRequestHandler(agentCard, taskStore, agentExecutor);

    const a2aRouter = new Hono();
    const logger: Logger = ConsoleLogger.create();
    const appBuilder = new A2AHonoApp(requestHandler, { logger });
    appBuilder.setupRoutes(a2aRouter);

    const a2aResponse = await a2aRouter.fetch(c.req.raw, c.env);

    if (a2aResponse.status !== 404) {
      return a2aResponse;
    }

    return next();
  } catch (error) {
    const errorLogger: Logger = ConsoleLogger.create();
    errorLogger.error("Airbnb Agent Error", {
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : { name: "UnknownError", message: String(error) },
    });
    return c.json(
      {
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
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

export default app;
