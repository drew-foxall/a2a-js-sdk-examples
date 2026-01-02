/**
 * Weather Agent - Cloudflare Worker (PRIVATE Specialist)
 *
 * A specialist agent for weather forecasts, part of the multi-agent system.
 *
 * KEY ARCHITECTURE:
 * - Agent logic is imported from the shared `a2a-agents` package
 * - Worker configuration is framework-agnostic
 * - Hono adapter handles HTTP concerns
 *
 * SECURITY:
 * - This worker is designed to be called ONLY via Service Binding
 * - When INTERNAL_ONLY=true, rejects requests from public internet
 * - Only the Travel Planner orchestrator can call this worker
 *
 * Deployment:
 *   wrangler deploy
 *
 * Local Development (INTERNAL_ONLY is ignored):
 *   wrangler dev --port 8788
 */

import type { LanguageModel } from "ai";
import type { AgentSkill } from "@drew-foxall/a2a-js-sdk";
import { createWeatherAgent } from "a2a-agents";
import {
  buildAgentCard,
  createA2AHonoWorker,
  defineWorkerConfig,
  type BaseWorkerEnv,
} from "a2a-workers-shared";

// ============================================================================
// Environment Extension
// ============================================================================

interface WeatherEnv extends BaseWorkerEnv {
  INTERNAL_ONLY?: string;
}

// ============================================================================
// Skill Definition
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

// ============================================================================
// Worker Configuration
// ============================================================================

const config = defineWorkerConfig<WeatherEnv>({
  agentName: "Weather Agent",

  createAgent: (model: LanguageModel) => createWeatherAgent(model),

  createAgentCard: (baseUrl: string) =>
    buildAgentCard(baseUrl, {
      name: "Weather Agent",
      description:
        "Specialized weather forecast assistant using Open-Meteo API. This is a PRIVATE agent - only accessible via Service Binding.",
      skills: [weatherForecastSkill],
      capabilities: {
        stateTransitionHistory: true,
      },
    }),

  adapterOptions: {
    mode: "stream",
  },

  healthCheckExtras: (env: WeatherEnv) => ({
    role: "Specialist (Multi-Agent System)",
    features: ["7-day forecast", "Global coverage", "Open-Meteo API"],
    access: env.INTERNAL_ONLY === "true" ? "private" : "public",
  }),
});

// ============================================================================
// Export Hono Application
// ============================================================================

export default createA2AHonoWorker(config, {
  notFoundResponse: (c) => {
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
  },
});
