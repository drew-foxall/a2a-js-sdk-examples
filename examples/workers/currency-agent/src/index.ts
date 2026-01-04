/**
 * Currency Agent - Cloudflare Worker
 *
 * Exposes the Currency agent via the A2A protocol on Cloudflare Workers.
 * Demonstrates multi-turn conversation and external API integration.
 *
 * KEY ARCHITECTURE:
 * - Agent logic is imported from the shared `a2a-agents` package
 * - Custom parseTaskState for multi-turn conversation support
 * - Custom generateArtifacts for conversion results
 *
 * Deployment:
 *   wrangler deploy
 *
 * Local Development:
 *   wrangler dev
 */

import type { LanguageModel } from "ai";
import type { AgentSkill, Artifact } from "@drew-foxall/a2a-js-sdk";
import { createCurrencyAgent } from "a2a-agents";
import {
  buildAgentCard,
  createA2AHonoWorker,
  defineWorkerConfig,
  type ArtifactGenerationContext,
  type BaseWorkerEnv,
} from "a2a-workers-shared";

// ============================================================================
// Skill Definition
// ============================================================================

const currencyConversionSkill: AgentSkill = {
  id: "convert_currency",
  name: "Currency Exchange Rates Tool",
  description: "Helps with exchange values between various currencies",
  tags: ["currency conversion", "currency exchange", "forex"],
  examples: [
    "What is exchange rate between USD and GBP?",
    "Convert 100 USD to EUR",
    "How much is 50 CAD in AUD?",
  ],
};

// ============================================================================
// Multi-Turn Conversation Support
// ============================================================================

function parseTaskState(response: string): "input-required" | "completed" {
  const lowerResponse = response.toLowerCase();

  const askingForInfo =
    lowerResponse.includes("please specify") ||
    lowerResponse.includes("which currency") ||
    lowerResponse.includes("what currency") ||
    lowerResponse.includes("need to know") ||
    lowerResponse.includes("could you specify") ||
    lowerResponse.includes("can you specify") ||
    (lowerResponse.includes("?") && lowerResponse.length < 200);

  return askingForInfo ? "input-required" : "completed";
}

async function generateConversionArtifacts(
  context: ArtifactGenerationContext
): Promise<Artifact[]> {
  if (parseTaskState(context.responseText) === "input-required") {
    return [];
  }

  return [
    {
      artifactId: `conversion-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      name: "conversion_result",
      parts: [{ kind: "text" as const, text: context.responseText }],
    },
  ];
}

// ============================================================================
// Worker Configuration
// ============================================================================

const config = defineWorkerConfig<BaseWorkerEnv>({
  agentName: "Currency Agent",

  createAgent: (model: LanguageModel) => createCurrencyAgent(model),

  createAgentCard: (baseUrl: string) =>
    buildAgentCard(baseUrl, {
      name: "Currency Agent",
      description: "Helps with exchange rates for currencies using Frankfurter API",
      skills: [currencyConversionSkill],
      capabilities: {
        stateTransitionHistory: true,
      },
    }),

  adapterOptions: {
    mode: "stream",
    parseTaskState,
    generateArtifacts: generateConversionArtifacts,
  },
});

// ============================================================================
// Export Hono Application
// ============================================================================

export default createA2AHonoWorker(config);
