/**
 * Shared Utilities for A2A Agents
 * 
 * This module provides common utilities for building A2A agents with AI SDK.
 */

// Export A2A Agent Adapter
export {
  A2AAgentAdapter,
  type A2AAgentAdapterOptions,
  type ToolLoopAgentLike,
} from "./a2a-agent-adapter.js";

// Export A2A Streaming Adapter
export {
  A2AStreamingAdapter,
  type A2AStreamingAdapterOptions,
  type ParsedArtifact,
  type ParsedArtifacts,
} from "./a2a-streaming-adapter.js";

// Export AI model utility
export { getModel } from "./utils.js";

