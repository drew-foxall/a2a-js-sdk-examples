/**
 * Shared Utilities for A2A Agents
 *
 * This module provides common utilities for building A2A agents with AI SDK.
 */

// Export Unified Automatic A2A Adapter (RECOMMENDED)
export {
  A2AAdapter,
  type A2AAdapterConfig,
  type ParsedArtifact,
  type ParsedArtifacts,
} from "./a2a-adapter.js";

// Legacy adapters (deprecated, kept for backward compatibility)
export {
  A2AAgentAdapter,
  type A2AAgentAdapterOptions,
  type ToolLoopAgentLike,
} from "./a2a-agent-adapter.js";

export {
  A2AStreamingAdapter,
  type A2AStreamingAdapterOptions,
} from "./a2a-streaming-adapter.js";

// Export AI model utility
export { getModel } from "./utils.js";

