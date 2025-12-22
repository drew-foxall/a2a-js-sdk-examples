/**
 * Hello World Agent - Cloudflare Worker
 *
 * Exposes the Hello World agent via the A2A protocol on Cloudflare Workers.
 * This demonstrates the simplest possible A2A agent integration.
 *
 * KEY ARCHITECTURE:
 * - Agent logic is imported from the shared `a2a-agents` package
 * - Worker configuration is framework-agnostic
 * - Hono adapter handles HTTP concerns
 *
 * Deployment:
 *   wrangler deploy
 *
 * Local Development:
 *   wrangler dev
 */

import type { LanguageModel } from "ai";
import type { AgentSkill } from "@drew-foxall/a2a-js-sdk";
import { createHelloWorldAgent } from "a2a-agents";
import {
  buildAgentCard,
  createA2AHonoWorker,
  defineWorkerConfig,
  type BaseWorkerEnv,
} from "a2a-workers-shared";

// ============================================================================
// Skill Definition
// ============================================================================

const helloWorldSkill: AgentSkill = {
  id: "hello_world",
  name: "Returns hello world",
  description: "A simple greeting agent that responds with friendly hello messages",
  tags: ["hello world", "greeting", "simple"],
  examples: ["hi", "hello world", "greet me", "say hello"],
};

// ============================================================================
// Worker Configuration
// ============================================================================

const config = defineWorkerConfig<BaseWorkerEnv>({
  agentName: "Hello World Agent",

  createAgent: (model: LanguageModel) => createHelloWorldAgent(model),

  createAgentCard: (baseUrl: string) =>
    buildAgentCard(baseUrl, {
      name: "Hello World Agent",
      description: "The simplest possible A2A agent - responds with friendly greetings",
      skills: [helloWorldSkill],
      capabilities: {
        // This agent is designed for immediate, self-contained responses.
        // It returns A2A `Message` responses by default (no task lifecycle / streaming).
        streaming: false,
        // No state transition history needed for Message responses
        stateTransitionHistory: false,
      },
    }),

  adapterOptions: {
    mode: "generate",
    // Hello World always responds with Message (simple, immediate)
    // This is a stateless response - no task lifecycle tracking needed
    selectResponseType: () => "message",
    includeHistory: false,
  },
});

// ============================================================================
// Export Hono Application
// ============================================================================

export default createA2AHonoWorker(config);
