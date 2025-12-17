/**
 * Telemetry Abstraction - Core Types
 *
 * This module defines a provider-agnostic telemetry interface that can be
 * implemented by various backends: Console, OpenTelemetry, Workflow DevKit, etc.
 *
 * Design Principles:
 * - Provider-agnostic: Same code works with any telemetry backend
 * - Minimal overhead: NoOp provider for production if telemetry disabled
 * - Semantic alignment: Follows OpenTelemetry concepts (spans, events, attributes)
 * - Edge-compatible: Works in Cloudflare Workers, Vercel Edge, and Node.js
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Attribute values that can be attached to spans and events
 */
export type AttributeValue = string | number | boolean | string[] | number[] | boolean[];

/**
 * Attributes are key-value pairs attached to telemetry data
 */
export type Attributes = Record<string, AttributeValue>;

/**
 * Span status codes following OpenTelemetry conventions
 */
export type SpanStatus = "ok" | "error" | "unset";

/**
 * Severity levels for log events
 */
export type LogSeverity = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

// ============================================================================
// Span Interface
// ============================================================================

/**
 * A Span represents a unit of work or operation.
 *
 * Spans are the building blocks of distributed traces. They represent
 * operations like:
 * - Agent message processing
 * - Tool execution
 * - External API calls
 * - Sub-agent coordination
 *
 * @example
 * ```typescript
 * const span = telemetry.startSpan("process-message", {
 *   "agent.name": "dice-agent",
 *   "message.id": messageId,
 * });
 *
 * try {
 *   const result = await processMessage(message);
 *   span.setAttributes({ "result.length": result.length });
 *   span.setStatus("ok");
 * } catch (error) {
 *   span.recordException(error);
 *   span.setStatus("error", error.message);
 * } finally {
 *   span.end();
 * }
 * ```
 */
export interface Span {
  /** Unique identifier for this span */
  readonly spanId: string;

  /** Name of the span (operation name) */
  readonly name: string;

  /** Set the status of the span */
  setStatus(status: SpanStatus, message?: string): void;

  /** Add attributes to the span */
  setAttributes(attributes: Attributes): void;

  /** Add a single attribute */
  setAttribute(key: string, value: AttributeValue): void;

  /** Record an exception/error that occurred during the span */
  recordException(error: Error | unknown, attributes?: Attributes): void;

  /** Add an event to the span timeline */
  addEvent(name: string, attributes?: Attributes): void;

  /** End the span (must be called to complete the span) */
  end(): void;

  /** Check if the span is recording (not ended) */
  isRecording(): boolean;
}

// ============================================================================
// Telemetry Provider Interface
// ============================================================================

/**
 * Configuration for creating a telemetry provider
 */
export interface TelemetryConfig {
  /** Service name for identifying the agent in traces */
  serviceName: string;

  /** Service version */
  serviceVersion?: string;

  /** Environment (development, staging, production) */
  environment?: string;

  /** Additional default attributes to attach to all spans */
  defaultAttributes?: Attributes;

  /** Whether telemetry is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Options for starting a new span
 */
export interface SpanOptions {
  /** Attributes to attach when creating the span */
  attributes?: Attributes;

  /** Parent span for creating child spans */
  parent?: Span;

  /** Kind of span (internal, server, client, producer, consumer) */
  kind?: "internal" | "server" | "client" | "producer" | "consumer";
}

/**
 * Telemetry Provider Interface
 *
 * Implement this interface to create a custom telemetry backend.
 * The interface is designed to be provider-agnostic while supporting
 * common telemetry patterns.
 *
 * @example
 * ```typescript
 * class MyCustomProvider implements TelemetryProvider {
 *   startSpan(name: string, options?: SpanOptions): Span {
 *     // Create span in your telemetry system
 *   }
 *
 *   log(severity: LogSeverity, message: string, attributes?: Attributes): void {
 *     // Log to your system
 *   }
 *
 *   flush(): Promise<void> {
 *     // Ensure all telemetry is sent
 *   }
 *
 *   shutdown(): Promise<void> {
 *     // Clean up resources
 *   }
 * }
 * ```
 */
export interface TelemetryProvider {
  /** The name of this provider (for debugging) */
  readonly name: string;

