/**
 * Travel Planner - Multi-Agent Orchestrator (Local Node.js Server)
 *
 * This is the orchestrator that coordinates Weather and Airbnb agents.
 * It uses the Python airbnb_planner_multiagent pattern:
 * - Dynamic agent discovery via Agent Card fetching
 * - Single sendMessage tool for routing to any agent
 * - Active agent state tracking for follow-ups
 *
 * Port: 41254
 *
 * Usage:
 *   1. Start Weather Agent (port 41252)
 *   2. Start Airbnb Agent (port 41253)
 *   3. Start this orchestrator (port 41254)
 *
 *   pnpm agents:travel-planner
 */

import { A2AAdapter } from "@drew-foxall/a2a-ai-sdk-adapter";
import {
  type AgentExecutor,
  DefaultRequestHandler,
  InMemoryTaskStore,
  type TaskStore,
} from "@drew-foxall/a2a-js-sdk/server";
import { A2AHonoApp } from "@drew-foxall/a2a-js-sdk/server/hono";
import { serve } from "@hono/node-server";
import { a2a } from "a2a-ai-provider";
import { generateText } from "ai";
import { Hono } from "hono";
import { loadEnv } from "../../../shared/load-env.js";
import { getModel } from "../../../shared/utils.js";
import { createPlannerAgent, type SendMessageFn } from "./agent.js";
import {
  type AgentDiscoveryConfig,
  AgentRegistry,
  DEFAULT_LOCAL_AGENT_URLS,
} from "./agent-discovery.js";
import { createTravelPlannerCard } from "./card.js";

// Load environment variables
loadEnv(import.meta.url);

// ============================================================================
// Configuration
// ============================================================================

const PORT = 41254;
const HOST = "0.0.0.0";
const BASE_URL = `http://localhost:${PORT}`;

// Specialist agent URLs (base URLs, discovery will fetch Agent Cards)
const WEATHER_AGENT_URL = process.env.WEATHER_AGENT_URL || DEFAULT_LOCAL_AGENT_URLS.weatherAgent;
const AIRBNB_AGENT_URL = process.env.AIRBNB_AGENT_URL || DEFAULT_LOCAL_AGENT_URLS.airbnbAgent;

// ============================================================================
// HTTP-based sendMessage (Local Development)
// ============================================================================

/**
 * Create an HTTP-based sendMessage function using a2a-ai-provider
 *
 * This is the local development implementation that uses standard HTTP
 * to communicate with other agents via the A2A protocol.
 *
 * NOTE: Uses generateText (non-streaming) for agent-to-agent communication.
 * This matches the Python reference implementation which uses a simple
 * request/response pattern for send_message. The orchestrator needs the
 * complete response to decide what to do next (e.g., route to another agent).
 *
 * Streaming to the USER is handled by the A2AAdapter wrapping the ToolLoopAgent.
 */
function createHttpSendMessage(registry: AgentRegistry): SendMessageFn {
  return async (agentName, task, _options) => {
    const agent = registry.getAgent(agentName);
    if (!agent) {
      return `Error: Agent "${agentName}" not found. Available: ${registry.getAgentNames().join(", ")}`;
    }

    try {
      // Use a2a-ai-provider to call the agent as an AI SDK model
      // generateText is correct here - we need the full response for tool execution
      // (Same pattern as Python's await client.send_message())
      const result = await generateText({
        model: a2a(agent.url),
        prompt: task,
      });

      return result.text;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return `Error communicating with ${agent.name}: ${errorMessage}`;
    }
  };
}

// ============================================================================
// HTTP Server (Hono + A2A)
// ============================================================================

async function main() {
  console.log(`
🎭 Travel Planner Orchestrator - Starting...

🔍 Discovering specialist agents...
   - Weather Agent: ${WEATHER_AGENT_URL}
   - Airbnb Agent: ${AIRBNB_AGENT_URL}
`);

  // Build discovery configs
  const discoveryConfigs: AgentDiscoveryConfig[] = [
    {
      url: WEATHER_AGENT_URL,
      fallbackName: "Weather Agent",
      fallbackDescription: "Provides weather forecasts for any location worldwide",
    },
    {
      url: AIRBNB_AGENT_URL,
      fallbackName: "Airbnb Agent",
      fallbackDescription: "Searches for Airbnb accommodations",
    },
  ];

  // Discover agents
  const registry = new AgentRegistry();
  await registry.discoverAgents(discoveryConfigs);

  console.log(`✅ Discovered ${registry.getAllAgents().length} agents:`);
  for (const agent of registry.getAllAgents()) {
    console.log(`   - ${agent.name}: ${agent.description}`);
  }

  // Track active agent state
  let activeAgent: string | null = null;

  // Create the planner agent with HTTP-based sendMessage
  const plannerAgent = createPlannerAgent({
    model: getModel(),
    agentRoster: registry.buildAgentRoster(),
    activeAgent,
    availableAgents: registry.getAgentNames(),
    sendMessage: createHttpSendMessage(registry),
    onActiveAgentChange: (name) => {
      activeAgent = name;
      console.log(`📌 Active agent changed to: ${name}`);
    },
  });

  // Create A2A adapter
  const agentExecutor: AgentExecutor = new A2AAdapter(plannerAgent, {
    mode: "stream",
    workingMessage: "Planning your trip...",
  });

  // Use shared Agent Card from card.ts
  const agentCard = createTravelPlannerCard(BASE_URL);

  const taskStore: TaskStore = new InMemoryTaskStore();
  const requestHandler = new DefaultRequestHandler(agentCard, taskStore, agentExecutor);

  const app = new Hono();
  const appBuilder = new A2AHonoApp(requestHandler);
  appBuilder.setupRoutes(app);

  console.log(`
📍 Port: ${PORT}
🌐 URL: ${BASE_URL}
📋 Agent Card: ${BASE_URL}/.well-known/agent-card.json

🤖 Agent: Travel Planner (Orchestrator)
🔧 Framework: AI SDK v6 (ToolLoopAgent) + a2a-ai-provider + A2A Protocol
🧠 Model: ${process.env.AI_PROVIDER || "openai"} / ${process.env.AI_MODEL || "default"}
🌊 Streaming: ENABLED

✨ Python Pattern Implementation:
   - Dynamic agent discovery (fetches Agent Cards at startup)
   - Single sendMessage tool for routing
   - Active agent state tracking for follow-ups
   - Agent roster injected into prompt

📝 Try it:
   curl -X POST ${BASE_URL}/ \\
     -H "Content-Type: application/json" \\
     -d '{
       "jsonrpc": "2.0",
       "method": "message/send",
       "id": "1",
       "params": {
         "message": {
           "role": "user",
           "messageId": "msg-1",
           "parts": [{"kind": "text", "text": "Plan a trip to Los Angeles"}]
         }
       }
     }'

💡 Examples:
   - "What's the weather in Paris?"
   - "Find accommodations in Tokyo for 3 people"
   - "Plan a trip to New York, June 20-25, 2 adults"

⚠️  Prerequisites:
   Make sure the specialist agents are running:
   1. Weather Agent: ${WEATHER_AGENT_URL}
   2. Airbnb Agent: ${AIRBNB_AGENT_URL}

🚀 Ready to orchestrate travel planning...
`);

  serve({
    fetch: app.fetch,
    port: PORT,
    hostname: HOST,
  });
}

main().catch(console.error);
