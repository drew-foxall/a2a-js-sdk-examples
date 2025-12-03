/**
 * Travel Planner Worker - Type Definitions
 *
 * Cloudflare Worker environment and configuration types.
 */

/**
 * Cloudflare Worker environment bindings
 */
export interface PlannerEnv {
  // API Keys
  OPENAI_API_KEY: string;
  AI_MODEL?: string;
  AI_PROVIDER?: string;

  // Service Bindings to specialist agents
  WEATHER_AGENT?: Fetcher;
  AIRBNB_AGENT?: Fetcher;

  // Fallback URLs (when Service Bindings unavailable)
  WEATHER_AGENT_URL?: string;
  AIRBNB_AGENT_URL?: string;

  // Redis persistence (for task store)
  // Set via: wrangler secret put UPSTASH_REDIS_REST_URL
  // Set via: wrangler secret put UPSTASH_REDIS_REST_TOKEN
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
}

/**
 * Agent communication configuration
 */
export interface AgentCommConfig {
  /** Service Binding (if available) */
  binding?: Fetcher;
  /** HTTP fallback URL */
  fallbackUrl?: string;
  /** Agent name from discovery */
  name: string;
  /** Agent URL (for discovery) */
  url: string;
}

/**
 * Worker-specific registered agent (extends base with binding)
 */
export interface WorkerRegisteredAgent {
  name: string;
  description: string;
  url: string;
  binding?: Fetcher;
}
