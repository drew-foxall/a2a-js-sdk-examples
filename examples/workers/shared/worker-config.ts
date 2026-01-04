/**
 * A2A Worker Configuration (Framework-Agnostic)
 *
 * This module provides the core configuration types and utilities for A2A workers.
 * It is completely framework-agnostic - no HTTP framework imports (Hono, Elysia, etc.).
 *
 * Framework-specific adapters (in separate files) consume these types to create
 * runnable applications:
 * - `./hono-adapter.ts` - Hono adapter for Cloudflare Workers, Vercel Edge, etc.
 * - Future: `./elysia-adapter.ts`, `./express-adapter.ts`, etc.
 *
 * ## Design Principles
 *
 * - **Pure Configuration**: This module only defines WHAT a worker does, not HOW.
 * - **No Framework Dependencies**: Zero imports from Hono, Elysia, Express, etc.
 * - **Type Safe**: Full TypeScript support with no `as any` escapes.
 * - **Composable**: Each piece can be used independently.
 *
 * ## Architecture
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────────┐
 * │              worker-config.ts (This File)                       │
 * │  - A2AWorkerConfig type                                         │
 * │  - TaskStoreConfig type                                         │
 * │  - createTaskStore() utility                                    │
 * │  - createA2AExecutor() utility                                  │
 * │  - createA2ARequestHandler() utility                            │
 * └─────────────────────────────────────────────────────────────────┘
 *                              │
 *         ┌────────────────────┼────────────────────┐
 *         │                    │                    │
 *         ▼                    ▼                    ▼
 * ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
 * │ hono-adapter  │   │ elysia-adapter│   │ express-adapter│
 * │ (Workers,     │   │ (Bun, Node)   │   │ (Node.js)      │
 * │  Vercel Edge) │   │               │   │                │
 * └───────────────┘   └───────────────┘   └───────────────┘
 * ```
 *
 * @example Define a worker configuration
 * ```typescript
 * import { defineWorkerConfig } from "a2a-workers-shared";
 *
 * const config = defineWorkerConfig({
 *   agentName: "Hello World Agent",
 *   createAgent: (model) => createHelloWorldAgent(model),
 *   createAgentCard: (baseUrl) => buildAgentCard(baseUrl, { ... }),
 * });
 *
 * // Then use with a framework adapter:
 * // import { createA2AHonoWorker } from "a2a-workers-shared/hono";
 * // export default createA2AHonoWorker(config);
 * ```
 */

import type { LanguageModel } from "ai";
import type { Artifact, AgentCard, Message, Task, TaskState } from "@drew-foxall/a2a-js-sdk";
import {
  DefaultRequestHandler,
  InMemoryTaskStore,
  type TaskStore,
  type AgentExecutor,
} from "@drew-foxall/a2a-js-sdk/server";
import { A2AAdapter, type A2AAdapterConfig } from "@drew-foxall/a2a-ai-sdk-adapter";
import { getModel } from "./utils.js";
import type { Env } from "./types.js";
import {
  createRedisClient,
  createRedisTaskStore,
  isRedisConfigured,
  type RedisEnv,
} from "./redis.js";

// ============================================================================
// Core Types
// ============================================================================

/**
 * Base environment type that all workers must satisfy
 */
export type BaseWorkerEnv = Env;

/**
 * Environment with optional Redis support
 */
export type WorkerEnvWithRedis = BaseWorkerEnv & Partial<RedisEnv>;

/**
 * Task store configuration options
 */
export type TaskStoreConfig =
  | { type: "memory" }
  | { type: "redis"; prefix: string; ttlSeconds?: number }
  | { type: "custom"; factory: <TEnv extends WorkerEnvWithRedis>(env: TEnv) => TaskStore };

/**
 * Artifact generation context passed to generateArtifacts callback
 */
export interface ArtifactGenerationContext {
  taskId: string;
  contextId: string;
  responseText: string;
}

/**
 * Context provided to selectResponseType hook
 */
export interface ResponseTypeSelectionContext {
  /** The incoming user message */
  userMessage: Message;
  /** Existing task if this is a continuation, undefined for new requests */
  existingTask?: Task;
}

