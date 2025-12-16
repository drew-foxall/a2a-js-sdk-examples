/**
 * Code Review Agent - Cloudflare Worker
 *
 * This worker exposes the Code Review agent via the A2A protocol.
 * It demonstrates:
 * - Code analysis tools
 * - Security scanning
 * - Best practice validation
 */

import { A2AAdapter } from "@drew-foxall/a2a-ai-sdk-adapter";
import type { AgentCard, AgentSkill } from "@drew-foxall/a2a-js-sdk";
import {
  type AgentExecutor,
  DefaultRequestHandler,
  InMemoryTaskStore,
  type TaskStore,
} from "@drew-foxall/a2a-js-sdk/server";
import { A2AHonoApp, ConsoleLogger } from "@drew-foxall/a2a-js-sdk/server/hono";
import { createCodeReviewAgent } from "a2a-agents";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { HonoEnv } from "../../shared/types.js";
import { getModel, getModelInfo } from "../../shared/utils.js";

/**
 * Agent skill definition for code review
 */
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

/**
 * Create the agent card for service discovery
 */
function createAgentCard(baseUrl: string): AgentCard {
  return {
    name: "Code Review Agent",
    description:
      "An AI agent that reviews JavaScript/TypeScript code for issues, security vulnerabilities, and best practices. Provides structured feedback with severity levels and improvement suggestions.",
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
    skills: [codeReviewSkill],
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
    agent: "Code Review Agent",
    provider: modelInfo.provider,
    model: modelInfo.model,
    runtime: "Cloudflare Workers",
  });
});

// A2A protocol handler
app.all("/*", async (c, next) => {
  const url = new URL(c.req.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  const agentCard = createAgentCard(baseUrl);

  const model = getModel(c.env);
  const agent = createCodeReviewAgent(model);

  const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
    mode: "stream",
    workingMessage: "Reviewing code...",
    debug: false,
  });

  const taskStore: TaskStore = new InMemoryTaskStore();
  const requestHandler = new DefaultRequestHandler(
    agentCard,
    taskStore,
    agentExecutor
  );

  const a2aRouter = new Hono();
  const logger = ConsoleLogger.create();
  const appBuilder = new A2AHonoApp(requestHandler, { logger });
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

