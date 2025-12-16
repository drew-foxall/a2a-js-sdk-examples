/**
 * Agent Discovery - URL Constants
 *
 * This file provides default agent URLs for the travel planner system.
 * Discovery is now handled by @drew-foxall/a2a-ai-provider-v3's discoverAgent().
 *
 * @see @drew-foxall/a2a-ai-provider-v3 for the actual discovery implementation
 */

/**
 * Default local agent URLs for the travel planner system
 */
export const DEFAULT_LOCAL_AGENT_URLS = {
  weatherAgent: "http://localhost:41252",
  airbnbAgent: "http://localhost:41253",
} as const;

/**
 * Default worker agent URLs (deployed)
 */
export const DEFAULT_WORKER_AGENT_URLS = {
  weatherAgent: "https://a2a-weather-agent.aisdk-a2a.workers.dev",
  airbnbAgent: "https://a2a-airbnb-agent.aisdk-a2a.workers.dev",
} as const;
