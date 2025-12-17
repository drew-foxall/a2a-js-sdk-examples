/**
 * Dice Agent - Cloudflare Worker
 *
 * Exposes the Dice agent via the A2A protocol on Cloudflare Workers.
 * Demonstrates tool usage with pure computational functions.
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
import { createDiceAgent } from "a2a-agents";
import {
  buildAgentCard,
  createA2AHonoWorker,
  defineWorkerConfig,
  type BaseWorkerEnv,
} from "a2a-workers-shared";

// ============================================================================
// Skill Definitions
// ============================================================================

const rollDiceSkill: AgentSkill = {
  id: "f56cab88-3fe9-47ec-ba6e-86a13c9f1f74",
  name: "Roll Dice",
  description: "Rolls an N-sided dice and returns the result. By default uses a 6-sided dice.",
  tags: ["dice", "random", "game"],
  examples: ["Can you roll an 11-sided dice?", "Roll a 20-sided die", "Roll 2d6"],
};

const checkPrimeSkill: AgentSkill = {
  id: "33856129-d686-4a54-9c6e-fffffec3561b",
  name: "Prime Detector",
  description: "Determines which numbers from a list are prime numbers.",
  tags: ["prime", "math", "numbers"],
  examples: [
    "Which of these are prime numbers: 1, 4, 6, 7",
    "Is 17 a prime number?",
    "Check if 2, 3, 5, 7 are prime",
  ],
};

// ============================================================================
// Worker Configuration
// ============================================================================

const config = defineWorkerConfig<BaseWorkerEnv>({
  agentName: "Dice Agent",

  createAgent: (model: LanguageModel) => createDiceAgent(model),

  createAgentCard: (baseUrl: string) =>
    buildAgentCard(baseUrl, {
      name: "Dice Agent",
      description: "An agent that can roll arbitrary dice and answer if numbers are prime",
      skills: [rollDiceSkill, checkPrimeSkill],
    }),

  adapterOptions: {
    mode: "generate",
    workingMessage: "Rolling dice...",
  },
});

// ============================================================================
// Export Hono Application
// ============================================================================

export default createA2AHonoWorker(config);
