/**
 * Content Planner Agent - Cloudflare Worker
 *
 * Exposes the Content Planner agent via the A2A protocol on Cloudflare Workers.
 * Creates detailed content outlines from high-level descriptions.
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
import { createContentPlannerAgent } from "a2a-agents";
import {
  buildAgentCard,
  createA2AHonoWorker,
  defineWorkerConfig,
  type BaseWorkerEnv,
} from "a2a-workers-shared";

// ============================================================================
// Skill Definition
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

// ============================================================================
// Worker Configuration
// ============================================================================

const config = defineWorkerConfig<BaseWorkerEnv>({
  agentName: "Content Planner",

  createAgent: (model: LanguageModel) => createContentPlannerAgent(model),

  createAgentCard: (baseUrl: string) =>
    buildAgentCard(baseUrl, {
      name: "Content Planner",
      description:
        "An agent that creates detailed, actionable content outlines from high-level descriptions",
      skills: [contentPlanningSkill],
    }),

  adapterOptions: {
    mode: "stream",
    workingMessage: "Planning content structure...",
  },
});

// ============================================================================
// Export Hono Application
// ============================================================================

export default createA2AHonoWorker(config);