/**
 * A2A Adapter configuration options (subset exposed to worker config)
 */
export interface WorkerAdapterOptions {
  /** Adapter mode: "stream" for SSE, "generate" for single response */
  mode?: "stream" | "generate";
  /** Enable debug logging */
  debug?: boolean;
  /** Include conversation history */
  includeHistory?: boolean;
  /** Custom task state parser */
  parseTaskState?: (response: string) => TaskState;
  /** Custom artifact generator */
  generateArtifacts?: (context: ArtifactGenerationContext) => Promise<Artifact[]>;
  /**
   * Determine response type for each request.
   *
   * IMPORTANT (AI SDK workflow alignment):
   * This is intended to be an **agent-owned routing step**, not a client instruction.
   * In A2A, the server must choose whether to return a stateless `Message` or
   * initiate a stateful `Task` **before** it emits any task lifecycle events (and before
   * starting SSE streaming). The most reliable way to do that while keeping the decision
   * "owned by the agent" is to implement a small *routing/classification* step here
   * (AI SDK “Routing” pattern) using a cheap model call or deterministic policy.
   *
   * Continuations:
   * If `existingTask` is present, you should almost always return `"task"` to continue
   * the task lifecycle rather than switching to a stateless message mid-context.
   *
   * A2A protocol allows agents to respond with either:
   * - "message": Stateless, immediate response (no task tracking)
   * - "task": Stateful, tracked operation with lifecycle
   *
   * Use "message" for:
   * - Simple queries with immediate answers
   * - Trivial interactions (greetings, quick Q&A)
   * - Operations that don't need progress tracking or cancellation
   *
   * Use "task" for:
   * - Long-running operations
   * - Multi-step workflows
   * - Operations that benefit from progress tracking
   * - Operations that may need cancellation
   *
   * @param context - Request context with user message and existing task
   * @returns "message" or "task" (sync or async)
   * @default Always returns "task" (backward compatible)
   *
   * @example Always use message (for simple agents like Hello World)
   * ```typescript
   * selectResponseType: () => "message"
   * ```
   *
   * @example Agent-owned routing (AI SDK “Routing” pattern)
   * ```typescript
   * selectResponseType: async ({ userMessage, existingTask }) => {
   *   if (existingTask) return "task";
   *   const { responseType } = await classifyRequest(userMessage);
   *   return responseType; // "message" | "task"
   * }
   * ```
   */
  selectResponseType?: (
    context: ResponseTypeSelectionContext
  ) => "message" | "task" | Promise<"message" | "task">;

  /**
   * Factory for creating `selectResponseType` with access to the runtime model/env.
   *
   * Why this exists:
   * - In Workers, `adapterOptions` is defined at module load time (no access to `env`)
   * - Agent-owned routing (AI SDK “Routing” pattern) often needs a model to run a cheap
   *   classification step (e.g. `generateObject`)
   *
   * If provided, this takes precedence over `selectResponseType`.
   *
   * @example Use the same model as the agent for routing (cheap model recommended)
   * ```ts
   * import { createLLMResponseTypeRouter } from "@drew-foxall/a2a-ai-sdk-adapter";
   *
   * adapterOptions: {
   *   mode: "stream",
   *   selectResponseTypeFactory: ({ model }) =>
   *     createLLMResponseTypeRouter({ model }),
   * }
   * ```
   */
  selectResponseTypeFactory?: (deps: {
    model: LanguageModel;
    env: BaseWorkerEnv;
  }) => (
    context: ResponseTypeSelectionContext
  ) => "message" | "task" | Promise<"message" | "task">;
}

/**
 * Health check response extras factory
 */
export type HealthCheckExtras<TEnv> = (env: TEnv) => Record<string, unknown>;

/**
 * Logger interface (framework-agnostic)
 *
 * This matches the Logger interface from @drew-foxall/a2a-js-sdk/server/hono
 * but is defined here to avoid framework imports.
 */
export interface WorkerLogger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

