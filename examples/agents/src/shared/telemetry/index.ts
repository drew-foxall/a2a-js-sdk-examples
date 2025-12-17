/**
 * Pluggable Telemetry System
 *
 * A provider-agnostic telemetry abstraction for A2A agents.
 *
 * Supported Providers:
 * - `console` - Simple console logging (great for development)
 * - `noop` - Silent no-op (for production when telemetry disabled)
 * - `opentelemetry` - Full OpenTelemetry integration
 * - `custom` - Bring your own provider
 *
 * @example
 * ```typescript
 * // Console telemetry for development
 * const telemetry = createTelemetry({
 *   provider: "console",
 *   serviceName: "dice-agent",
 *   format: "pretty",
 * });
 *
 * // OpenTelemetry for production
 * const telemetry = createTelemetry({
 *   provider: "opentelemetry",
 *   serviceName: "dice-agent",
 * });
 *
 * // Usage
 * const span = telemetry.startSpan("process-message", {
 *   attributes: { "message.id": "123" },
 * });
 *
 * try {
 *   const result = await processMessage();
 *   span.setStatus("ok");
 * } catch (error) {
 *   span.recordException(error);
 *   span.setStatus("error");
 * } finally {
 *   span.end();
 * }
 * ```
 *
 * @module telemetry
 */

// ============================================================================
// Type Exports
// ============================================================================

export type {
  Attributes,
  AttributeValue,
  LogSeverity,
  Span,
  SpanOptions,
  SpanStatus,
  TelemetryConfig,
  TelemetryProvider,
  TelemetryProviderFactory,
  TelemetryProviderType,
} from "./types.js";

export { AgentAttributes, SpanNames } from "./types.js";

// ============================================================================
// Provider Exports
// ============================================================================

export {
  type ConsoleProviderConfig,
  ConsoleTelemetryProvider,
  createConsoleTelemetry,
} from "./console.js";
export { createNoOpTelemetry, NoOpTelemetryProvider } from "./noop.js";
export {
  createOpenTelemetry,
  OpenTelemetryProvider,
  type OpenTelemetryProviderConfig,
} from "./opentelemetry.js";

// ============================================================================
// Factory Function
// ============================================================================

import { type ConsoleProviderConfig, createConsoleTelemetry } from "./console.js";
import { createNoOpTelemetry } from "./noop.js";
import { createOpenTelemetry, type OpenTelemetryProviderConfig } from "./opentelemetry.js";
import type { TelemetryConfig, TelemetryProvider } from "./types.js";

/**
 * Options for creating a telemetry provider
 */
export type CreateTelemetryOptions =
  | ({ provider: "console" } & ConsoleProviderConfig)
  | ({ provider: "noop" } & TelemetryConfig)
  | ({ provider: "opentelemetry" } & OpenTelemetryProviderConfig)
  | ({
      provider: "custom";
      factory: (config: TelemetryConfig) => TelemetryProvider;
    } & TelemetryConfig);

/**
 * Create a telemetry provider based on configuration
 *
 * This is the main entry point for creating telemetry providers.
 * Use this factory function to create the appropriate provider based on
 * your environment and requirements.
 *
 * @example
 * ```typescript
 * // Development: Human-readable console output
 * const devTelemetry = createTelemetry({
 *   provider: "console",
 *   serviceName: "my-agent",
 *   format: "pretty",
 * });
 *
 * // Production with OTEL: Full distributed tracing
 * const prodTelemetry = createTelemetry({
 *   provider: "opentelemetry",
 *   serviceName: "my-agent",
 *   serviceVersion: "1.0.0",
 * });
 *
 * // Disabled: No overhead
 * const noopTelemetry = createTelemetry({
 *   provider: "noop",
 *   serviceName: "my-agent",
 * });
 *
 * // Custom provider
 * const customTelemetry = createTelemetry({
 *   provider: "custom",
 *   serviceName: "my-agent",
 *   factory: (config) => new MyCustomProvider(config),
 * });
 * ```
 */
export function createTelemetry(options: CreateTelemetryOptions): TelemetryProvider {
  switch (options.provider) {
    case "console":
      return createConsoleTelemetry(options);

    case "noop":
      return createNoOpTelemetry(options);

    case "opentelemetry":
      return createOpenTelemetry(options);

    case "custom":
      return options.factory(options);

    default: {
      const exhaustiveCheck: never = options;
      throw new Error(
        `Unknown telemetry provider: ${(exhaustiveCheck as CreateTelemetryOptions).provider}`
      );
    }
  }
}

/**
 * Get the default telemetry provider based on environment
 *
 * - Development (NODE_ENV !== "production"): Console with pretty format
 * - Production (NODE_ENV === "production"): NoOp (silent)
 *
 * Override by passing explicit options to createTelemetry().
 */
export function getDefaultTelemetry(serviceName: string): TelemetryProvider {
  const isProduction = typeof process !== "undefined" && process.env?.NODE_ENV === "production";

  if (isProduction) {
    return createTelemetry({
      provider: "noop",
      serviceName,
    });
  }

  return createTelemetry({
    provider: "console",
    serviceName,
    format: "pretty",
    minSeverity: "debug",
  });
}

// ============================================================================
// Helper: Instrumented Function Wrapper
// ============================================================================

/**
 * Wrap a function with automatic span creation and error handling
 *
 * @example
 * ```typescript
 * const instrumentedProcess = instrument(
 *   telemetry,
 *   "process-message",
 *   async (message: string) => {
 *     return await someAsyncOperation(message);
 *   }
 * );
 *
 * const result = await instrumentedProcess("hello");
 * ```
 */
export function instrument<TArgs extends unknown[], TResult>(
  telemetry: TelemetryProvider,
  spanName: string,
  fn: (...args: TArgs) => Promise<TResult>,
  getAttributes?: (...args: TArgs) => Record<string, AttributeValue>
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const attributes = getAttributes?.(...args);
    const span = telemetry.startSpan(spanName, { attributes });

    try {
      const result = await fn(...args);
      span.setStatus("ok");
      return result;
    } catch (error) {
      span.recordException(error);
      span.setStatus("error", error instanceof Error ? error.message : "Unknown error");
      throw error;
    } finally {
      span.end();
    }
  };
}

import type { AttributeValue } from "./types.js";
