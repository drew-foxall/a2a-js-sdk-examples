/**
 * Shared utilities for Cloudflare Workers
 *
 * These utilities are designed to work in the Workers runtime environment
 * without any Node.js-specific APIs.
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { Env } from "./types.js";

/**
 * Get the AI model based on environment configuration
 *
 * Unlike the Node.js version, this requires the env object to be passed in
 * since Workers don't have access to process.env.
 *
 * @param env - The Cloudflare Workers environment bindings
 * @returns AI SDK LanguageModelV1 instance
 *
 * @example
 * ```typescript
 * app.post('/message/send', async (c) => {
 *   const model = getModel(c.env);
 *   const agent = createHelloWorldAgent(model);
 *   // ...
 * });
 * ```
 */
export function getModel(env: Env) {
  const provider = env.AI_PROVIDER || "openai";
  const modelName = env.AI_MODEL;

  switch (provider.toLowerCase()) {
    case "openai": {
      if (!env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is required. Set it using: wrangler secret put OPENAI_API_KEY");
      }
      // Use createOpenAI to explicitly pass the API key (required for Workers)
      // IMPORTANT: Use .chat() instead of default to avoid OpenAI Responses API
      // which has issues with tool schemas in Workers environment
      const openai = createOpenAI({
        apiKey: env.OPENAI_API_KEY,
      });
      return openai.chat(modelName || "gpt-4o-mini");
    }

    case "anthropic": {
      // Anthropic provider - uses ANTHROPIC_API_KEY from env
      if (!env.ANTHROPIC_API_KEY) {
        throw new Error("ANTHROPIC_API_KEY is required when using anthropic provider");
      }
      const anthropic = createAnthropic({
        apiKey: env.ANTHROPIC_API_KEY,
      });
      return anthropic(modelName || "claude-3-5-sonnet-20241022");
    }

    case "google": {
      // Google AI provider - uses GOOGLE_API_KEY from env
      if (!env.GOOGLE_API_KEY) {
        throw new Error("GOOGLE_API_KEY is required when using google provider");
      }
      const google = createGoogleGenerativeAI({
        apiKey: env.GOOGLE_API_KEY,
      });
      return google(modelName || "gemini-2.0-flash-exp");
    }

    default:
      throw new Error(
        `Unknown AI provider: "${provider}"\n\n` +
          "Supported providers for Workers:\n" +
          "  - openai (default)\n" +
          "  - anthropic\n" +
          "  - google\n\n" +
          "Set AI_PROVIDER in wrangler.toml [vars] section."
      );
  }
}

/**
 * Get provider and model info for logging
 *
 * @param env - The Cloudflare Workers environment bindings
 */
export function getModelInfo(env: Env) {
  return {
    provider: env.AI_PROVIDER || "openai",
    model: env.AI_MODEL || "gpt-4o-mini",
  };
}

/**
 * Create a unique message ID
 */
export function createMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Create a unique task ID
 */
export function createTaskId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

