/**
 * Shared TypeScript types for Cloudflare Workers
 *
 * These types define the environment bindings available to all workers.
 */

/**
 * Environment bindings available to all A2A agent workers
 *
 * Secrets are set via `wrangler secret put` and accessed via env binding.
 * Variables are set in wrangler.toml [vars] section.
 */
export interface Env {
  /**
   * OpenAI API Key (SECRET - set via wrangler secret put)
   */
  OPENAI_API_KEY: string;

  /**
   * AI Provider selection (defaults to "openai")
   * Supported: openai, anthropic, google
   */
  AI_PROVIDER?: string;

  /**
   * AI Model name (defaults to "gpt-4o-mini")
   */
  AI_MODEL?: string;

  /**
   * Anthropic API Key (SECRET - only needed if AI_PROVIDER=anthropic)
   */
  ANTHROPIC_API_KEY?: string;

  /**
   * Google AI API Key (SECRET - only needed if AI_PROVIDER=google)
   */
  GOOGLE_API_KEY?: string;
}

/**
 * Hono app type with environment bindings
 */
export type HonoEnv = { Bindings: Env };
