/**
 * Image Generator Agent - Cloudflare Worker
 *
 * This worker exposes the Image Generator agent via the A2A protocol.
 * It demonstrates:
 * - External API integration (OpenAI DALL-E)
 * - Binary artifact handling
 * - Creative prompt enhancement
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
import { createImageGeneratorAgent } from "a2a-agents";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { HonoEnv } from "../../shared/types.js";
import { getModel, getModelInfo } from "../../shared/utils.js";

/**
 * Agent skill definition for image generation
 */
const imageGenerationSkill: AgentSkill = {
  id: "image_generation",
  name: "Image Generation",
  description:
    "Generates images from text descriptions using DALL-E 3. Supports various sizes, quality levels, and styles.",
  tags: ["image", "generation", "dall-e", "creative", "art"],
  examples: [
    "Generate an image of a sunset over mountains",
    "Create a photorealistic image of a cat wearing a hat",
    "Make an HD image of a futuristic cityscape in vivid style",
    "Generate a natural-style portrait of a person reading",
  ],
};

/**
 * Create the agent card for service discovery
 */
function createAgentCard(baseUrl: string): AgentCard {
  return {
    name: "Image Generator Agent",
    description:
      "An AI agent that generates images from text descriptions using DALL-E 3. Supports multiple sizes (1024x1024, 1792x1024, 1024x1792), quality levels (standard, HD), and styles (vivid, natural).",
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
    skills: [imageGenerationSkill],
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
    agent: "Image Generator Agent",
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

  // Pass OPENAI_API_KEY from worker environment to the agent
  const agent = createImageGeneratorAgent(model, c.env.OPENAI_API_KEY);

  const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
    mode: "stream",
    workingMessage: "Generating image...",
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

