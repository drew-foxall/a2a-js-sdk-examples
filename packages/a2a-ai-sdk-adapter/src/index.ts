/**
 * @drew-foxall/a2a-ai-sdk-adapter
 *
 * Unified adapter bridging Vercel AI SDK's ToolLoopAgent with the A2A protocol.
 *
 * ## Entry Points
 *
 * - `@drew-foxall/a2a-ai-sdk-adapter` - Standard adapter (edge-compatible)
 * - `@drew-foxall/a2a-ai-sdk-adapter/durable` - Durable workflow adapter (requires `workflow` package)
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
  type ResponseTypeSelectionContext,
} from "./adapter.js";

export {
  type A2AResponseType,
  createLLMResponseTypeRouter,
  extractTextFromA2AMessage,
  isTaskContinuation,
  type LLMResponseTypeRouterOptions,
  messageUnlessContinuation,
  preferTaskForContinuations,
  type SelectResponseType,
} from "./routing.js";

// NOTE: DurableA2AAdapter is NOT exported from the main entry point to avoid
// pulling in the `workflow` package which is not edge-compatible.
// Import from "@drew-foxall/a2a-ai-sdk-adapter/durable" instead.
