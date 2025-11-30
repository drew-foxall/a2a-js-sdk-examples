/**
 * Agent Discovery Utility
 *
 * Provides dynamic agent discovery by fetching Agent Cards from remote agents.
 * This matches the Python airbnb_planner_multiagent pattern where the host agent
 * discovers specialist agents at startup.
 *
 * Key Features:
 * - Fetch Agent Cards from URLs
 * - Build agent registry with names and descriptions
 * - Generate agent roster for prompt injection
 * - Support for both local (HTTP) and worker (Service Binding) environments
 */

import type { AgentCard } from "@drew-foxall/a2a-js-sdk";

// ============================================================================
// Types
// ============================================================================

/**
 * A registered agent in the discovery system
 */
export interface RegisteredAgent {
  /** Agent name from Agent Card */
  name: string;
  /** Agent description from Agent Card */
  description: string;
  /** Base URL for the agent (for HTTP calls) */
  url: string;
  /** Full Agent Card (optional, for extended info) */
  card?: AgentCard;
}

/**
 * Configuration for agent discovery
 */
export interface AgentDiscoveryConfig {
  /** Agent URL to discover */
  url: string;
  /** Optional fallback name if card fetch fails */
  fallbackName?: string;
  /** Optional fallback description if card fetch fails */
  fallbackDescription?: string;
}

// ============================================================================
// Agent Card Fetching
// ============================================================================

/**
 * Fetch an Agent Card from a URL
 *
 * Supports both direct URLs and /.well-known/agent-card.json convention.
 */
export async function fetchAgentCard(url: string): Promise<AgentCard> {
  // Normalize URL to agent card endpoint
  const cardUrl = url.endsWith("/agent-card.json")
    ? url
    : url.endsWith("/.well-known")
      ? `${url}/agent-card.json`
      : `${url.replace(/\/$/, "")}/.well-known/agent-card.json`;

  const response = await fetch(cardUrl, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch agent card from ${cardUrl}: ${response.status} ${response.statusText}`
    );
  }

  const card = (await response.json()) as AgentCard;

  // Validate required fields
  if (!card.name) {
    throw new Error(`Agent card from ${cardUrl} is missing required 'name' field`);
  }

  return card;
}

// ============================================================================
// Agent Registry
// ============================================================================

/**
 * Registry for discovered agents
 *
 * Manages agent discovery and provides lookup by name.
 */
export class AgentRegistry {
  private agents: Map<string, RegisteredAgent> = new Map();

  /**
   * Discover and register an agent from a URL
   */
  async discoverAgent(config: AgentDiscoveryConfig): Promise<RegisteredAgent> {
    try {
      const card = await fetchAgentCard(config.url);

      const agent: RegisteredAgent = {
        name: card.name,
        description: card.description || `Agent at ${config.url}`,
        url: config.url,
        card,
      };

      this.agents.set(card.name, agent);
      return agent;
    } catch (error) {
      // Use fallback if provided
      if (config.fallbackName) {
        const agent: RegisteredAgent = {
          name: config.fallbackName,
          description: config.fallbackDescription || `Agent at ${config.url}`,
          url: config.url,
        };
        this.agents.set(config.fallbackName, agent);
        return agent;
      }

      throw error;
    }
  }

  /**
   * Discover multiple agents in parallel
   */
  async discoverAgents(configs: AgentDiscoveryConfig[]): Promise<RegisteredAgent[]> {
    const results = await Promise.allSettled(configs.map((config) => this.discoverAgent(config)));

    const discovered: RegisteredAgent[] = [];
    const errors: string[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const config = configs[i];
      if (result && result.status === "fulfilled") {
        discovered.push(result.value);
      } else if (result && result.status === "rejected" && config) {
        errors.push(`Failed to discover agent at ${config.url}: ${result.reason}`);
      }
    }

    if (errors.length > 0) {
      console.warn("Agent discovery warnings:", errors);
    }

    return discovered;
  }

  /**
   * Get an agent by name
   */
  getAgent(name: string): RegisteredAgent | undefined {
    return this.agents.get(name);
  }

  /**
   * Get all registered agents
   */
  getAllAgents(): RegisteredAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Check if an agent is registered
   */
  hasAgent(name: string): boolean {
    return this.agents.has(name);
  }

  /**
   * Get agent names
   */
  getAgentNames(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Build agent roster string for prompt injection
   *
   * Returns a JSON-lines format matching the Python implementation:
   * {"name": "Weather Agent", "description": "..."}
   * {"name": "Airbnb Agent", "description": "..."}
   */
  buildAgentRoster(): string {
    return this.getAllAgents()
      .map((agent) =>
        JSON.stringify({
          name: agent.name,
          description: agent.description,
        })
      )
      .join("\n");
  }

  /**
   * Clear all registered agents
   */
  clear(): void {
    this.agents.clear();
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a pre-configured registry with common agent URLs
 */
export function createLocalAgentRegistry(): AgentRegistry {
  return new AgentRegistry();
}

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
