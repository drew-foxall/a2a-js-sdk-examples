/**
 * Contact Extractor Agent - A2A Server
 *
 * Exposes the Contact Extractor agent via the A2A protocol using Hono.
 * Extracts structured contact information from unstructured text.
 *
 * Port: 41248 (by default)
 *
 * Usage:
 *   pnpm agents:contact-extractor
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
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { getModel } from "../../shared/utils";
import { createContactExtractorAgent } from "./agent";

// ============================================================================
// Configuration
// ============================================================================

const PORT = 41248;
const HOST = "0.0.0.0";
const BASE_URL = `http://localhost:${PORT}`;

// ============================================================================
// Agent Card Configuration
// ============================================================================

const extractionSkill: AgentSkill = {
  id: "contact_extraction",
  name: "Contact Extraction",
  description: "Extract structured contact information (name, email, phone) from unstructured text",
  tags: ["extraction", "contact", "structured-data", "parsing"],
  examples: [
    "My name is John Doe, email john@example.com, phone 555-1234",
    "Contact Sarah at sarah@corp.com",
    "Reach me at (555) 987-6543, I'm Mike Johnson from Acme Inc",
  ],
};

const agentCard: AgentCard = {
  name: "Contact Extractor",
  description:
    "An agent that extracts structured contact information from unstructured text with multi-turn clarification",
  url: BASE_URL,
  version: "1.0.0",
  protocolVersion: "0.3.0",
  preferredTransport: "JSONRPC",
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
  capabilities: {
    streaming: true,
    pushNotifications: false,
    stateTransitionHistory: false,
  },
  skills: [extractionSkill],
};

// ============================================================================
// Agent Initialization
// ============================================================================

const model = getModel();
const agent = createContactExtractorAgent(model);

// ============================================================================
// A2A Protocol Integration
// ============================================================================

const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
  mode: "stream",
  workingMessage: "Extracting contact information...",
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
📇 Contact Extractor Agent - A2A Server Starting...

📍 Port: ${PORT}
🌐 URL: ${BASE_URL}
📋 Agent Card: ${BASE_URL}/.well-known/agent-card.json

🤖 Agent: Contact Extractor (Structured Data)
🔧 Framework: AI SDK v6 + Hono + A2A Protocol
🧠 Model: ${process.env.AI_PROVIDER || "openai"} / ${process.env.AI_MODEL || "default"}

✨ This agent demonstrates:
   - Structured data extraction
   - Multi-turn clarification for missing fields
   - Phone number standardization
   - Email validation

📝 Example prompts:
   - "My name is John Doe, email john@example.com, phone 555-1234"
   - "Contact Sarah at sarah@corp.com" (will ask for phone)
   - "Reach me at (555) 987-6543, I'm Mike Johnson from Acme Inc"

🚀 Ready to extract contacts...
`);

serve({
  fetch: app.fetch,
  port: PORT,
  hostname: HOST,
});
