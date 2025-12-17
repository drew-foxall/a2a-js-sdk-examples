/**
 * MCP Agent Registry
 *
 * A Model Context Protocol server for dynamic agent discovery.
 * Enables capability-based agent routing without hardcoding URLs.
 *
 * Features:
 * - Dynamic agent registration/discovery
 * - Capability-based search (find_agent tool)
 * - Health status tracking
 * - Re-planning on task failure
 * - State persistence (via Redis)
 *
 * @example
 * ```typescript
 * import {
 *   createAgentRegistry,
 *   createMCPRegistryServer,
 *   createMCPRegistryOrchestrator,
 * } from "a2a-agents/agents/mcp-registry";
 *
 * // Create registry and register agents
 * const registry = createAgentRegistry();
 * registry.register({
 *   agentCard: {
 *     name: "Weather Agent",
 *     description: "Provides weather forecasts",
 *     url: "https://weather-agent.example.com",
 *   },
 *   tags: ["weather", "forecast"],
 * });
 *
 * // Create MCP server
 * const mcpServer = createMCPRegistryServer(registry);
 *
 * // Find an agent for a task
 * const results = registry.findAgent({
 *   query: "I need weather information for Paris",
 * });
 * ```
 */

// MCP Server
export { createMCPRegistryServer, MCPRegistryServer } from "./mcp-server.js";
// Orchestrator
export { createMCPRegistryOrchestrator, MCPRegistryOrchestrator } from "./orchestrator.js";
// Registry
export { AgentRegistry, createAgentRegistry } from "./registry.js";
// Storage
export {
  createInMemoryRegistryStore,
  createPersistentRegistry,
  createRedisRegistryStore,
  InMemoryRegistryStore,
  PersistentRegistry,
  type RedisLike,
  RedisRegistryStore,
  type RedisRegistryStoreConfig,
  type RegistryStore,
} from "./stores.js";
// Types
export type {
  ExecutionPlan,
  FindAgentQuery,
  FindAgentResult,
  MCPRegistryResources,
  MCPRegistryTools,
  OrchestratorConfig,
  OrchestratorState,
  PlanTask,
  RegisterAgentRequest,
  RegisteredAgentCard,
  RegistryConfig,
  RegistryStats,
} from "./types.js";
