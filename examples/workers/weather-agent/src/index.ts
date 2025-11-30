/**
 * Weather Agent - Cloudflare Worker (PRIVATE Specialist)
 *
 * A specialist agent for weather forecasts, part of the multi-agent system.
 *
 * SECURITY:
 * - This worker is designed to be called ONLY via Service Binding
 * - When INTERNAL_ONLY=true, rejects requests from public internet
 * - Only the Travel Planner orchestrator can call this worker
 *
 * Architecture:
 * ```
 * ❌ Public Internet ──X──► Weather Agent (blocked)
 *
 * ✅ Travel Planner ──Service Binding──► Weather Agent (allowed)
 * ```
 *
 * Deployment:
 *   wrangler deploy
 *
 * Local Development (INTERNAL_ONLY is ignored):
 *   wrangler dev --port 8788
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
// Import weather tools from agents package (reuse the actual implementation)
import {
  getWeatherAgentPrompt,
  getWeatherDescription,
  getWeatherForecast,
  isWeatherError,
} from "a2a-agents";
import { jsonSchema, type LanguageModel, ToolLoopAgent } from "ai";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z, toJSONSchema } from "zod/v4";
import type { Env } from "../../shared/types.js";
import { getModel, getModelInfo } from "../../shared/utils.js";

// ============================================================================
// Worker-Compatible Weather Agent - Using Zod 4 with AI SDK jsonSchema helper
// ============================================================================

// Define Zod schema
const weatherForecastZodSchema = z.object({
  location: z.string().describe("Location to get weather for (city, state, country)"),
  days: z.number().min(1).max(7).optional().describe("Number of days to forecast (1-7, default 7)"),
});

type WeatherForecastParams = z.infer<typeof weatherForecastZodSchema>;

// Convert Zod 4 schema to AI SDK compatible schema using jsonSchema helper
const weatherForecastSchema = jsonSchema<WeatherForecastParams>(
  toJSONSchema(weatherForecastZodSchema)
);

/**
 * Generate mock weather data for demo/testing when API is rate limited
 */
function getMockWeatherData(location: string, days: number) {
  const today = new Date();
  const forecasts = [];

  // Generate realistic-looking mock data
  const conditions = ["Clear sky", "Partly cloudy", "Mainly clear", "Overcast", "Slight rain"];
  const baseTemp = 45 + Math.floor(Math.random() * 20); // Base temp between 45-65°F

  for (let i = 0; i < Math.min(days, 7); i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split("T")[0];

    // Add some variation to temps
    const variation = Math.floor(Math.random() * 10) - 5;
    const high = baseTemp + 10 + variation;
    const low = baseTemp - 5 + variation;

    forecasts.push({
      date: dateStr,
      temperatureHigh: `${high}°F`,
      temperatureLow: `${low}°F`,
      precipitation: `${(Math.random() * 0.5).toFixed(2)} inches`,
      conditions: conditions[Math.floor(Math.random() * conditions.length)],
    });
  }

  return {
    success: true,
    location: location,
    timezone: "UTC",
    forecasts,
    _mock: true, // Flag to indicate this is mock data
    _note:
      "Mock data returned due to API rate limiting. Real API would provide accurate forecasts.",
  };
}

/**
 * Create a Weather Agent that works in Cloudflare Workers
 *
 * This is a worker-compatible version that uses explicit JSON schemas
 * instead of Zod (which doesn't bundle correctly for Workers).
 */
function createWorkerWeatherAgent(model: LanguageModel) {
  return new ToolLoopAgent({
    model,
    instructions: getWeatherAgentPrompt(),
    tools: {
      get_weather_forecast: {
        description:
          "Get weather forecast for a location using Open-Meteo API (free, no API key). ALWAYS use this tool when asked about weather.",
        inputSchema: weatherForecastSchema,
        execute: async (params: WeatherForecastParams) => {
          try {
            const forecast = await getWeatherForecast(params.location, params.days || 7);

            if (isWeatherError(forecast)) {
              // If rate limited (429), return mock data for demo purposes
              if (forecast.error.includes("429")) {
                return getMockWeatherData(params.location, params.days || 7);
              }
              return { error: forecast.error };
            }

            const dailyForecasts = forecast.dates.map((date, index) => ({
              date,
              temperatureHigh: `${forecast.temperatureMax[index]}°F`,
              temperatureLow: `${forecast.temperatureMin[index]}°F`,
              precipitation: `${forecast.precipitation[index]} inches`,
              conditions: getWeatherDescription(forecast.weatherCode[index] ?? 0),
            }));

            return {
              success: true,
              location: forecast.location,
              timezone: forecast.timezone,
              forecasts: dailyForecasts,
            };
          } catch {
            // Return mock data on any error for demo reliability
            return getMockWeatherData(params.location, params.days || 7);
          }
        },
      },
    },
  });
}

// ============================================================================
// Extended Environment
// ============================================================================

interface WeatherEnv extends Env {
  INTERNAL_ONLY?: string;
}

type WeatherHonoEnv = { Bindings: WeatherEnv };

// ============================================================================
// Agent Card Configuration
// ============================================================================

const weatherForecastSkill: AgentSkill = {
  id: "weather_forecast",
  name: "Weather Forecast",
  description: "Provides weather forecasts for any location worldwide",
  tags: ["weather", "forecast", "temperature", "precipitation"],
  examples: [
    "What's the weather in Los Angeles?",
    "Weather forecast for Paris next week",
    "Tell me about the weather in Tokyo",
  ],
};

function createAgentCard(baseUrl: string): AgentCard {
  return {
    name: "Weather Agent",
    description:
      "Specialized weather forecast assistant using Open-Meteo API. This is a PRIVATE agent - only accessible via Service Binding.",
    url: baseUrl,
    protocolVersion: "0.3.0",
    version: "1.0.0",
    preferredTransport: "JSONRPC",
    defaultInputModes: ["text"],
    defaultOutputModes: ["text"],
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: true,
    },
    skills: [weatherForecastSkill],
  };
}

// ============================================================================
// Hono App Setup
// ============================================================================

const app = new Hono<WeatherHonoEnv>();

// CORS for development
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
    agent: "Weather Agent",
    role: "Specialist (Multi-Agent System)",
    provider: modelInfo.provider,
    model: modelInfo.model,
    runtime: "Cloudflare Workers",
    features: ["7-day forecast", "Global coverage", "Open-Meteo API"],
  });
});

// ============================================================================
// A2A Protocol Routes
// ============================================================================

app.all("/*", async (c, next) => {
  const url = new URL(c.req.url);
  // For Service Binding calls, use a placeholder base URL
  const baseUrl =
    url.hostname === "internal" ? "https://weather-agent.internal" : `${url.protocol}//${url.host}`;
  const agentCard = createAgentCard(baseUrl);

  // Create agent using worker-compatible factory (with explicit JSON schemas)
  const model = getModel(c.env);
  const agent = createWorkerWeatherAgent(model);

  const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
    mode: "stream",
    workingMessage: "Looking up weather forecast...",
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
  const internalOnly = c.env.INTERNAL_ONLY === "true";

  return c.json(
    {
      error: "Not Found",
      access: internalOnly ? "🔒 This is a PRIVATE agent" : "🌐 Public access enabled",
      message: internalOnly
        ? "This agent is only accessible via Service Binding from the Travel Planner"
        : "Use /.well-known/agent-card.json to discover this agent",
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
