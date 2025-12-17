/**
 * MCP Agent Registry - In-Memory Implementation
 *
 * Stores Agent Cards and provides capability-based agent discovery.
 * Can be backed by Redis for persistence.
 */

import type { AgentCard } from "@drew-foxall/a2a-js-sdk";
import type {
  FindAgentQuery,
  FindAgentResult,
  RegisterAgentRequest,
  RegisteredAgentCard,
  RegistryConfig,
  RegistryStats,
} from "./types.js";

// ============================================================================
// Agent Registry Class
// ============================================================================

/**
 * Agent Registry - Stores and discovers agents by capability
 *
 * Features:
 * - Register/unregister agents dynamically
 * - Find agents by natural language query
 * - Filter by capabilities and tags
 * - Health status tracking
 */
export class AgentRegistry {
  private agents: Map<string, RegisteredAgentCard> = new Map();
  private readonly _config: Required<RegistryConfig>;

  constructor(config: RegistryConfig = {}) {
    this._config = {
      redisPrefix: config.redisPrefix ?? "a2a:registry:",
      registrationTtl: config.registrationTtl ?? 86400 * 7, // 7 days
      healthCheckInterval: config.healthCheckInterval ?? 300, // 5 minutes
      enableSemanticSearch: config.enableSemanticSearch ?? false,
    };
  }

  /**
   * Get the registry configuration
   * Used for Redis persistence and health check scheduling
   */
  get config(): Required<RegistryConfig> {
    return this._config;
  }

  // ==========================================================================
  // Registration
  // ==========================================================================

  /**
   * Register an agent in the registry
   */
  register(request: RegisterAgentRequest): RegisteredAgentCard {
    const { agentCard, tags } = request;

    // Extract capabilities from skills
    const skillTags =
      agentCard.skills?.flatMap((skill) => [skill.name.toLowerCase(), ...(skill.tags ?? [])]) ?? [];

    const registeredCard: RegisteredAgentCard = {
      ...agentCard,
      registeredAt: new Date().toISOString(),
      healthStatus: "unknown",
      tags: [...new Set([...(tags ?? []), ...skillTags])],
    };

    this.agents.set(agentCard.name, registeredCard);
    return registeredCard;
  }

  /**
   * Unregister an agent from the registry
   */
  unregister(name: string): boolean {
    return this.agents.delete(name);
  }

  /**
   * Get an agent by name
   */
  getAgent(name: string): RegisteredAgentCard | undefined {
    return this.agents.get(name);
  }

  /**
   * List all registered agents
   */
  listAgents(options?: { tags?: string[]; healthyOnly?: boolean }): RegisteredAgentCard[] {
    let agents = Array.from(this.agents.values());

    // Filter by health status
    if (options?.healthyOnly) {
      agents = agents.filter((a) => a.healthStatus === "healthy");
    }

    // Filter by tags
    if (options?.tags && options.tags.length > 0) {
      const requiredTags = new Set(options.tags.map((t) => t.toLowerCase()));
      agents = agents.filter((a) => a.tags?.some((tag) => requiredTags.has(tag.toLowerCase())));
    }

    return agents;
  }

  // ==========================================================================
  // Discovery
  // ==========================================================================

  /**
   * Find the best agent for a task using keyword matching
   *
   * This is a simple keyword-based implementation. For production,
   * consider using embeddings for semantic search.
   */
  findAgent(query: FindAgentQuery): FindAgentResult[] {
    const { query: searchQuery, requiredCapabilities, preferredTags, limit = 5 } = query;

    // Tokenize query
    const queryTokens = this.tokenize(searchQuery);

    // Score each agent
    const scoredAgents: FindAgentResult[] = [];

    for (const agent of this.agents.values()) {
      // Skip unhealthy agents if we have healthy ones
      if (agent.healthStatus === "unhealthy") {
        continue;
      }

      // Check required capabilities
      if (requiredCapabilities && requiredCapabilities.length > 0) {
        const agentCapabilities = new Set([
          ...(agent.capabilities?.streaming ? ["streaming"] : []),
          ...(agent.capabilities?.pushNotifications ? ["pushNotifications"] : []),
          ...(agent.tags ?? []),
        ]);

        const hasAllRequired = requiredCapabilities.every((cap) => agentCapabilities.has(cap));

        if (!hasAllRequired) {
          continue;
        }
      }

      // Calculate match score
      const { score, matchReason } = this.calculateScore(agent, queryTokens, preferredTags);

      if (score > 0) {
        scoredAgents.push({
          agentCard: agent,
          score,
          matchReason,
        });
      }
    }

    // Sort by score descending
    scoredAgents.sort((a, b) => b.score - a.score);

    // Return top results
    return scoredAgents.slice(0, limit);
  }

  /**
   * Find the single best agent for a task
   */
  findBestAgent(query: string): FindAgentResult | null {
    const results = this.findAgent({ query, limit: 1 });
    return results[0] ?? null;
  }

