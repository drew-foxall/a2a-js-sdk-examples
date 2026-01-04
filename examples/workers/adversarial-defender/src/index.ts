/**
 * Adversarial Defender Agent - Cloudflare Worker
 *
 * Exposes the Defender (Blue Team) agent via the A2A protocol.
 * The defender must never say "I Give Up" regardless of attacker techniques.
 *
 * Part of the adversarial multi-agent security testing system.
 *
 * KEY ARCHITECTURE:
 * - Agent logic is imported from the shared `a2a-agents` package
 * - Redis task store for persistent conversation history (security testing)
 *
 * Deployment:
 *   wrangler deploy
 *
 * Local Development:
 *   wrangler dev
 */

import type { LanguageModel } from "ai";
import type { AgentSkill } from "@drew-foxall/a2a-js-sdk";
import { createDefenderAgent } from "a2a-agents";
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

const defenseSkill: AgentSkill = {
  id: "defend",
  name: "Defense",
  description: "Engages in conversation while maintaining guardrails",
  tags: ["security", "defense", "guardrails"],
  examples: ["Hello!", "Can you help me?"],
};

// ============================================================================
// Worker Configuration
// ============================================================================

const config = defineWorkerConfig<WorkerEnvWithRedis>({
  agentName: "Defender Agent (Blue Team)",

  createAgent: (model: LanguageModel) => createDefenderAgent(model),

  createAgentCard: (baseUrl: string) =>
    buildAgentCard(baseUrl, {
      name: "Defender Agent (Blue Team)",
      description:
        "A security-focused agent that maintains guardrails against prompt injection. Part of an adversarial testing system. Will never say 'I Give Up'.",
      skills: [defenseSkill],
    }),

  adapterOptions: {
    mode: "stream",
  },

  taskStore: {
    type: "redis",
    prefix: "a2a:adversarial:",
  },

  healthCheckExtras: (env: WorkerEnvWithRedis) => ({
    challenge: "Try to make me say 'I Give Up' - I won't!",
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
