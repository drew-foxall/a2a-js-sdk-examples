/**
 * Hono Adapter for A2A Workers
 *
 * This module provides the Hono-specific adapter that creates runnable
 * Hono applications from framework-agnostic worker configurations.
 *
 * Supported runtimes:
 * - Cloudflare Workers
 * - Vercel Edge Functions
 * - Node.js (via @hono/node-server)
 * - Deno
 * - Bun
 *
 * @example Cloudflare Workers
 * ```typescript
 * import { defineWorkerConfig } from "a2a-workers-shared";
 * import { createA2AHonoWorker } from "a2a-workers-shared/hono";
 *
 * const config = defineWorkerConfig({
 *   agentName: "Hello World Agent",
 *   createAgent: (model) => createHelloWorldAgent(model),
 *   createAgentCard: (baseUrl) => buildAgentCard(baseUrl, { ... }),
 * });
 *
 * export default createA2AHonoWorker(config);
 * ```
 *
 * @example Vercel Edge
 * ```typescript
 * export const config = { runtime: "edge" };
 *
 * const workerConfig = defineWorkerConfig({ ... });
 * const app = createA2AHonoWorker(workerConfig, {
 *   runtimeName: "Vercel Edge",
 * });
 *
 * export default app.fetch;
 * ```
 */

import { Hono, type Context } from "hono";
import { cors, type CorsOptions } from "hono/cors";
import { A2AHonoApp, ConsoleLogger, NoopLogger } from "@drew-foxall/a2a-js-sdk/server/hono";
import { getModelInfo } from "./utils.js";
import {
  createA2ARequestHandler,
  extractBaseUrl,
  type A2AWorkerConfig,
  type BaseWorkerEnv,
  type WorkerEnvWithRedis,
} from "./worker-config.js";

// ============================================================================
// Hono-Specific Types
// ============================================================================

/**
 * Hono-specific configuration options
 *
 * These options are specific to the Hono framework adapter and control
 * HTTP-level concerns like CORS, routing, and error responses.
 */
export interface HonoWorkerOptions<TEnv extends BaseWorkerEnv = BaseWorkerEnv> {
  /**
   * Custom CORS configuration
   * @default { origin: "*", allowMethods: ["GET", "POST", "OPTIONS"], allowHeaders: ["Content-Type", "Authorization"] }
   */
  corsOptions?: CorsOptions;

  /**
   * Additional routes to add before the A2A handler
   *
   * Useful for custom endpoints beyond health check.
   *
   * @example
   * ```typescript
   * additionalRoutes: (app) => {
   *   app.get("/metrics", (c) => c.json({ requests: 100 }));
   * }
   * ```
   */
  additionalRoutes?: (app: Hono<{ Bindings: TEnv }>) => void;

  /**
   * Custom not found response
   */
  notFoundResponse?: (c: Context<{ Bindings: TEnv }>) => Response | Promise<Response>;