  // ==========================================================================
  // Health Checking
  // ==========================================================================

  /**
   * Update health status for an agent
   */
  updateHealthStatus(name: string, status: "healthy" | "unhealthy"): void {
    const agent = this.agents.get(name);
    if (agent) {
      agent.healthStatus = status;
      agent.lastHealthCheck = new Date().toISOString();
    }
  }

  /**
   * Perform health check on an agent
   */
  async checkAgentHealth(name: string): Promise<boolean> {
    const agent = this.agents.get(name);
    if (!agent) {
      return false;
    }

    try {
      const response = await fetch(`${agent.url}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      const isHealthy = response.ok;
      this.updateHealthStatus(name, isHealthy ? "healthy" : "unhealthy");
      return isHealthy;
    } catch {
      this.updateHealthStatus(name, "unhealthy");
      return false;
    }
  }

  /**
   * Check health of all registered agents
   */
  async checkAllAgentsHealth(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    await Promise.all(
      Array.from(this.agents.keys()).map(async (name) => {
        const isHealthy = await this.checkAgentHealth(name);
        results.set(name, isHealthy);
      })
    );

    return results;
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  /**
   * Get registry statistics
   */
  getStats(): RegistryStats {
    const agents = Array.from(this.agents.values());

    // Count by health status
    const healthyAgents = agents.filter((a) => a.healthStatus === "healthy").length;
    const unhealthyAgents = agents.filter((a) => a.healthStatus === "unhealthy").length;

    // Count capabilities
    const capabilityDistribution: Record<string, number> = {};
    for (const agent of agents) {
      for (const tag of agent.tags ?? []) {
        capabilityDistribution[tag] = (capabilityDistribution[tag] ?? 0) + 1;
      }
    }

    return {
      totalAgents: agents.length,
      healthyAgents,
      unhealthyAgents,
      lastUpdated: new Date().toISOString(),
      capabilityDistribution,
    };
  }

  // ==========================================================================
  // Persistence (for Redis backing)
  // ==========================================================================

  /**
   * Export all agents as JSON (for persistence)
   */
  exportAgents(): RegisteredAgentCard[] {
    return Array.from(this.agents.values());
  }

  /**
   * Import agents from JSON (for restoration)
   */
  importAgents(agents: RegisteredAgentCard[]): void {
    for (const agent of agents) {
      this.agents.set(agent.name, agent);
    }
  }

  /**
   * Clear all agents
   */
  clear(): void {
    this.agents.clear();
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Tokenize text for matching
   */
  private tokenize(text: string): Set<string> {
    return new Set(
      text
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 2)
    );
  }

  /**
   * Calculate match score for an agent
   */
  private calculateScore(
    agent: RegisteredAgentCard,
    queryTokens: Set<string>,
    preferredTags?: string[]
  ): { score: number; matchReason: string } {
    let score = 0;
    const matchReasons: string[] = [];

    // Build agent text corpus
    const agentText = [
      agent.name,
      agent.description,
      ...(agent.skills?.map((s) => `${s.name} ${s.description}`) ?? []),
      ...(agent.tags ?? []),
    ]
      .join(" ")
      .toLowerCase();

    const agentTokens = this.tokenize(agentText);

    // Token overlap score
    let tokenMatches = 0;
    for (const token of queryTokens) {
      if (agentTokens.has(token)) {
        tokenMatches++;
      }
    }

    if (tokenMatches > 0) {
      const tokenScore = tokenMatches / queryTokens.size;
      score += tokenScore * 0.6; // 60% weight for token matching
      matchReasons.push(`${tokenMatches} keyword matches`);
    }

    // Preferred tags bonus
    if (preferredTags && preferredTags.length > 0) {
      const agentTagSet = new Set(agent.tags?.map((t) => t.toLowerCase()) ?? []);
      const tagMatches = preferredTags.filter((t) => agentTagSet.has(t.toLowerCase())).length;

      if (tagMatches > 0) {
        const tagScore = tagMatches / preferredTags.length;
        score += tagScore * 0.3; // 30% weight for tag matching
        matchReasons.push(`${tagMatches} tag matches`);
      }
    }

    // Health bonus
    if (agent.healthStatus === "healthy") {
      score += 0.1; // 10% bonus for healthy agents
      matchReasons.push("healthy");
    }

    return {
      score: Math.min(score, 1), // Cap at 1.0
      matchReason: matchReasons.join(", ") || "partial match",
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an agent registry with optional initial agents
 */
export function createAgentRegistry(
  config?: RegistryConfig,
  initialAgents?: AgentCard[]
): AgentRegistry {
  const registry = new AgentRegistry(config);

  if (initialAgents) {
    for (const agent of initialAgents) {
      registry.register({ agentCard: agent });
    }
  }

  return registry;
}
