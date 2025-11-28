/**
 * Airbnb Agent - A2A Worker
 *
 * This agent searches for Airbnb accommodations using the Airbnb MCP Server.
 * It's designed as a specialist agent for the Travel Planner orchestrator.
 *
 * The agent connects to the Airbnb MCP Server via HTTP transport, which
 * works in the Cloudflare Workers environment (unlike stdio transport).
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { generateText, tool } from "ai";
import type { LanguageModelV1 } from "ai";
import {
  A2AAdapter,
  type AgentExecutor,
} from "@drew-foxall/a2a-ai-sdk-adapter";
import {
  DefaultRequestHandler,
  InMemoryTaskStore,
  type TaskStore,
  type AgentCard,
} from "@drew-foxall/a2a-js-sdk/server";
import { A2AHonoApp } from "@drew-foxall/a2a-js-sdk/server/hono";
import { z } from "zod";
import { getModel, type Env as BaseEnv } from "a2a-workers-shared";

// ============================================================================
// Types
// ============================================================================

interface Env extends BaseEnv {
  INTERNAL_ONLY?: string;
  AIRBNB_MCP_URL?: string;
  AIRBNB_MCP?: Fetcher; // Service binding to MCP server
}

type HonoEnv = {
  Bindings: Env;
};

// ============================================================================
// Agent Card
// ============================================================================

function createAgentCard(baseUrl: string): AgentCard {
  return {
    name: "Airbnb Agent",
    description:
      "Specialist agent for searching Airbnb accommodations. Finds vacation rentals based on location, dates, and guest requirements.",
    url: baseUrl,
    version: "1.0.0",
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    skills: [
      {
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
      },
      {
        id: "listing-details",
        name: "Get Listing Details",
        description:
          "Get detailed information about a specific Airbnb listing including amenities, reviews, and pricing.",
        tags: ["accommodation", "airbnb", "details"],
        examples: [
          "Get details for Airbnb listing 12345678",
          "Show me more information about this Airbnb",
        ],
      },
    ],
  };
}

// ============================================================================
// MCP Client for Workers
// ============================================================================

interface MCPToolResult {
  content: Array<{ type: string; text: string }>;
}

/**
 * Call the Airbnb MCP Server via HTTP
 */
async function callMCPTool(
  env: Env,
  toolName: string,
  args: Record<string, unknown>
): Promise<string> {
  // Prefer Service Binding if available (faster, no network hop)
  const fetcher = env.AIRBNB_MCP;
  const mcpUrl = env.AIRBNB_MCP_URL || "http://localhost:8788";

  const requestBody = {
    jsonrpc: "2.0",
    id: Date.now(),
    method: "tools/call",
    params: {
      name: toolName,
      arguments: args,
    },
  };

  let response: Response;

  if (fetcher) {
    // Use Service Binding
    response = await fetcher.fetch("https://internal/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
  } else {
    // Fall back to HTTP URL
    response = await fetch(`${mcpUrl}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
  }

  if (!response.ok) {
    throw new Error(`MCP call failed: ${response.status} ${response.statusText}`);
  }

  const result = (await response.json()) as {
    result?: MCPToolResult;
    error?: { message: string };
  };

  if (result.error) {
    throw new Error(`MCP error: ${result.error.message}`);
  }

  // Extract text from MCP response
  const content = result.result?.content?.[0];
  if (content?.type === "text") {
    return content.text;
  }

  return JSON.stringify(result.result);
}

// ============================================================================
// Agent Creation
// ============================================================================

function createAirbnbTools(env: Env) {
  return {
    searchAirbnb: tool({
      description:
        "Search for Airbnb listings. Returns accommodations matching the criteria with prices and direct links.",
      parameters: z.object({
        location: z
          .string()
          .describe("Location to search (city, state, country)"),
        checkin: z
          .string()
          .optional()
          .describe("Check-in date in YYYY-MM-DD format"),
        checkout: z
          .string()
          .optional()
          .describe("Check-out date in YYYY-MM-DD format"),
        adults: z.number().optional().describe("Number of adults (default: 1)"),
        children: z.number().optional().describe("Number of children"),
        infants: z.number().optional().describe("Number of infants"),
        pets: z.number().optional().describe("Number of pets"),
        minPrice: z.number().optional().describe("Minimum price per night"),
        maxPrice: z.number().optional().describe("Maximum price per night"),
      }),
      execute: async (args) => {
        try {
          const result = await callMCPTool(env, "airbnb_search", args);
          return result;
        } catch (error) {
          return `Error searching Airbnb: ${error instanceof Error ? error.message : "Unknown error"}`;
        }
      },
    }),

    getListingDetails: tool({
      description:
        "Get detailed information about a specific Airbnb listing including amenities, reviews, and pricing.",
      parameters: z.object({
        id: z.string().describe("The Airbnb listing ID"),
        checkin: z
          .string()
          .optional()
          .describe("Check-in date in YYYY-MM-DD format"),
        checkout: z
          .string()
          .optional()
          .describe("Check-out date in YYYY-MM-DD format"),
        adults: z.number().optional().describe("Number of adults"),
      }),
      execute: async (args) => {
        try {
          const result = await callMCPTool(env, "airbnb_listing_details", args);
          return result;
        } catch (error) {
          return `Error getting listing details: ${error instanceof Error ? error.message : "Unknown error"}`;
        }
      },
    }),
  };
}

const SYSTEM_PROMPT = `You are an expert Airbnb accommodation specialist. Your role is to help users find the perfect vacation rental.

When searching for accommodations:
1. Always use the searchAirbnb tool with the provided criteria
2. Present results in a clear, organized format
3. Highlight key features: price, rating, capacity, and amenities
4. Include direct links to listings
5. Offer to get more details on specific listings if the user is interested

When providing listing details:
1. Use the getListingDetails tool with the listing ID
2. Summarize the key information: description, amenities, house rules
3. Mention the host information and reviews
4. Provide pricing details if available

Be helpful, concise, and focus on finding accommodations that match the user's needs.`;

function createAirbnbAgent(model: LanguageModelV1, env: Env) {
  const tools = createAirbnbTools(env);

  return {
    invoke: async (input: string) => {
      const result = await generateText({
        model,
        system: SYSTEM_PROMPT,
        prompt: input,
        tools,
        maxSteps: 5,
      });

      return result.text;
    },
  };
}

// ============================================================================
// Hono App
// ============================================================================

const app = new Hono<HonoEnv>();

app.use("/*", cors());

// Health check
app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    agent: "airbnb-agent",
    version: "1.0.0",
    internal: c.env.INTERNAL_ONLY === "true",
  });
});

// A2A routes
app.all("/*", async (c, next) => {
  // Check if this is an internal-only agent being accessed externally
  if (c.env.INTERNAL_ONLY === "true") {
    const internalHeader = c.req.header("X-Worker-Internal");
    if (!internalHeader) {
      return c.json(
        {
          error: "Forbidden",
          message:
            "This agent is only accessible via internal service bindings",
        },
        403
      );
    }
  }

  const url = new URL(c.req.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  const agentCard = createAgentCard(baseUrl);

  const model = getModel(c.env);
  const agent = createAirbnbAgent(model, c.env);

  const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
    mode: "stream",
    workingMessage: "Searching for Airbnb accommodations...",
    includeHistory: true,
  });

  const taskStore: TaskStore = new InMemoryTaskStore();
  const requestHandler = new DefaultRequestHandler(
    agentCard,
    taskStore,
    agentExecutor
  );

  const a2aRouter = new Hono();
  const appBuilder = new A2AHonoApp(requestHandler);
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

export default app;

