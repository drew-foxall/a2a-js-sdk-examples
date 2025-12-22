/**
 * Shared exports for Cloudflare Workers
 *
 * This module provides common utilities for building A2A workers:
 *
 * - **Types**: Environment bindings
 * - **Utilities**: Model configuration, ID generation
 * - **Redis**: Task store with Upstash Redis
 * - **Agent Card**: Builder utilities for A2A agent cards
 * - **Worker Config**: Framework-agnostic configuration
 * - **Hono Adapter**: Hono-specific worker factory
 *
 * ## Module Structure
 *
 * ```
 * a2a-workers-shared/
 * ├── types.ts          - Environment types
 * ├── utils.ts          - Model configuration utilities
 * ├── redis.ts          - Upstash Redis task store
 * ├── agent-card.ts     - Agent card builder
 * ├── worker-config.ts  - Framework-agnostic configuration (no HTTP imports)
 * └── hono-adapter.ts   - Hono-specific factory
 * ```
 *
 * ## Usage
 *
 * ```typescript
 * import {
 *   defineWorkerConfig,
 *   createA2AHonoWorker,
 *   buildAgentCard,
 *   getModel,
 * } from "a2a-workers-shared";
 * ```
 */

// ============================================================================
// Core Types and Utilities
// ============================================================================

export * from "./types.js";
export * from "./utils.js";

// ============================================================================
// Redis / Task Store
// ============================================================================

export * from "./redis.js";

// ============================================================================
// Agent Card Builder
// ============================================================================

export * from "./agent-card.js";

// ============================================================================
// Worker Configuration (Framework-Agnostic)
// ============================================================================

export {
  // Core configuration types
  type A2AWorkerConfig,
  type AgentFactory,
  type AgentCardFactory,
  type ArtifactGenerationContext,
  type BaseWorkerEnv,
  type HealthCheckExtras,
  type ResponseTypeSelectionContext,
  type TaskStoreConfig,
  type WorkerAdapterOptions,
  type WorkerEnvWithRedis,
  type WorkerLogger,

  // Factory functions
  defineWorkerConfig,

  // Utility functions
  createA2AExecutor,
  createA2ARequestHandler,
  createTaskStore,
  extractBaseUrl,

  // Constants
  DEFAULT_ADAPTER_OPTIONS,
  DEFAULT_TASK_TTL_SECONDS,
} from "./worker-config.js";

// ============================================================================
// Hono Adapter
// ============================================================================

export {
  // Hono-specific types
  type HonoWorkerOptions,

  // Hono factory
  createA2AHonoWorker,

  // Constants
  DEFAULT_CORS_OPTIONS,
} from "./hono-adapter.js";

// ============================================================================
// Endpoint Testing (for smoke tests and E2E)
// ============================================================================

export {
  // Types
  type EndpointTestConfig,
  type EndpointTestResult,
  type EndpointTestResults,
  type TestTarget,

  // Test functions
  testHealthCheck,
  testAgentCard,
  testMessageSend,
  testCors,
  test404Handling,

  // Test runners
  runEndpointTests,
  createEndpointTestSuite,

  // CLI helpers
  formatTestResults,
  runEndpointTestsCLI,
} from "./endpoint-tests.js";
