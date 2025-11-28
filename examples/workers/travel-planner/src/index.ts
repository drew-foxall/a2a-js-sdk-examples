/**
 * Travel Planner - Cloudflare Worker (Multi-Agent Orchestrator)
 *
 * This is the ORCHESTRATOR that coordinates specialist agents:
 * - Weather Agent: Provides weather forecasts (via Service Binding - PRIVATE)
 * - (Future: Airbnb Agent, Flight Agent, etc.)
 *
 * SECURITY:
 * - Uses Cloudflare Service Bindings for private worker-to-worker calls
 * - Specialist workers are NOT publicly accessible
 * - Communication happens inside Cloudflare's network (no public internet)
 *
 * KEY ARCHITECTURE:
 * ```
 * Public Internet                    Cloudflare Internal Network
 * ┌──────────┐                      ┌─────────────────────────────────┐
 * │   User   │ ──HTTP/A2A──────────►│  Travel Planner (this worker)  │
 * └──────────┘                      │         │                       │
 *                                   │         │ Service Binding       │
 *                                   │         ▼ (private, no HTTP)    │
 *                                   │  ┌─────────────────────────┐   │
 *                                   │  │  Weather Agent          │   │
 *                                   │  │  (no public URL)        │   │
 *                                   │  └─────────────────────────┘   │
 *                                   └─────────────────────────────────┘
 * ```
 *
 * Deployment:
 *   1. Deploy Weather Agent: cd workers/weather-agent && wrangler deploy
 *   2. Deploy this worker: cd workers/travel-planner && wrangler deploy
 *   3. Service Binding automatically connects them!
 *
 * Local Development (Service Bindings not available):
 *   1. Start Weather Agent: cd workers/weather-agent && wrangler dev --port 8788
 *   2. Start this worker: cd workers/travel-planner && wrangler dev --port 8787
 *   3. Falls back to HTTP URLs for local testing
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
import { a2a } from "a2a-ai-provider";
import { ToolLoopAgent, generateText, type LanguageModel } from "ai";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { getModel, getModelInfo } from "../../shared/utils.js";

// ============================================================================
// Environment with Service Bindings
// ============================================================================

interface PlannerEnv {
  // Secrets
  OPENAI_API_KEY: string;
  ANTHROPIC_API_KEY?: string;
  GOOGLE_API_KEY?: string;

  // Config
  AI_PROVIDER?: string;
  AI_MODEL?: string;

  // Service Bindings (Cloudflare worker-to-worker)
  // These are Fetcher objects that call other workers directly
  WEATHER_AGENT?: Fetcher;
  AIRBNB_AGENT?: Fetcher;

  // Fallback URLs for local development (Service Bindings don't work locally)
  WEATHER_AGENT_URL_FALLBACK?: string;
  AIRBNB_AGENT_URL_FALLBACK?: string;
}

type PlannerHonoEnv = { Bindings: PlannerEnv };

// ============================================================================
// Agent Card Configuration
// ============================================================================

const travelPlanningSkill: AgentSkill = {
  id: "travel_planning",
  name: "Travel Planning",
  description:
    "Comprehensive travel planning by coordinating weather forecasts and accommodation searches",
  tags: ["travel", "planning", "orchestration", "multi-agent", "weather", "accommodations"],
  examples: [
    "Plan a trip to Paris for 2 people",
    "What's the weather in Los Angeles?",
    "I need the weather forecast for Tokyo",
    "Plan a trip to New York, June 20-25",
  ],
};

function createAgentCard(baseUrl: string): AgentCard {
  return {
    name: "Travel Planner",
    description:
      "Multi-agent orchestrator that coordinates weather and accommodation searches for comprehensive travel planning. Specialist agents are privately bound (not publicly accessible).",
    url: baseUrl,
    protocolVersion: "0.3.0",
    version: "1.0.0",
    preferredTransport: "JSONRPC",
    preferred_transport: "JSONRPC",
    defaultInputModes: ["text"],
    defaultOutputModes: ["text"],
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: true,
    },
    skills: [travelPlanningSkill],
  } as AgentCard;
}

// ============================================================================
// Service Binding Wrapper for A2A Protocol
// ============================================================================

/**
 * Call a specialist agent via Service Binding or HTTP fallback
 *
 * Service Bindings provide:
 * - Private communication (no public URL needed)
 * - Lower latency (no internet round-trip)
 * - Better security (traffic stays in Cloudflare network)
 */
