/**
 * Image Generator Agent - A2A Server
 *
 * Exposes the Image Generator agent via the A2A protocol using Hono.
 * Generates images from text descriptions using DALL-E.
 *
 * Port: 41250 (by default)
 *
 * Usage:
 *   pnpm agents:image-generator
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
import { createImageGeneratorAgent } from "./agent";

// ============================================================================
// Configuration
// ============================================================================

const PORT = 41250;
const HOST = "0.0.0.0";
const BASE_URL = `http://localhost:${PORT}`;

// ============================================================================
// Agent Card Configuration
// ============================================================================

const imageGenSkill: AgentSkill = {
  id: "image_generation",
  name: "Image Generation",
  description: "Generate images from text descriptions using DALL-E",
  tags: ["image", "generation", "dall-e", "creative"],
  examples: [
    "Generate an image of a sunset over mountains",
    "Create a photorealistic cat wearing a hat",
    "Draw a futuristic city skyline at night",
  ],
};

const agentCard: AgentCard = {
  name: "Image Generator",
  description: "An agent that generates images from text descriptions using DALL-E",
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
  skills: [imageGenSkill],
};

// ============================================================================
// Agent Initialization
// ============================================================================

const model = getModel();
const agent = createImageGeneratorAgent(model);

// ============================================================================
// A2A Protocol Integration
// ============================================================================

const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
  mode: "stream",
  workingMessage: "Generating image...",
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
🎨 Image Generator Agent - A2A Server Starting...

📍 Port: ${PORT}
🌐 URL: ${BASE_URL}
📋 Agent Card: ${BASE_URL}/.well-known/agent-card.json

🤖 Agent: Image Generator (DALL-E)
🔧 Framework: AI SDK v6 + Hono + A2A Protocol
🧠 Model: ${process.env.AI_PROVIDER || "openai"} / ${process.env.AI_MODEL || "default"}

✨ This agent demonstrates:
   - DALL-E image generation
   - External API integration
   - Creative prompt handling

📝 Example prompts:
   - "Generate an image of a sunset over mountains"
   - "Create a photorealistic cat wearing a hat"
   - "Draw a futuristic city skyline at night"

⚠️  Requires: OPENAI_API_KEY with DALL-E access

🚀 Ready to generate images...
`);

serve({
  fetch: app.fetch,
  port: PORT,
  hostname: HOST,
});
