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

import { serve } from "@hono/node-server";
import { A2AHonoApp } from "@drew-foxall/a2a-js-sdk/hono";
import {
  AgentCard,
  AgentSkill,
  AgentCapabilities,
} from "@drew-foxall/a2a-js-sdk";
import { A2AAdapter } from "../../../shared/a2a-adapter.js";
import { createWeatherAgent } from "./agent.js";
import { getModel } from "../../../shared/utils.js";

// ============================================================================
// Configuration
// ============================================================================

const PORT = 41250;
const HOST = "0.0.0.0";
const BASE_URL = `http://localhost:${PORT}`;

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

const agentCard: AgentCard = {
  name: "Weather Agent",
  description: "Specialized weather forecast assistant using Open-Meteo API",
  url: `${BASE_URL}/.well-known/agent-card.json`,
  version: "1.0.0",
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
  capabilities: new AgentCapabilities({
    streaming: true,
    statefulness: "stateless",
  }),
  skills: [weatherForecastSkill],
};

// ============================================================================
// Agent Initialization
// ============================================================================

const model = getModel();
const agent = createWeatherAgent(model);

// ============================================================================
// A2A Protocol Integration
// ============================================================================

const adapter = new A2AAdapter({
  agent,
  agentCard,
  logger: console,
  workingMessage: "Looking up weather forecast...",
});

// ============================================================================
// HTTP Server (Hono + A2A)
// ============================================================================

const app = new A2AHonoApp({
  agentCard,
  agentExecutor: adapter.createAgentExecutor(),
});

// ============================================================================
// Start Server
// ============================================================================

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

