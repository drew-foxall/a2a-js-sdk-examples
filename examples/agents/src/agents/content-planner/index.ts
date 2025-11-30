/**
 * Content Planner Agent - A2A Server
 *
 * Exposes the Content Planner agent via the A2A protocol using Hono.
 * Creates detailed content outlines from high-level descriptions.
 *
 * Port: 41247 (by default)
 *
 * Usage:
 *   pnpm agents:content-planner
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
import { createContentPlannerAgent } from "./agent";

// ============================================================================
// Configuration
// ============================================================================

const PORT = 41247;
const HOST = "0.0.0.0";
const BASE_URL = `http://localhost:${PORT}`;

// ============================================================================
// Agent Card Configuration
// ============================================================================

const contentPlanningSkill: AgentSkill = {
  id: "content_planning",
  name: "Content Planning",
  description:
    "Creates detailed content outlines with sections, key points, and word count recommendations",
  tags: ["content", "planning", "outline", "writing"],
  examples: [
    "Create an outline for a blog post about AI agents",
    "Plan a tutorial on building REST APIs",
    "Outline a guide to TypeScript best practices",
  ],
};

const agentCard: AgentCard = {
  name: "Content Planner",
  description:
    "An agent that creates detailed, actionable content outlines from high-level descriptions",
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
  skills: [contentPlanningSkill],
};

// ============================================================================
// Agent Initialization
// ============================================================================

const model = getModel();
const agent = createContentPlannerAgent(model);

// ============================================================================
// A2A Protocol Integration
// ============================================================================

const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
  mode: "stream",
  workingMessage: "Planning content structure...",
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
📝 Content Planner Agent - A2A Server Starting...

📍 Port: ${PORT}
🌐 URL: ${BASE_URL}
📋 Agent Card: ${BASE_URL}/.well-known/agent-card.json

🤖 Agent: Content Planner (Outline Generation)
🔧 Framework: AI SDK v6 + Hono + A2A Protocol
🧠 Model: ${process.env.AI_PROVIDER || "openai"} / ${process.env.AI_MODEL || "default"}

✨ This agent demonstrates:
   - Structured content planning
   - Audience-aware outline generation
   - SEO-friendly structure suggestions
   - Part of multi-agent content workflow

📝 Example prompts:
   - "Create an outline for a blog post about AI agents in enterprise"
   - "Plan a tutorial on building REST APIs with TypeScript"
   - "Outline a comprehensive guide to microservices architecture"

🚀 Ready to plan content...
`);

serve({
  fetch: app.fetch,
  port: PORT,
  hostname: HOST,
});
