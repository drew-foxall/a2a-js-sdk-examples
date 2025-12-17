/**
 * Image Generator Agent - Cloudflare Worker
 *
 * Exposes the Image Generator agent via the A2A protocol on Cloudflare Workers.
 * Demonstrates external API integration (OpenAI DALL-E) and binary artifact handling.
 *
 * KEY ARCHITECTURE:
 * - Agent logic is imported from the shared `a2a-agents` package
 * - Redis task store for persistent state (long-running operations)
 * - OpenAI API key passed from worker environment
 *
 * Deployment:
 *   wrangler deploy
 *
 * Local Development:
 *   wrangler dev
 */

import type { LanguageModel } from "ai";
import type { AgentSkill } from "@drew-foxall/a2a-js-sdk";
import { createImageGeneratorAgent } from "a2a-agents";
import {
  buildAgentCard,
  createA2AHonoWorker,
  defineWorkerConfig,
  isRedisConfigured,
  type WorkerEnvWithRedis,
} from "a2a-workers-shared";

// ============================================================================
// Skill Definition
// ============================================================================

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

// ============================================================================
// Worker Configuration
// ============================================================================

const config = defineWorkerConfig<WorkerEnvWithRedis>({
  agentName: "Image Generator Agent",

  createAgent: (model: LanguageModel, env: WorkerEnvWithRedis) =>
    createImageGeneratorAgent(model, env.OPENAI_API_KEY),

  createAgentCard: (baseUrl: string) =>
    buildAgentCard(baseUrl, {
      name: "Image Generator Agent",
      description:
        "An AI agent that generates images from text descriptions using DALL-E 3. Supports multiple sizes (1024x1024, 1792x1024, 1024x1792), quality levels (standard, HD), and styles (vivid, natural).",
      skills: [imageGenerationSkill],
    }),

  adapterOptions: {
    mode: "stream",
    workingMessage: "Generating image...",
  },

  taskStore: {
    type: "redis",
    prefix: "a2a:image:",
  },

  healthCheckExtras: (env: WorkerEnvWithRedis) => ({
    features: {
      persistentStorage: isRedisConfigured(env),
      storageType: isRedisConfigured(env) ? "upstash-redis" : "in-memory",
    },
  }),
});

// ============================================================================
// Export Hono Application
// ============================================================================

export default createA2AHonoWorker(config);
