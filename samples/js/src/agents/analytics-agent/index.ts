/**
 * Analytics Agent - A2A Server
 *
 * Exposes the Analytics agent via the A2A protocol using Hono.
 * Demonstrates chart generation and image artifact streaming.
 *
 * Port: 41247 (by default)
 *
 * Usage:
 *   pnpm agents:analytics-agent
 *   # or
 *   cd samples/js
 *   pnpm tsx src/agents/analytics-agent/index.ts
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
import { createAnalyticsAgent } from "./agent.js";
import { generateChartFromPrompt } from "./tools.js";

// ============================================================================
// Configuration
// ============================================================================

const PORT = 41247;
const HOST = "0.0.0.0";
const BASE_URL = `http://localhost:${PORT}`;

// ============================================================================
// Agent Card Configuration
// ============================================================================

const chartGenerationSkill: AgentSkill = {
  id: "chart_generator",
  name: "Chart Generator",
  description: "Generate bar charts from CSV-like data passed in natural language",
  tags: ["chart", "visualization", "image", "analytics"],
  examples: [
    "Generate a chart of revenue: Jan,$1000 Feb,$2000 Mar,$1500",
    "Create a chart: A:100, B:200, C:300",
    "Make a bar chart showing sales: Q1,5000 Q2,7000 Q3,6500 Q4,8000",
  ],
};

const agentCard: AgentCard = {
  name: "Analytics Agent",
  description:
    "Generate bar charts from structured CSV-like data input. Returns charts as PNG images.",
  url: `${BASE_URL}/.well-known/agent-card.json`,
  version: "1.0.0",
  protocolVersion: "1.0",
  defaultInputModes: ["text"],
  defaultOutputModes: ["text", "image/png"],
  capabilities: {
    streaming: true,
    statefulness: "stateless",
  },
  skills: [chartGenerationSkill],
};

// ============================================================================
// Agent Initialization
// ============================================================================

const model = getModel();
const agent = createAnalyticsAgent(model);

// ============================================================================
// Artifact Parsing Function
// ============================================================================

/**
 * Parse artifacts from the user's prompt
 *
 * This function extracts chart data from the prompt and generates
 * a PNG chart image as an artifact.
 *
 * The A2AAdapter will automatically:
 * 1. Use streaming mode (because parseArtifacts is configured)
 * 2. Call this function with the original prompt
 * 3. Emit each artifact via TaskArtifactUpdateEvent
 */
async function parseChartArtifacts(prompt: string): Promise<Artifact[]> {
  try {
    // Generate chart from prompt
    const chart = await generateChartFromPrompt(prompt);

    // Return as A2A artifact
    return [
      {
        artifactId: chart.id,
        name: chart.name,
        kind: "image/png",
        data: chart.base64, // Base64-encoded PNG
      },
    ];
  } catch (error) {
    console.error("Error generating chart:", error);
    return []; // Return empty array on error
  }
}

// ============================================================================
// A2A Protocol Integration
// ============================================================================

const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
  // Enable artifact parsing (triggers streaming mode automatically)
  parseArtifacts: parseChartArtifacts,

  // Optional: Customize working message
  workingMessage: "Generating chart...",

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
📊 Analytics Agent - A2A Server Starting...

📍 Port: ${PORT}
🌐 URL: ${BASE_URL}
📋 Agent Card: ${BASE_URL}/.well-known/agent-card.json

🤖 Agent: Analytics Agent (Chart Generation + Artifacts)
🔧 Framework: AI SDK v6 + Hono + A2A Protocol
🧠 Model: ${process.env.AI_PROVIDER || "openai"} / ${process.env.AI_MODEL || "default"}

✨ This agent demonstrates:
   - Chart generation (Chart.js + node-canvas)
   - Image artifact creation (PNG)
   - Streaming artifact emission
   - Data parsing from natural language

📈 Chart Features:
   - Bar charts
   - Multiple input formats (CSV, key:value, key,value)
   - Automatic data parsing
   - PNG output as artifacts

📝 Try it:
   curl -X POST ${BASE_URL}/message/send \\
     -H "Content-Type: application/json" \\
     -d '{"message": {"role": "user", "parts": [{"kind": "text", "text": "Generate a chart of revenue: Jan,$1000 Feb,$2000 Mar,$1500"}]}}'

🚀 Ready to generate charts...
`);

serve({
  fetch: app.fetch,
  port: PORT,
  hostname: HOST,
});