  /** Whether telemetry is currently enabled */
  readonly enabled: boolean;

  /**
   * Start a new span for tracking an operation
   *
   * @param name - Operation name (e.g., "process-message", "call-tool")
   * @param options - Span configuration options
   * @returns A Span object to track the operation
   */
  startSpan(name: string, options?: SpanOptions): Span;

  /**
   * Log a message with optional structured attributes
   *
   * @param severity - Log level
   * @param message - Log message
   * @param attributes - Structured data to attach
   */
  log(severity: LogSeverity, message: string, attributes?: Attributes): void;

  /**
   * Record a metric value
   *
   * @param name - Metric name
   * @param value - Numeric value
   * @param attributes - Dimensions/labels for the metric
   */
  recordMetric(name: string, value: number, attributes?: Attributes): void;

  /**
   * Flush any buffered telemetry data
   * Call this before shutting down to ensure all data is sent
   */
  flush(): Promise<void>;

  /**
   * Shutdown the provider and release resources
   */
  shutdown(): Promise<void>;
}

// ============================================================================
// Convenience Types
// ============================================================================

/**
 * Provider type identifiers for factory functions
 */
export type TelemetryProviderType = "console" | "noop" | "opentelemetry" | "workflow" | "custom";

/**
 * Factory function type for creating providers
 */
export type TelemetryProviderFactory = (config: TelemetryConfig) => TelemetryProvider;

// ============================================================================
// Agent-Specific Attributes (Semantic Conventions)
// ============================================================================

/**
 * Standard attribute names for A2A agent telemetry
 *
 * Following OpenTelemetry semantic conventions where applicable,
 * with A2A-specific extensions.
 */
export const AgentAttributes = {
  // Agent identity
  AGENT_NAME: "agent.name",
  AGENT_VERSION: "agent.version",
  AGENT_SKILL: "agent.skill",

  // Message attributes
  MESSAGE_ID: "message.id",
  MESSAGE_ROLE: "message.role",
  MESSAGE_PARTS_COUNT: "message.parts.count",

  // Task attributes
  TASK_ID: "task.id",
  TASK_STATE: "task.state",
  CONTEXT_ID: "context.id",

  // Tool attributes
  TOOL_NAME: "tool.name",
  TOOL_DURATION_MS: "tool.duration_ms",
  TOOL_SUCCESS: "tool.success",

  // Model attributes
  MODEL_PROVIDER: "model.provider",
  MODEL_NAME: "model.name",
  MODEL_TOKENS_INPUT: "model.tokens.input",
  MODEL_TOKENS_OUTPUT: "model.tokens.output",

  // Error attributes
  ERROR_TYPE: "error.type",
  ERROR_MESSAGE: "error.message",

  // A2A Protocol attributes
  A2A_METHOD: "a2a.method",
  A2A_TRANSPORT: "a2a.transport",
} as const;

/**
 * Standard span names for A2A operations
 */
export const SpanNames = {
  // High-level operations
  PROCESS_MESSAGE: "a2a.process_message",
  SEND_RESPONSE: "a2a.send_response",

  // Agent operations
  AGENT_THINK: "agent.think",
  AGENT_EXECUTE_TOOL: "agent.execute_tool",
  AGENT_GENERATE: "agent.generate",

  // Multi-agent operations
  DISCOVER_AGENT: "multiagent.discover",
  CALL_SUB_AGENT: "multiagent.call_sub_agent",
  COORDINATE_AGENTS: "multiagent.coordinate",

  // External operations
  EXTERNAL_API_CALL: "external.api_call",
  DATABASE_QUERY: "external.database_query",
} as const;