async function callSpecialistAgent(
  binding: Fetcher | undefined,
  fallbackUrl: string | undefined,
  prompt: string
): Promise<string> {
  // If Service Binding is available (production), use it directly
  if (binding) {
    // Service Binding exposes a fetch() that calls the worker directly
    // We need to make an A2A protocol request to the root (/) JSON-RPC endpoint
    const response = await binding.fetch("https://internal/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Worker-Internal": "true", // Extra validation header
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "message/send",
        id: `req-${Date.now()}`,
        params: {
          message: {
            role: "user",
            messageId: `msg-${Date.now()}`,
            parts: [{ kind: "text", text: prompt }],
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Service Binding call failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json() as { result?: { status?: { message?: { parts?: Array<{ kind?: string; text?: string }> } } } };

    // Extract text from A2A response
    const parts = result?.result?.status?.message?.parts;
    if (!parts || parts.length === 0) {
      return "No response from specialist agent";
    }
    
    const text = parts
      ?.filter((p) => p.kind === "text")
      ?.map((p) => p.text)
      ?.join("\n");

    return text || "No response from specialist agent";
  }

  // Fallback to HTTP for local development
  if (fallbackUrl) {

    const result = await generateText({
      model: a2a(fallbackUrl),
      prompt,
    });

    return result.text;
  }

  throw new Error("No Service Binding or fallback URL configured");
}

// ============================================================================
// Create Planner Agent with Service Binding Support
// ============================================================================

const PLANNER_INSTRUCTIONS = `You are a helpful travel planning assistant that coordinates weather forecasts and accommodation searches.

You have access to specialist agents:
1. **getWeatherForecast** - Provides 7-day weather forecasts for any location (privately bound)
2. **searchAccommodations** - Searches Airbnb for vacation rentals (privately bound)

When a user asks about travel plans:
- If they mention weather, use getWeatherForecast
- If they need accommodations, use searchAccommodations
- For full trip planning, use both tools to provide comprehensive recommendations
- Always provide clear, helpful responses based on the tool results

Be conversational and friendly. Format your responses nicely.`;

const weatherForecastSchema = z.object({
  location: z
    .string()
    .describe("The location to get weather for (e.g., 'Paris', 'Los Angeles', 'Tokyo')"),
});

const accommodationSearchSchema = z.object({
  location: z.string().describe("The location to search for accommodations"),
  checkin: z.string().optional().describe("Check-in date in YYYY-MM-DD format"),
  checkout: z.string().optional().describe("Check-out date in YYYY-MM-DD format"),
  adults: z.number().optional().describe("Number of adults (default: 1)"),
  children: z.number().optional().describe("Number of children"),
  maxPrice: z.number().optional().describe("Maximum price per night"),
});

type WeatherForecastParams = z.infer<typeof weatherForecastSchema>;
type AccommodationSearchParams = z.infer<typeof accommodationSearchSchema>;

function createPlannerAgentWithBindings(
  model: LanguageModel,
  env: PlannerEnv
): ToolLoopAgent<never, Record<string, unknown>, never> {
  return new ToolLoopAgent({
    model,
    instructions: PLANNER_INSTRUCTIONS,
    tools: {
      getWeatherForecast: {
        description:
          "Get a 7-day weather forecast for a location. Uses a privately-bound specialist agent.",
        inputSchema: weatherForecastSchema,
        execute: async (params: WeatherForecastParams) => {
          try {
            const result = await callSpecialistAgent(
              env.WEATHER_AGENT,
              env.WEATHER_AGENT_URL_FALLBACK,
              `What is the weather forecast for ${params.location}?`
            );

            return result;
          } catch (error) {
            return `Error getting weather forecast: ${error instanceof Error ? error.message : "Unknown error"}`;
          }
        },
      },
      searchAccommodations: {
        description:
          "Search for Airbnb accommodations at a location. Uses a privately-bound specialist agent with MCP integration.",
        inputSchema: accommodationSearchSchema,
        execute: async (params: AccommodationSearchParams) => {

          try {
            // Build the search prompt
            let prompt = `Search for Airbnb listings in ${params.location}`;
            if (params.checkin && params.checkout) {
              prompt += ` from ${params.checkin} to ${params.checkout}`;
            }
            if (params.adults) {
              prompt += ` for ${params.adults} adult${params.adults > 1 ? "s" : ""}`;
            }
            if (params.children) {
              prompt += ` and ${params.children} child${params.children > 1 ? "ren" : ""}`;
            }
            if (params.maxPrice) {
              prompt += ` under $${params.maxPrice}/night`;
            }

            const result = await callSpecialistAgent(
              env.AIRBNB_AGENT,
              env.AIRBNB_AGENT_URL_FALLBACK,
              prompt
            );

            return result;
          } catch (error) {
            return `Error searching accommodations: ${error instanceof Error ? error.message : "Unknown error"}`;
          }
        },
      },
    },
  });
}

// ============================================================================
// Hono App Setup
// ============================================================================

const app = new Hono<PlannerHonoEnv>();

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
  const hasWeatherBinding = !!c.env.WEATHER_AGENT;
  const hasAirbnbBinding = !!c.env.AIRBNB_AGENT;

  return c.json({
    status: "healthy",
    agent: "Travel Planner",
    role: "Orchestrator (Multi-Agent System)",
    provider: modelInfo.provider,
    model: modelInfo.model,
    runtime: "Cloudflare Workers",
    security: {
      weatherAgent: hasWeatherBinding ? "🔒 Service Binding (private)" : "🌐 HTTP fallback",
      airbnbAgent: hasAirbnbBinding ? "🔒 Service Binding (private)" : "Not configured",
    },
  });
});

// ============================================================================
// A2A Protocol Routes
// ============================================================================

app.all("/*", async (c, next) => {
  const url = new URL(c.req.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  const agentCard = createAgentCard(baseUrl);

  // Check if we have at least one way to call the weather agent
  const hasWeatherAccess = !!c.env.WEATHER_AGENT || !!c.env.WEATHER_AGENT_URL_FALLBACK;

  if (!hasWeatherAccess) {
    return c.json(
      {
        error: "Configuration Error",
        message:
          "Weather Agent not configured. Deploy the weather-agent worker and ensure Service Binding is set up.",
      },
      500
    );
  }

  // Create orchestrator agent with Service Binding support
  const model = getModel(c.env);
  const agent = createPlannerAgentWithBindings(model, c.env);

  const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
    mode: "stream",
    workingMessage: "Planning your trip...",
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
      role: "This is an ORCHESTRATOR agent - coordinates PRIVATE specialist agents",
      security: "Specialist agents are bound via Service Bindings (not publicly accessible)",
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
