/**
 * OpenTelemetry Provider
 *
 * A telemetry provider that integrates with the OpenTelemetry ecosystem.
 * This provider wraps the OTEL SDK to provide our pluggable interface.
 *
 * Features:
 * - Full OpenTelemetry compatibility
 * - Export to any OTEL-compatible backend (Jaeger, Zipkin, OTLP, etc.)
 * - Distributed tracing with context propagation
 * - Works with existing OTEL instrumentation
 *
 * Prerequisites:
 * - @opentelemetry/api
 * - @opentelemetry/sdk-trace-base (or @opentelemetry/sdk-trace-node)
 * - Your choice of exporter (@opentelemetry/exporter-trace-otlp-http, etc.)
 *
 * Note: This is a "bring your own OTEL" approach - you configure the OTEL SDK
 * externally and this provider uses the global tracer.
 */

import type {
  Attributes,
  AttributeValue,
  LogSeverity,
  Span,
  SpanOptions,
  SpanStatus,
  TelemetryConfig,
  TelemetryProvider,
} from "./types.js";

// ============================================================================
// Configuration
// ============================================================================

export interface OpenTelemetryProviderConfig extends TelemetryConfig {
  /**
   * The tracer name to use (defaults to serviceName)
   * This is used to get or create a tracer from the global provider
   */
  tracerName?: string;

  /**
   * The tracer version (defaults to serviceVersion)
   */
  tracerVersion?: string;

  /**
   * Custom tracer instance (optional)
   * If not provided, uses the global tracer provider
   */
  tracer?: OtelTracer;

  /**
   * Custom logger instance for log correlation (optional)
   */
  logger?: OtelLogger;
}

// ============================================================================
// OpenTelemetry Type Definitions
// ============================================================================

/**
 * Minimal OpenTelemetry Tracer interface
 * This allows type-safe usage without requiring @opentelemetry/api as a dependency
 */
interface OtelTracer {
  startSpan(name: string, options?: OtelSpanOptions): OtelSpan;
}

interface OtelSpanOptions {
  attributes?: Record<string, OtelAttributeValue>;
  kind?: OtelSpanKind;
  root?: boolean;
}

type OtelAttributeValue = string | number | boolean | string[] | number[] | boolean[];
type OtelSpanKind = 0 | 1 | 2 | 3 | 4; // INTERNAL, SERVER, CLIENT, PRODUCER, CONSUMER

interface OtelSpan {
  spanContext(): { traceId: string; spanId: string };
  setAttribute(key: string, value: OtelAttributeValue): void;
  setAttributes(attributes: Record<string, OtelAttributeValue>): void;
  setStatus(status: { code: OtelStatusCode; message?: string }): void;
  recordException(exception: Error | unknown, time?: number): void;
  addEvent(name: string, attributes?: Record<string, OtelAttributeValue>): void;
  end(endTime?: number): void;
  isRecording(): boolean;
}

type OtelStatusCode = 0 | 1 | 2; // UNSET, OK, ERROR

interface OtelLogger {
  emit(record: {
    severityNumber?: number;
    severityText?: string;
    body?: string;
    attributes?: Record<string, OtelAttributeValue>;
  }): void;
}

// ============================================================================
// Status Mapping
// ============================================================================

const STATUS_MAP: Record<SpanStatus, OtelStatusCode> = {
  unset: 0,
  ok: 1,
  error: 2,
};

const SEVERITY_MAP: Record<LogSeverity, number> = {
  trace: 1,
  debug: 5,
  info: 9,
  warn: 13,
  error: 17,
  fatal: 21,
};

const SPAN_KIND_MAP: Record<NonNullable<SpanOptions["kind"]>, OtelSpanKind> = {
  internal: 0,
  server: 1,
  client: 2,
  producer: 3,
  consumer: 4,
};

// ============================================================================
// OpenTelemetry Span Wrapper
// ============================================================================

/**
 * Wraps an OpenTelemetry span to implement our Span interface
 */
class OpenTelemetrySpan implements Span {
  readonly spanId: string;
  readonly name: string;

  constructor(
    name: string,
    private otelSpan: OtelSpan
  ) {
    this.name = name;
    this.spanId = otelSpan.spanContext().spanId;
  }

  setStatus(status: SpanStatus, message?: string): void {
    this.otelSpan.setStatus({
      code: STATUS_MAP[status],
      message,
    });
  }

  setAttributes(attributes: Attributes): void {
    this.otelSpan.setAttributes(attributes as Record<string, OtelAttributeValue>);
  }

  setAttribute(key: string, value: AttributeValue): void {
    this.otelSpan.setAttribute(key, value);
  }

  recordException(error: Error | unknown, attributes?: Attributes): void {
    this.otelSpan.recordException(error);
    if (attributes) {
      this.otelSpan.setAttributes(attributes as Record<string, OtelAttributeValue>);
    }
  }

