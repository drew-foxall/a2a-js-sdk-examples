/**
 * Expense Agent - Cloudflare Worker
 *
 * Exposes the Expense agent via the A2A protocol on Cloudflare Workers.
 * Processes expense reimbursement requests with multi-turn clarification.
 *
 * KEY ARCHITECTURE:
 * - Agent logic is imported from the shared `a2a-agents` package
 * - Redis task store for persistent multi-step form state
 * - Factory handles Redis/InMemory fallback automatically
 *
 * Deployment:
 *   wrangler deploy
 *
 * Local Development:
 *   wrangler dev
 */

import type { LanguageModel } from "ai";
import type { AgentSkill } from "@drew-foxall/a2a-js-sdk";
import { createExpenseAgent } from "a2a-agents";
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

const expenseSkill: AgentSkill = {
  id: "expense_reimbursement",
  name: "Expense Reimbursement",
  description:
    "Process expense reimbursement requests by extracting details and submitting for approval",
  tags: ["expense", "reimbursement", "finance", "forms"],
  examples: [
    "Submit $50 for team lunch on 2024-01-15",
    "Expense: $200 travel to client site",
    "I need to expense $75 for office supplies",
  ],
};

// ============================================================================
// Worker Configuration
// ============================================================================

const config = defineWorkerConfig<WorkerEnvWithRedis>({
  agentName: "Expense Agent",

  createAgent: (model: LanguageModel) => createExpenseAgent(model),

  createAgentCard: (baseUrl: string) =>
    buildAgentCard(baseUrl, {
      name: "Expense Agent",
      description:
        "An agent that processes expense reimbursement requests with multi-turn data collection",
      skills: [expenseSkill],
    }),

  adapterOptions: {
    mode: "stream",
    workingMessage: "Processing expense request...",
  },

  taskStore: {
    type: "redis",
    prefix: "a2a:expense:",
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
