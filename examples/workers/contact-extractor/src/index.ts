/**
 * Contact Extractor Agent - Cloudflare Worker
 *
 * Exposes the Contact Extractor agent via the A2A protocol on Cloudflare Workers.
 * Extracts structured contact information from unstructured text.
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

import type { AgentSkill } from "@drew-foxall/a2a-js-sdk";
import { createContactExtractorAgent } from "a2a-agents";
import type { LanguageModel } from "ai";
import {
  buildAgentCard,
  createA2AHonoWorker,
  defineWorkerConfig,
  type BaseWorkerEnv,
} from "a2a-workers-shared";

// ============================================================================
// Skill Definition
// ============================================================================

const extractionSkill: AgentSkill = {
  id: "contact_extraction",
  name: "Contact Extraction",
  description:
    "Extract structured contact information (name, email, phone) from unstructured text",
  tags: ["extraction", "contact", "structured-data", "parsing"],
  examples: [
    "My name is John Doe, email john@example.com, phone 555-1234",
    "Contact Sarah at sarah@corp.com",
    "Reach me at (555) 987-6543, I'm Mike Johnson from Acme Inc",
  ],
};

// ============================================================================
// Worker Configuration
// ============================================================================

const config = defineWorkerConfig<BaseWorkerEnv>({
  agentName: "Contact Extractor",

  createAgent: (model: LanguageModel) => createContactExtractorAgent(model),

  createAgentCard: (baseUrl: string) =>
    buildAgentCard(baseUrl, {
      name: "Contact Extractor",
      description:
        "An agent that extracts structured contact information from unstructured text with multi-turn clarification",
      skills: [extractionSkill],
    }),

  adapterOptions: {
    mode: "stream",
    workingMessage: "Extracting contact information...",
  },
});

// ============================================================================
// Export Hono Application
// ============================================================================

export default createA2AHonoWorker(config);