/**
 * Agent factory function type
 *
 * This is the core abstraction for creating agents. It receives:
 * - model: The language model (from AI SDK)
 * - env: The runtime environment for dependency injection
 *
 * Returns a ToolLoopAgent or compatible agent instance.
 */
/**
 * Agent type - represents an AI SDK ToolLoopAgent or compatible agent
 *
 * The agent must have generate() and stream() methods for execution.
 */
export interface A2ACompatibleAgent {
  generate: (params: { prompt: string }) => PromiseLike<{ text: string }>;
  stream: (params: { prompt: string }) => PromiseLike<{ text: PromiseLike<string> }>;
}

export type AgentFactory<TEnv> = (
  model: LanguageModel,
  env: TEnv
) => A2ACompatibleAgent;

/**
 * Agent card factory function type
 */
export type AgentCardFactory = (baseUrl: string) => AgentCard;

/**
 * Core worker configuration (framework-agnostic)
 *
 * This configuration defines WHAT the worker does, not HOW it serves requests.
 * Framework-specific adapters consume this config to create runnable applications.
 */
export interface A2AWorkerConfig<TEnv extends BaseWorkerEnv = BaseWorkerEnv> {
  /**
   * Agent name displayed in health check and logs
   */
  agentName: string;

  /**
   * Factory function to create the agent
   *
   * Receives the language model and environment for dependency injection.
   * This enables workers to inject runtime-specific dependencies (API keys,
   * service bindings, etc.) into agents.
   *
   * @example Simple agent
   * ```typescript
   * createAgent: (model) => createHelloWorldAgent(model)
   * ```
   *
   * @example Agent with dependencies
   * ```typescript
   * createAgent: (model, env) => {
   *   const octokit = new Octokit({ auth: env.GITHUB_TOKEN });
   *   return createGitHubAgent(model, { client: octokit });
   * }
   * ```
   */
  createAgent: AgentFactory<TEnv>;

  /**
   * Factory function to create the agent card
   *
   * Receives the base URL for the agent endpoint. Use `buildAgentCard()`
   * helper for common configurations.
   *
   * @example
   * ```typescript
   * createAgentCard: (baseUrl) => buildAgentCard(baseUrl, {
   *   name: "My Agent",
   *   description: "Does amazing things",
   *   skills: [mySkill],
   * })
   * ```
   */
  createAgentCard: AgentCardFactory;

  /**
   * A2A adapter options
   * @default { mode: "stream" }
   */
  adapterOptions?: WorkerAdapterOptions;

  /**
   * Task store configuration
   * @default { type: "memory" }
   */
  taskStore?: TaskStoreConfig;

  /**
   * Additional fields to include in health check response
   *
   * @example
   * ```typescript
   * healthCheckExtras: (env) => ({
   *   githubAuth: env.GITHUB_TOKEN ? "authenticated" : "unauthenticated",
   *   features: { redis: isRedisConfigured(env) },
   * })
   * ```
   */
  healthCheckExtras?: HealthCheckExtras<TEnv>;

