/**
 * MCP Agent Registry - Type Definitions
 *
 * Types for the MCP-based agent registry that enables dynamic agent discovery.
 */

import type { AgentCard } from "@drew-foxall/a2a-js-sdk";

// ============================================================================
// Agent Card Storage
// ============================================================================

/**
 * Extended Agent Card with registry metadata
 */
export interface RegisteredAgentCard extends AgentCard {
  /** When the agent was registered */
  registeredAt: string;
  /** Last health check timestamp */
  lastHealthCheck?: string;
  /** Health status from last check */
  healthStatus?: "healthy" | "unhealthy" | "unknown";
  /** Tags for capability-based search */
  tags?: string[];
  /** Embedding vector for semantic search (optional) */
  embedding?: number[];
}

/**
 * Agent registration request
 */
export interface RegisterAgentRequest {
  /** Agent Card to register */
  agentCard: AgentCard;
  /** Optional tags for capability-based search */
  tags?: string[];
}

/**
 * Agent search query
 */
export interface FindAgentQuery {
  /** Natural language description of the task */
  query: string;
  /** Required capabilities (must match all) */
  requiredCapabilities?: string[];
  /** Preferred tags (weighted in ranking) */
  preferredTags?: string[];
  /** Maximum number of results */
  limit?: number;
}

/**
 * Agent search result
 */
export interface FindAgentResult {
  /** Matched agent card */
  agentCard: RegisteredAgentCard;
  /** Match score (0-1) */
  score: number;
  /** Reason for match */
  matchReason: string;
}

// ============================================================================
// MCP Protocol Types
// ============================================================================

/**
 * MCP tool definitions for the registry
 */
export interface MCPRegistryTools {
  /** Find the best agent for a task */
  find_agent: {
    query: string;
    requiredCapabilities?: string[];
    preferredTags?: string[];
  };
  /** List all registered agents */
  list_agents: {
    tags?: string[];
    healthyOnly?: boolean;
  };
  /** Get a specific agent by name */
  get_agent: {
    name: string;
  };
  /** Register a new agent */
  register_agent: RegisterAgentRequest;
  /** Unregister an agent */
  unregister_agent: {
    name: string;
  };
}

/**
 * MCP resource definitions for the registry
 */
export interface MCPRegistryResources {
  /** List of all agent cards */
  "agent_cards/list": RegisteredAgentCard[];
  /** Individual agent card by name */
  "agent_cards/{name}": RegisteredAgentCard;
  /** Registry statistics */
  "registry/stats": RegistryStats;
}

/**
 * Registry statistics
 */
export interface RegistryStats {
  /** Total number of registered agents */
  totalAgents: number;
  /** Number of healthy agents */
  healthyAgents: number;
  /** Number of unhealthy agents */
  unhealthyAgents: number;
  /** Last update timestamp */
  lastUpdated: string;
  /** Capability distribution */
  capabilityDistribution: Record<string, number>;
}

// ============================================================================
// Orchestrator Types
// ============================================================================

/**
 * Task in a plan DAG
 */
export interface PlanTask {
  /** Unique task ID */
  id: string;
  /** Task type/description */
  type: string;
  /** Task dependencies (IDs of tasks that must complete first) */
  dependencies: string[];
  /** Task parameters */
  params?: Record<string, unknown>;
  /** Task status */
  status: "pending" | "running" | "completed" | "failed";
  /** Result if completed */
  result?: unknown;
  /** Error if failed */
  error?: string;
  /** Agent assigned to this task */
  assignedAgent?: string;
}

/**
 * Execution plan from planner agent
 */
export interface ExecutionPlan {
  /** Plan ID */
  id: string;
  /** Original user query */
  userQuery: string;
  /** Tasks in the plan */
  tasks: PlanTask[];
  /** Plan creation timestamp */
  createdAt: string;
  /** Plan status */
  status: "planning" | "executing" | "completed" | "failed" | "replanning";
  /** Current iteration (for re-planning) */
  iteration: number;
  /** Maximum iterations allowed */
  maxIterations: number;
}

/**
 * Orchestrator state (for persistence)
 */
export interface OrchestratorState {
  /** Current execution plan */
  plan?: ExecutionPlan;
  /** Task results by task ID */
  taskResults: Record<string, unknown>;
  /** Agent contexts for conversation continuity */
  agentContexts: Record<
    string,
    {
      taskId?: string;
      contextId?: string;
      inputRequired: boolean;
    }
  >;
  /** Session metadata */
  sessionId: string;
  /** Last update timestamp */
  lastUpdated: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Registry configuration
 */
export interface RegistryConfig {
  /** Redis prefix for registry data */
  redisPrefix?: string;
  /** TTL for agent registrations (seconds) */
  registrationTtl?: number;
  /** Health check interval (seconds) */
  healthCheckInterval?: number;
  /** Enable semantic search with embeddings */
  enableSemanticSearch?: boolean;
}

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  /** MCP registry URL */
  registryUrl: string;
  /** Maximum re-planning iterations */
  maxReplanIterations?: number;
  /** Redis prefix for state persistence */
  redisPrefix?: string;
  /** State TTL (seconds) */
  stateTtl?: number;
}