  addEvent(name: string, attributes?: Attributes): void {
    this.otelSpan.addEvent(name, attributes as Record<string, OtelAttributeValue>);
  }

  end(): void {
    this.otelSpan.end();
  }

  isRecording(): boolean {
    return this.otelSpan.isRecording();
  }
}

// ============================================================================
// OpenTelemetry Provider
// ============================================================================

/**
 * OpenTelemetry Telemetry Provider
 *
 * Wraps the OpenTelemetry SDK to provide our pluggable telemetry interface.
 * This provider uses "bring your own OTEL" - configure the OTEL SDK externally.
 *
 * @example
 * ```typescript
 * // 1. Configure OTEL SDK externally (Node.js example)
 * import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
 * import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
 *
 * const provider = new NodeTracerProvider();
 * provider.addSpanProcessor(new SimpleSpanProcessor(new OTLPTraceExporter()));
 * provider.register();
 *
 * // 2. Create our provider
 * const telemetry = new OpenTelemetryProvider({
 *   serviceName: "dice-agent",
 * });
 *
 * // 3. Use it
 * const span = telemetry.startSpan("roll-dice");
 * span.end();
 * ```
 */
export class OpenTelemetryProvider implements TelemetryProvider {
  readonly name = "opentelemetry";
  readonly enabled: boolean;

  private tracer: OtelTracer | null = null;
  private logger: OtelLogger | null = null;
  private config: OpenTelemetryProviderConfig;

  constructor(config: OpenTelemetryProviderConfig) {
    this.config = config;
    this.enabled = config.enabled !== false;

    if (this.enabled) {
      this.initializeTracer();
    }
  }

  private initializeTracer(): void {
    // Use provided tracer or try to get from global
    if (this.config.tracer) {
      this.tracer = this.config.tracer;
      return;
    }

    // Try to get global tracer (requires @opentelemetry/api to be configured)
    try {
      // Dynamic import to avoid requiring OTEL as a hard dependency
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const otelApi = require("@opentelemetry/api");
      const trace = otelApi.trace;

      if (trace) {
        this.tracer = trace.getTracer(
          this.config.tracerName ?? this.config.serviceName,
          this.config.tracerVersion ?? this.config.serviceVersion
        );
      }
    } catch {
      console.warn(
        "[OpenTelemetryProvider] @opentelemetry/api not found. " +
          "Install it or provide a custom tracer in config."
      );
    }

    // Try to get global logger
    if (this.config.logger) {
      this.logger = this.config.logger;
    }
  }

  startSpan(name: string, options?: SpanOptions): Span {
    if (!this.tracer) {
      // Return a no-op span if tracer not available
      return new NoOpOtelSpan(name);
    }

    const otelOptions: OtelSpanOptions = {};

    if (options?.attributes) {
      otelOptions.attributes = options.attributes as Record<string, OtelAttributeValue>;
    }

    if (options?.kind) {
      otelOptions.kind = SPAN_KIND_MAP[options.kind];
    }

    const otelSpan = this.tracer.startSpan(name, otelOptions);
    return new OpenTelemetrySpan(name, otelSpan);
  }

  log(severity: LogSeverity, message: string, attributes?: Attributes): void {
    if (!this.enabled) return;

    // Use OTEL logger if available
    if (this.logger) {
      this.logger.emit({
        severityNumber: SEVERITY_MAP[severity],
        severityText: severity.toUpperCase(),
        body: message,
        attributes: attributes as Record<string, OtelAttributeValue>,
      });
      return;
    }

    // Fallback to console
    console.log(`[${severity.toUpperCase()}] ${message}`, attributes ?? "");
  }

  recordMetric(name: string, value: number, attributes?: Attributes): void {
    if (!this.enabled) return;

    // Metrics require separate OTEL metrics SDK setup
    // For now, log as a fallback
    console.log(`[METRIC] ${name}=${value}`, attributes ?? "");
  }

  async flush(): Promise<void> {
    // OTEL SDK handles flushing via span processors
    // This is a no-op as the SDK manages its own batching
  }

  async shutdown(): Promise<void> {
    // OTEL SDK handles shutdown via provider.shutdown()
    // This is typically done at application level
  }
}

/**
 * No-op span for when OTEL is not available
 */
class NoOpOtelSpan implements Span {
  readonly spanId = "noop";
  readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  setStatus(): void {}
  setAttributes(): void {}
  setAttribute(): void {}
  recordException(): void {}
  addEvent(): void {}
  end(): void {}
  isRecording(): boolean {
    return false;
  }
}

/**
 * Create an OpenTelemetry provider
 *
 * Note: Requires @opentelemetry/api to be installed and configured.
 * See the OpenTelemetry documentation for SDK setup.
 */
export function createOpenTelemetry(config: OpenTelemetryProviderConfig): TelemetryProvider {
  return new OpenTelemetryProvider(config);
}
