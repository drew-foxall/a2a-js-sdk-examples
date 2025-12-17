/**
 * Code Review Agent - Cloudflare Worker
 *
 * Exposes the Code Review agent via the A2A protocol on Cloudflare Workers.
 * Analyzes code for issues, security vulnerabilities, and best practices.
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
import { createCodeReviewAgent } from "a2a-agents";
import {
  buildAgentCard,
  createA2AHonoWorker,
  defineWorkerConfig,
  type BaseWorkerEnv,
} from "a2a-workers-shared";

// ============================================================================
// Skill Definition
// ============================================================================

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

// ============================================================================
// Worker Configuration
// ============================================================================

const config = defineWorkerConfig<BaseWorkerEnv>({
  agentName: "Code Review Agent",

  createAgent: (model: LanguageModel) => createCodeReviewAgent(model),

  createAgentCard: (baseUrl: string) =>
    buildAgentCard(baseUrl, {
      name: "Code Review Agent",
      description:
        "An AI agent that reviews JavaScript/TypeScript code for issues, security vulnerabilities, and best practices. Provides structured feedback with severity levels and improvement suggestions.",
      skills: [codeReviewSkill],
    }),

  adapterOptions: {
    mode: "stream",
    workingMessage: "Reviewing code...",
  },
});

// ============================================================================
// Export Hono Application
// ============================================================================

export default createA2AHonoWorker(config);
