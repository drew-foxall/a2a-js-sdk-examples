/**
 * Analytics Agent - Cloudflare Worker
 *
 * Exposes the Analytics agent via the A2A protocol on Cloudflare Workers.
 * Demonstrates chart generation from natural language prompts.
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
import { createAnalyticsAgent } from "a2a-agents";
import {
  buildAgentCard,
  createA2AHonoWorker,
  defineWorkerConfig,
  type BaseWorkerEnv,
} from "a2a-workers-shared";

// ============================================================================
// Skill Definition
// ============================================================================

const chartGenerationSkill: AgentSkill = {
  id: "chart_generation",
  name: "Chart Generation",
  description:
    "Generates charts from data provided in natural language. Supports bar charts, line charts, and pie charts.",
  tags: ["chart", "visualization", "data", "analytics"],
  examples: [
    "Generate a chart of revenue: Jan,$1000 Feb,$2000 Mar,$1500",
    "Create a bar chart showing sales by region",
    "Make a pie chart of market share percentages",
  ],
};

// ============================================================================
// Worker Configuration
// ============================================================================

const config = defineWorkerConfig<BaseWorkerEnv>({
  agentName: "Analytics Agent",

  createAgent: (model: LanguageModel) => createAnalyticsAgent(model),

  createAgentCard: (baseUrl: string) =>
    buildAgentCard(baseUrl, {
      name: "Analytics Agent",
      description:
        "An agent that generates charts and visualizations from natural language data descriptions",
      skills: [chartGenerationSkill],
    }),

  adapterOptions: {
    mode: "stream",
  },
});

// ============================================================================
// Export Hono Application
// ============================================================================

export default createA2AHonoWorker(config);
