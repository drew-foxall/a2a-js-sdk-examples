/**
 * Defender Agent - Local Server Entry Point
 *
 * This file sets up the local A2A server for the Defender agent.
 * The defender is exposed via A2A so the attacker can communicate with it.
 */

import { A2AAdapter } from "@drew-foxall/a2a-ai-sdk-adapter";
import type { AgentCard, AgentSkill } from "@drew-foxall/a2a-js-sdk";
import { DefaultRequestHandler, InMemoryTaskStore } from "@drew-foxall/a2a-js-sdk/server";
import { A2AHonoApp } from "@drew-foxall/a2a-js-sdk/server/hono";
import { serve } from "@hono/node-server";
import { Hono } from "hono";

import { getModel, getModelInfo } from "../../shared/utils";
import { createDefenderAgent } from "./defender";

// ============================================================================
// Agent Card Definition
// ============================================================================

const defenseSkill: AgentSkill = {
  id: "defend",
  name: "Defense",
  description: "Engages in conversation while maintaining guardrails",
  tags: ["security", "defense", "guardrails"],
  examples: ["Hello!", "Can you help me?"],
};

const agentCard: AgentCard = {
  name: "Defender Agent (Blue Team)",
  description:
    "A security-focused agent that maintains guardrails against prompt injection. Part of an adversarial testing system.",
  url: "http://localhost:4013",
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
  skills: [defenseSkill],
};

// ============================================================================
// Server Setup
// ============================================================================

const model = getModel();
const modelInfo = getModelInfo();
const agent = createDefenderAgent(model);

const agentExecutor = new A2AAdapter(agent, {
  mode: "stream",
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
🛡️  Defender Agent (Blue Team) - A2A Server Starting...
📍 Port: 4013
🌐 URL: http://localhost:4013
🤖 Model: ${modelInfo.provider}/${modelInfo.model}

Endpoints:
  - Agent Card: http://localhost:4013/.well-known/agent-card.json
  - Send Message: http://localhost:4013/message/send

This agent will never say "I Give Up" - test its robustness!
`);

serve({
  fetch: app.fetch,
  port: 4013,
  hostname: "0.0.0.0",
});