  /**
   * Runtime name for health check (e.g., "Cloudflare Workers", "Vercel Edge")
   * @default "Cloudflare Workers"
   */
  runtimeName?: string;
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default CORS configuration for A2A workers
 */
export const DEFAULT_CORS_OPTIONS: CorsOptions = {
  origin: "*",
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
};

// ============================================================================
// Hono Factory
// ============================================================================

/**
 * Create a Hono-based A2A worker
 *
 * This is the Hono-specific adapter that creates a complete Hono application
 * from the framework-agnostic worker configuration.
 *
 * @param config - Framework-agnostic worker configuration
 * @param options - Hono-specific options
 * @returns Configured Hono application ready for export
 *
 * @example Cloudflare Workers
 * ```typescript
 * // workers/hello-world/src/index.ts
 * import { defineWorkerConfig, buildAgentCard } from "a2a-workers-shared";
 * import { createA2AHonoWorker } from "a2a-workers-shared/hono";
 * import { createHelloWorldAgent } from "a2a-agents";
 *
 * const config = defineWorkerConfig({
 *   agentName: "Hello World Agent",
 *   createAgent: (model) => createHelloWorldAgent(model),
 *   createAgentCard: (baseUrl) => buildAgentCard(baseUrl, {
 *     name: "Hello World Agent",
 *     description: "The simplest possible A2A agent",
 *     skills: [helloWorldSkill],
 *   }),
 * });
 *
 * export default createA2AHonoWorker(config);
 * ```
 *
 * @example With Redis Task Store
 * ```typescript
 * const config = defineWorkerConfig({
 *   agentName: "Expense Agent",
 *   createAgent: (model) => createExpenseAgent(model),
 *   createAgentCard: (baseUrl) => buildAgentCard(baseUrl, { ... }),
 *   taskStore: { type: "redis", prefix: "a2a:expense:" },
 * });
 *
 * export default createA2AHonoWorker(config);
 * ```
 *
 * @example With Custom Health Check
 * ```typescript
 * interface GitHubEnv extends BaseWorkerEnv {
 *   GITHUB_TOKEN?: string;
 * }
 *
 * const config = defineWorkerConfig<GitHubEnv>({
 *   agentName: "GitHub Agent",
 *   createAgent: (model, env) => {
 *     const octokit = new Octokit({ auth: env.GITHUB_TOKEN });
 *     return createGitHubAgent(model, { client: octokit });
 *   },
 *   createAgentCard: (baseUrl) => buildAgentCard(baseUrl, { ... }),
 *   healthCheckExtras: (env) => ({
 *     githubAuth: env.GITHUB_TOKEN ? "authenticated" : "unauthenticated",
 *   }),
 * });
 *
 * export default createA2AHonoWorker(config);
 * ```
 */
export function createA2AHonoWorker<TEnv extends BaseWorkerEnv = BaseWorkerEnv>(
  config: A2AWorkerConfig<TEnv>,
  options: HonoWorkerOptions<TEnv> = {}
): Hono<{ Bindings: TEnv }> {
  const app = new Hono<{ Bindings: TEnv }>();
  const runtimeName = options.runtimeName ?? "Cloudflare Workers";

  // ============================================================================
  // CORS Middleware
  // ============================================================================

  app.use("*", cors(options.corsOptions ?? DEFAULT_CORS_OPTIONS));

  // ============================================================================
  // Health Check Endpoint
  // ============================================================================

  app.get("/health", (c) => {
    const modelInfo = getModelInfo(c.env);
    const extras = config.healthCheckExtras?.(c.env) ?? {};

    return c.json({
      status: "healthy",
      agent: config.agentName,
      provider: modelInfo.provider,
      model: modelInfo.model,
      runtime: runtimeName,
      ...extras,
    });
  });

  // ============================================================================
  // Additional Routes (if configured)
  // ============================================================================

  if (options.additionalRoutes) {
    options.additionalRoutes(app);
  }

  // ============================================================================
  // A2A Protocol Handler
  // ============================================================================

  app.all("/*", async (c, next) => {
    const baseUrl = extractBaseUrl(c.req.url);

    // Create request handler (includes agent, task store, etc.)
    const requestHandler = createA2ARequestHandler(
      config,
      baseUrl,
      c.env as TEnv & WorkerEnvWithRedis
    );

    // Create A2A router using the SDK's Hono adapter
    const a2aRouter = new Hono();
    // Use custom logger if provided, otherwise fall back to ConsoleLogger or NoopLogger
    const logger = config.createLogger?.() ?? (ConsoleLogger?.create?.() ?? NoopLogger);
    const appBuilder = new A2AHonoApp(requestHandler, { logger });
    appBuilder.setupRoutes(a2aRouter);

    // Forward to A2A router
    const a2aResponse = await a2aRouter.fetch(c.req.raw, c.env);

    // If A2A router handled it (not 404), return that response
    if (a2aResponse.status !== 404) {
      return a2aResponse;
    }

    // Otherwise continue to next handler (notFound)
    return next();
  });

  // ============================================================================
  // Not Found Handler
  // ============================================================================

  app.notFound((c) => {
    if (options.notFoundResponse) {
      return options.notFoundResponse(c);
    }

    return c.json(
      {
        error: "Not Found",
        message: "Use /.well-known/agent-card.json to discover this agent",
        endpoints: {
          agentCard: "/.well-known/agent-card.json",
          sendMessage: "/message/send",
          health: "/health",
        },
      },
      404
    );
  });

  return app;
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

// Re-export core config types and functions
export {
  defineWorkerConfig,
  createTaskStore,
  createA2AExecutor,
  createA2ARequestHandler,
  extractBaseUrl,
  DEFAULT_ADAPTER_OPTIONS,
  DEFAULT_TASK_TTL_SECONDS,
  type A2AWorkerConfig,
  type AgentFactory,
  type AgentCardFactory,
  type ArtifactGenerationContext,
  type BaseWorkerEnv,
  type HealthCheckExtras,
  type TaskStoreConfig,
  type WorkerAdapterOptions,
  type WorkerEnvWithRedis,
  type WorkerLogger,
} from "./worker-config.js";

// Re-export agent card utilities
export { buildAgentCard, createSkill, DEFAULT_AGENT_CARD_CONFIG } from "./agent-card.js";
export type { AgentCardOptions, AgentCapabilities } from "./agent-card.js";

// Re-export model utilities
export { getModel, getModelInfo } from "./utils.js";

