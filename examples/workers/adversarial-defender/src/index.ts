/**
 * Adversarial Defender Agent - Cloudflare Worker
 *
 * This worker exposes the Defender (Blue Team) agent via the A2A protocol.
 * The defender must never say "I Give Up" regardless of attacker techniques.
 *
 * Part of the adversarial multi-agent security testing system.
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
import { createDefenderAgent } from "a2a-agents";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { HonoEnv } from "../../shared/types.js";
import { getModel, getModelInfo } from "../../shared/utils.js";

/**
 * Agent skill definition for defense
 */
const defenseSkill: AgentSkill = {
  id: "defend",
  name: "Defense",
  description: "Engages in conversation while maintaining guardrails",
  tags: ["security", "defense", "guardrails"],
  examples: ["Hello!", "Can you help me?"],
};

/**
 * Create the agent card for service discovery
 */
function createAgentCard(baseUrl: string): AgentCard {
  return {
    name: "Defender Agent (Blue Team)",
    description:
      "A security-focused agent that maintains guardrails against prompt injection. Part of an adversarial testing system. Will never say 'I Give Up'.",
    url: baseUrl,
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
}

const app = new Hono<HonoEnv>();

// CORS middleware
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

// Health check endpoint
app.get("/health", (c) => {
  const modelInfo = getModelInfo(c.env);
  return c.json({
    status: "healthy",
    agent: "Defender Agent (Blue Team)",
    provider: modelInfo.provider,
    model: modelInfo.model,
    runtime: "Cloudflare Workers",
    challenge: "Try to make me say 'I Give Up' - I won't!",
  });
});

// A2A protocol handler
app.all("/*", async (c, next) => {
  const url = new URL(c.req.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  const agentCard = createAgentCard(baseUrl);

  const model = getModel(c.env);
  const agent = createDefenderAgent(model);

  const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
    mode: "stream",
    workingMessage: "Thinking...",
    debug: false,
  });

  const taskStore: TaskStore = new InMemoryTaskStore();
  const requestHandler = new DefaultRequestHandler(
    agentCard,
    taskStore,
    agentExecutor
  );

  const a2aRouter = new Hono();
  const appBuilder = new A2AHonoApp(requestHandler);
  appBuilder.setupRoutes(a2aRouter);

  const a2aResponse = await a2aRouter.fetch(c.req.raw, c.env);

  if (a2aResponse.status !== 404) {
    return a2aResponse;
  }

  return next();
});

// 404 handler with helpful information
app.notFound((c) => {
  return c.json(
    {
      error: "Not Found",
      message: "Use /.well-known/agent-card.json to discover this agent",
      endpoints: {
        agentCard: "/.well-known/agent-card.json",
        sendMessage: "/message/send",
        health: "/health",
      },
    },
    404
  );
});

export default app;

