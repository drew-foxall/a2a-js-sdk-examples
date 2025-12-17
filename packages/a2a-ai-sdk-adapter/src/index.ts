/**
 * @drew-foxall/a2a-ai-sdk-adapter
 *
 * Unified adapter bridging Vercel AI SDK's ToolLoopAgent with the A2A protocol.
 *
 * @module
 */

export {
  A2AAdapter,
  type A2AAdapterConfig,
  type A2ALogger,
  type ArtifactGenerationContext,
  ConsoleLogger,
  NoOpLogger,
  type ParsedArtifact,
  type ParsedArtifacts,
} from "./adapter.js";

// Durable workflow adapter
export {
  DurableA2AAdapter,
  type DurableA2AAdapterConfig,
  type DurableWorkflowFn,
} from "./durable-adapter.js";
