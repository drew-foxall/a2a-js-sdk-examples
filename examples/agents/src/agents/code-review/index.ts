/**
 * Code Review Agent - Local Server Entry Point
 *
 * This file sets up the local A2A server for the Code Review agent.
 * It demonstrates how to expose an AI SDK agent via the A2A protocol.
 */

import { A2AAdapter } from "@drew-foxall/a2a-ai-sdk-adapter";
import type { AgentCard, AgentSkill } from "@drew-foxall/a2a-js-sdk";
import { DefaultRequestHandler, InMemoryTaskStore } from "@drew-foxall/a2a-js-sdk/server";
import { A2AHonoApp } from "@drew-foxall/a2a-js-sdk/server/hono";
import { serve } from "@hono/node-server";
import { Hono } from "hono";

import { getModel, getModelInfo } from "../../shared/utils";
import { createCodeReviewAgent } from "./agent";

// ============================================================================
// Agent Card Definition
// ============================================================================

const codeReviewSkill: AgentSkill = {
  id: "code_review",
  name: "Code Review",
  description:
    "Analyzes JavaScript/TypeScript code for issues, security vulnerabilities, and best practices",
  tags: ["code", "review", "security", "typescript", "javascript"],
  examples: [
    "Review this JavaScript function for issues",
    "Check this TypeScript code for security vulnerabilities",
    "Analyze this code for best practices",
  ],
};

const agentCard: AgentCard = {
  name: "Code Review Agent",
  description:
    "An AI agent that reviews JavaScript/TypeScript code for issues, security vulnerabilities, and best practices. Provides structured feedback with severity levels and improvement suggestions.",
  url: "http://localhost:4011",
  protocolVersion: "0.3.0",
  version: "1.0.0",
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
  preferredTransport: "JSONRPC",
  capabilities: {
    streaming: true,
    pushNotifications: false,
    stateTransitionHistory: false,
  },
  skills: [codeReviewSkill],
};

// ============================================================================
// Server Setup
// ============================================================================

const model = getModel();
const modelInfo = getModelInfo();
const agent = createCodeReviewAgent(model);

const agentExecutor = new A2AAdapter(agent, {
  mode: "stream",
  workingMessage: "Reviewing code...",
  debug: false,
});

const taskStore = new InMemoryTaskStore();
const requestHandler = new DefaultRequestHandler(agentCard, taskStore, agentExecutor);

const app = new Hono();
const appBuilder = new A2AHonoApp(requestHandler);
appBuilder.setupRoutes(app);

// ============================================================================
// Start Server
// ============================================================================

console.log(`
📝 Code Review Agent - A2A Server Starting...
📍 Port: 4011
🌐 URL: http://localhost:4011
🤖 Model: ${modelInfo.provider}/${modelInfo.model}

Endpoints:
  - Agent Card: http://localhost:4011/.well-known/agent-card.json
  - Send Message: http://localhost:4011/message/send

Skills:
  - ${codeReviewSkill.name}: ${codeReviewSkill.description}
`);

serve({
  fetch: app.fetch,
  port: 4011,
  hostname: "0.0.0.0",
});
