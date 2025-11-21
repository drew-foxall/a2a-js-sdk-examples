/**
 * Currency Agent - A2A Server
 *
 * Exposes the Currency agent via the A2A protocol using Hono.
 * Demonstrates multi-turn conversation and currency conversion.
 *
 * Port: 41248 (by default)
 *
 * Usage:
 *   pnpm agents:currency-agent
 *   # or
 *   cd samples/js
 *   pnpm tsx src/agents/currency-agent/index.ts
 */

import type { AgentCard, AgentSkill, Artifact } from "@drew-foxall/a2a-js-sdk";
import {
  type AgentExecutor,
  DefaultRequestHandler,
  InMemoryTaskStore,
  type TaskStore,
} from "@drew-foxall/a2a-js-sdk/server";
import { A2AHonoApp } from "@drew-foxall/a2a-js-sdk/server/hono";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { A2AAdapter } from "../../shared/a2a-adapter.js";
import { getModel } from "../../shared/utils.js";
import { createCurrencyAgent } from "./agent.js";

// ============================================================================
// Configuration
// ============================================================================

const PORT = 41248;
const HOST = "0.0.0.0";
const BASE_URL = `http://localhost:${PORT}`;

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

const agentCard: AgentCard = {
  name: "Currency Agent",
  description: "Helps with exchange rates for currencies using Frankfurter API",
  url: `${BASE_URL}/.well-known/agent-card.json`,
  version: "1.0.0",
  protocolVersion: "0.3.0",
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
  capabilities: {
    streaming: true,
    pushNotifications: false,
    stateTransitionHistory: true, // Maintains conversation context
  },
  skills: [currencyConversionSkill],
};

// ============================================================================
// Agent Initialization
// ============================================================================

const model = getModel();
const agent = createCurrencyAgent(model);

// ============================================================================
// Custom State Parsing for Multi-Turn Conversation
// ============================================================================

/**
 * Parse the agent's response to determine task state.
 *
 * This function detects:
 * - "input-required" - Agent is asking for more information
 * - "completed" - Agent has provided the final answer
 *
 * The Python LangGraph version uses structured output (ResponseFormat)
 * to explicitly indicate the status. In AI SDK, we parse the text response
 * to infer the state.
 */
function parseTaskState(response: string): "input-required" | "completed" {
  const lowerResponse = response.toLowerCase();

  // Detect questions or requests for more information
  const askingForInfo =
    lowerResponse.includes("please specify") ||
    lowerResponse.includes("which currency") ||
    lowerResponse.includes("what currency") ||
    lowerResponse.includes("need to know") ||
    lowerResponse.includes("could you specify") ||
    lowerResponse.includes("can you specify") ||
    (lowerResponse.includes("?") && lowerResponse.length < 200); // Short questions

  if (askingForInfo) {
    return "input-required";
  }

  // Default to completed if providing information
  return "completed";
}

// ============================================================================
// Artifact Parsing for Conversion Results
// ============================================================================

/**
 * Generate conversion artifacts from the agent's response.
 *
 * Extracts the conversion result and creates a text artifact.
 * This mimics the Python version's behavior of creating a
 * "conversion_result" artifact.
 *
 * Uses async artifact generation (generateArtifacts) instead of
 * parseArtifacts since this runs after the response is complete.
 */
async function generateConversionArtifacts(context: {
  taskId: string;
  contextId: string;
  responseText: string;
}): Promise<Artifact[]> {
  // Only create artifact if task is completed (not asking for input)
  const state = parseTaskState(context.responseText);
  if (state === "input-required") {
    return [];
  }

  // Create artifact with the conversion result
  return [
    {
      artifactId: `conversion-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      name: "conversion_result",
      parts: [
        {
          kind: "text" as const,
          text: context.responseText,
        },
      ],
    },
  ];
}

// ============================================================================
// A2A Protocol Integration
// ============================================================================

const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
  mode: "stream", // Real-time text streaming
  // Use generateArtifacts for async artifact creation after streaming completes
  generateArtifacts: generateConversionArtifacts,

  // Custom state parser for multi-turn conversation
  parseTaskState,

  // Status update message during processing
  workingMessage: "Looking up exchange rates...",

  // Optional: Enable debug logging
  debug: false,
});

const taskStore: TaskStore = new InMemoryTaskStore();

const requestHandler = new DefaultRequestHandler(agentCard, taskStore, agentExecutor);

// ============================================================================
// HTTP Server (Hono + A2A)
// ============================================================================

const app = new Hono();
const appBuilder = new A2AHonoApp(requestHandler);
appBuilder.setupRoutes(app);

// ============================================================================
// Start Server
// ============================================================================

console.log(`
💱 Currency Agent - A2A Server Starting...

📍 Port: ${PORT}
🌐 URL: ${BASE_URL}
📋 Agent Card: ${BASE_URL}/.well-known/agent-card.json

🤖 Agent: Currency Agent (Multi-Turn Conversation)
🔧 Framework: AI SDK v6 + Hono + A2A Protocol
🧠 Model: ${process.env.AI_PROVIDER || "openai"} / ${process.env.AI_MODEL || "default"}

✨ This agent demonstrates:
   - Multi-turn conversations
   - Currency conversion via Frankfurter API
   - Asking for missing information
   - Conversation memory (contextId-based)
   - Streaming with status updates

💰 Currency Features:
   - Real-time exchange rates
   - Support for 30+ currencies
   - No API key required (Frankfurter API)
   - Historical rates (optional)

📝 Try it:
   # Complete request
   curl -X POST ${BASE_URL}/message/send \\
     -H "Content-Type: application/json" \\
     -d '{"message": {"role": "user", "parts": [{"kind": "text", "text": "What is 100 USD in EUR?"}]}}'

   # Incomplete request (triggers multi-turn)
   curl -X POST ${BASE_URL}/message/send \\
     -H "Content-Type: application/json" \\
     -d '{"message": {"role": "user", "parts": [{"kind": "text", "text": "What is the exchange rate for 1 USD?"}]}}'

🚀 Ready to convert currencies...
`);

serve({
  fetch: app.fetch,
  port: PORT,
  hostname: HOST,
});