  /**
   * Custom logger factory
   *
   * If not provided, framework adapters will use their default logger.
   */
  createLogger?: () => WorkerLogger;
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default adapter options
 */
export const DEFAULT_ADAPTER_OPTIONS: WorkerAdapterOptions = {
  mode: "stream",
  debug: false,
};

/**
 * Default task store TTL (7 days)
 */
export const DEFAULT_TASK_TTL_SECONDS = 604800;

// ============================================================================
// Task Store Factory
// ============================================================================

/**
 * Create a task store based on configuration
 *
 * This is a framework-agnostic utility that can be used by any adapter.
 *
 * @param config - Task store configuration
 * @param env - Worker environment
 * @returns TaskStore instance
 */
export function createTaskStore<TEnv extends WorkerEnvWithRedis>(
  config: TaskStoreConfig | undefined,
  env: TEnv
): TaskStore {
  if (!config || config.type === "memory") {
    return new InMemoryTaskStore();
  }

  if (config.type === "redis") {
    if (isRedisConfigured(env)) {
      const redis = createRedisClient(env as RedisEnv);
      return createRedisTaskStore(redis, {
        prefix: config.prefix,
        ttlSeconds: config.ttlSeconds ?? DEFAULT_TASK_TTL_SECONDS,
      });
    }
    // Fall back to in-memory if Redis not configured
    console.warn(`[${config.prefix}] Redis not configured - using InMemoryTaskStore`);
    return new InMemoryTaskStore();
  }

  if (config.type === "custom") {
    return config.factory(env);
  }

  // TypeScript exhaustiveness check
  const _exhaustive: never = config;
  return _exhaustive;
}

// ============================================================================
// A2A Executor Factory
// ============================================================================

/**
 * Create an A2A adapter (AgentExecutor) from configuration
 *
 * This is a framework-agnostic utility that creates the AgentExecutor
 * which bridges AI SDK agents with the A2A protocol.
 *
 * @param config - Worker configuration
 * @param model - Language model instance
 * @param env - Worker environment
 * @returns AgentExecutor instance
 */
export function createA2AExecutor<TEnv extends BaseWorkerEnv>(
  config: A2AWorkerConfig<TEnv>,
  model: LanguageModel,
  env: TEnv
): AgentExecutor {
  const agent = config.createAgent(model, env);

  const selectResponseType =
    config.adapterOptions?.selectResponseTypeFactory?.({
      model,
      env: env as BaseWorkerEnv,
    }) ?? config.adapterOptions?.selectResponseType;

  const adapterOptions: A2AAdapterConfig = {
    mode: config.adapterOptions?.mode ?? DEFAULT_ADAPTER_OPTIONS.mode ?? "stream",
    debug: config.adapterOptions?.debug ?? DEFAULT_ADAPTER_OPTIONS.debug,
    includeHistory: config.adapterOptions?.includeHistory,
    parseTaskState: config.adapterOptions?.parseTaskState,
    generateArtifacts: config.adapterOptions?.generateArtifacts,
    selectResponseType,
  };

  // Cast agent to any for A2AAdapter compatibility - the runtime types are compatible
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new A2AAdapter(agent as any, adapterOptions);
}

// ============================================================================
// Request Handler Factory
// ============================================================================

/**
 * Create a DefaultRequestHandler from configuration
 *
 * This is a framework-agnostic utility that creates the A2A request handler.
 * Framework adapters use this to handle A2A protocol requests.
 *
 * @param config - Worker configuration
 * @param baseUrl - Base URL for the agent endpoint
 * @param env - Worker environment
 * @returns DefaultRequestHandler instance
 */
export function createA2ARequestHandler<TEnv extends WorkerEnvWithRedis>(
  config: A2AWorkerConfig<TEnv>,
  baseUrl: string,
  env: TEnv
): DefaultRequestHandler {
  const model = getModel(env);
  const agentCard = config.createAgentCard(baseUrl);
  const agentExecutor = createA2AExecutor(config, model, env);
  const taskStore = createTaskStore(config.taskStore, env);

  return new DefaultRequestHandler(agentCard, taskStore, agentExecutor);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Define a worker configuration with type inference
 *
 * This is a helper function that provides better TypeScript inference
 * when defining worker configurations.
 *
 * @example
 * ```typescript
 * const config = defineWorkerConfig({
 *   agentName: "Hello World Agent",
 *   createAgent: (model) => createHelloWorldAgent(model),
 *   createAgentCard: (baseUrl) => buildAgentCard(baseUrl, { ... }),
 * });
 * ```
 */
export function defineWorkerConfig<TEnv extends BaseWorkerEnv = BaseWorkerEnv>(
  config: A2AWorkerConfig<TEnv>
): A2AWorkerConfig<TEnv> {
  return config;
}

/**
 * Extract base URL from a request URL
 *
 * Utility function for framework adapters to extract the base URL.
 *
 * @param requestUrl - Full request URL
 * @returns Base URL (protocol + host)
 */
export function extractBaseUrl(requestUrl: string): string {
  const url = new URL(requestUrl);
  return `${url.protocol}//${url.host}`;
}

