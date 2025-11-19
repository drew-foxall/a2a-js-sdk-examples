/**
 * Shared Utilities for A2A Agents
 *
 * This module provides common utilities for building A2A agents with AI SDK.
 */

// Export Unified Automatic A2A Adapter
export {
  A2AAdapter,
  type A2AAdapterConfig,
  type ParsedArtifact,
  type ParsedArtifacts,
  type AIGenerateResult,
  type AIStreamResult,
} from "./a2a-adapter.js";

// Export Logger interfaces and implementations
export {
  type A2ALogger,
  ConsoleLogger,
  NoOpLogger,
} from "./a2a-adapter.js";

// Export AI model utility
export { getModel } from "./utils.js";

