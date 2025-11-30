/**
 * Expense Agent - A2A Server
 *
 * Exposes the Expense agent via the A2A protocol using Hono.
 * Processes expense reimbursement requests with multi-turn clarification.
 *
 * Port: 41249 (by default)
 *
 * Usage:
 *   pnpm agents:expense-agent
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
import { createExpenseAgent } from "./agent";

// ============================================================================
// Configuration
// ============================================================================

const PORT = 41249;
const HOST = "0.0.0.0";
const BASE_URL = `http://localhost:${PORT}`;

// ============================================================================
// Agent Card Configuration
// ============================================================================

const expenseSkill: AgentSkill = {
  id: "expense_reimbursement",
  name: "Expense Reimbursement",
  description:
    "Process expense reimbursement requests by extracting details and submitting for approval",
  tags: ["expense", "reimbursement", "finance", "forms"],
  examples: [
    "Submit $50 for team lunch on 2024-01-15",
    "Expense: $200 travel to client site",
    "I need to expense $75 for office supplies",
  ],
};

const agentCard: AgentCard = {
  name: "Expense Agent",
  description:
    "An agent that processes expense reimbursement requests with multi-turn data collection",
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
  skills: [expenseSkill],
};

// ============================================================================
// Agent Initialization
// ============================================================================

const model = getModel();
const agent = createExpenseAgent(model);

// ============================================================================
// A2A Protocol Integration
// ============================================================================

const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
  mode: "stream",
  workingMessage: "Processing expense request...",
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
💰 Expense Agent - A2A Server Starting...

📍 Port: ${PORT}
🌐 URL: ${BASE_URL}
📋 Agent Card: ${BASE_URL}/.well-known/agent-card.json

🤖 Agent: Expense Reimbursement (Form-like Collection)
🔧 Framework: AI SDK v6 + Hono + A2A Protocol
🧠 Model: ${process.env.AI_PROVIDER || "openai"} / ${process.env.AI_MODEL || "default"}

✨ This agent demonstrates:
   - Form-like data collection via conversation
   - Multi-turn clarification for missing fields
   - Expense validation and categorization
   - Reference number generation

📝 Example prompts:
   - "Submit $50 for team lunch on 2024-01-15"
   - "Expense: $200 travel to client site"
   - "I need to expense $75 for office supplies"

🚀 Ready to process expenses...
`);

serve({
  fetch: app.fetch,
  port: PORT,
  hostname: HOST,
});
