/**
 * Local LLM Chat Agent - Cloudflare Worker
 *
 * Exposes the Local LLM Chat agent via the A2A protocol on Cloudflare Workers.
 * While the agent is designed for local LLMs, the worker version uses
 * cloud providers (OpenAI by default) since Workers can't run Ollama.
 *
 * KEY ARCHITECTURE:
 * - Agent logic is imported from the shared `a2a-agents` package
 * - Redis task store for persistent chat history (multi-turn conversations)
 *
 * For true edge inference, consider using Cloudflare Workers AI.
 *
 * Deployment:
 *   wrangler deploy
 *
 * Local Development:
 *   wrangler dev
 */

import type { LanguageModel } from "ai";
import type { AgentSkill } from "@drew-foxall/a2a-js-sdk";
import { createLocalLLMChatAgent } from "a2a-agents";
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

const chatSkill: AgentSkill = {
  id: "chat_with_tools",
  name: "Chat with Tools",
  description: "General chat with access to web search and weather information",
  tags: ["chat", "search", "weather", "assistant"],
  examples: [
    "What's the weather in Tokyo?",
    "Search for the latest news about AI",
    "Tell me about yourself",
  ],
};

// ============================================================================
// Worker Configuration
// ============================================================================

const config = defineWorkerConfig<WorkerEnvWithRedis>({
  agentName: "Local LLM Chat Agent",

  createAgent: (model: LanguageModel) => createLocalLLMChatAgent(model),

  createAgentCard: (baseUrl: string) =>
    buildAgentCard(baseUrl, {
      name: "Local LLM Chat Agent",
      description:
        "A chat agent that works with local or cloud LLMs. Includes web search and weather tools. This worker version uses cloud providers.",
      skills: [chatSkill],
    }),

  adapterOptions: {
    mode: "stream",
    workingMessage: "Thinking...",
    includeHistory: true,
  },

  taskStore: {
    type: "redis",
    prefix: "a2a:local-llm:",
  },

  healthCheckExtras: (env: WorkerEnvWithRedis) => ({
    note: "Worker version uses cloud LLM providers",
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
