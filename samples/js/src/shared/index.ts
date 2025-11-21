/**
 * Shared Utilities for A2A Agents
 *
 * This module provides common utilities for building A2A agents with AI SDK.
 */

export { createCoderAgent } from "../agents/coder/agent.js";
// Export agent factory functions for convenience
export { createContentEditorAgent } from "../agents/content-editor/agent.js";
export { createMovieAgent } from "../agents/movie-agent/agent.js";
// Export Unified Automatic A2A Adapter
// Export Logger interfaces and implementations
export {
  A2AAdapter,
  type A2AAdapterConfig,
  type A2ALogger,
  type AIGenerateResult,
  type AIStreamResult,
  ConsoleLogger,
  NoOpLogger,
  type ParsedArtifact,
  type ParsedArtifacts,
} from "./a2a-adapter.js";
// Export AI model utility
export { extractText, getModel, getModelInfo } from "./utils.js";
