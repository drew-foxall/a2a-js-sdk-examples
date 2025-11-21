/**
 * Weather Agent - A2A Server
 *
 * A specialist agent for weather forecasts.
 * Part of the Travel Planner Multi-Agent System.
 *
 * Port: 41250 (by default)
 *
 * Usage:
 *   pnpm agents:weather-agent
 *   # or
 *   cd samples/js
 *   pnpm tsx src/agents/travel-planner-multiagent/weather-agent/index.ts
 */

import type { AgentCard, AgentSkill } from "@drew-foxall/a2a-js-sdk";
import {
  type AgentExecutor,
  DefaultRequestHandler,
  InMemoryTaskStore,
  type TaskStore,
} from "@drew-foxall/a2a-js-sdk/server";
import { A2AHonoApp } from "@drew-foxall/a2a-js-sdk/server/hono";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { A2AAdapter } from "../../../shared/a2a-adapter.js";
import { getModel } from "../../../shared/utils.js";
import { createWeatherAgent } from "./agent.js";

// ============================================================================
// Configuration
// ============================================================================

const PORT = 41250;
const HOST = "0.0.0.0";
const BASE_URL = `http://localhost:${PORT}`;

// ============================================================================
// Agent Initialization
// ============================================================================

const model = getModel();
const agent = createWeatherAgent(model);

// ============================================================================
// A2A Protocol Integration
// ============================================================================

const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
  workingMessage: "Looking up weather forecast...",
  debug: false,
});

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

const weatherAgentCard: AgentCard = {
  name: "Weather Agent",
  description: "Specialized weather forecast assistant using Open-Meteo API",
  url: `${BASE_URL}/.well-known/agent-card.json`,
  protocolVersion: "0.3.0",
  version: "1.0.0",
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
  capabilities: {
    streaming: true,
    pushNotifications: false,
    stateTransitionHistory: true,
  },
  skills: [weatherForecastSkill],
};

// ============================================================================
// HTTP Server (Hono + A2A)
// ============================================================================

async function main() {
  const taskStore: TaskStore = new InMemoryTaskStore();

  const requestHandler = new DefaultRequestHandler(weatherAgentCard, taskStore, agentExecutor);

  const app = new Hono();
  const appBuilder = new A2AHonoApp(requestHandler);
  appBuilder.setupRoutes(app);

  console.log(`
🌤️  Weather Agent - A2A Server Starting...

📍 Port: ${PORT}
🌐 URL: ${BASE_URL}
📋 Agent Card: ${BASE_URL}/.well-known/agent-card.json

🤖 Agent: Weather Agent (Specialist)
🔧 Framework: AI SDK v6 + Hono + A2A Protocol
🧠 Model: ${process.env.AI_PROVIDER || "openai"} / ${process.env.AI_MODEL || "default"}

✨ This agent is a SPECIALIST agent:
   - Provides weather forecasts (7-day)
   - Uses Open-Meteo API (free, no API key)
   - Can be consumed by orchestrator agents

🌍 Weather Features:
   - Global weather forecasts
   - Temperature (high/low)
   - Precipitation amounts
   - Weather conditions
   - 7-day forecast

📝 Try it standalone:
   curl -X POST ${BASE_URL}/message/send \\
     -H "Content-Type: application/json" \\
     -d '{"message": {"role": "user", "parts": [{"kind": "text", "text": "What is the weather in Los Angeles?"}]}}'

🔗 Multi-Agent Usage:
   This agent can be consumed by an orchestrator using a2a-ai-provider:
   
   import { a2a } from "a2a-ai-provider";
   import { generateText } from "ai";
   
   const result = await generateText({
     model: a2a('${BASE_URL}/.well-known/agent-card.json'),
     prompt: 'Weather in Paris?',
   });

🚀 Ready to provide weather forecasts...
`);

  serve({
    fetch: app.fetch,
    port: PORT,
    hostname: HOST,
  });
}

main().catch(console.error);
