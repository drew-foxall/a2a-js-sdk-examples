/**
 * NoOp Telemetry Provider
 *
 * A silent telemetry provider that does nothing. Use this when:
 * - Telemetry is disabled in production
 * - Running tests that don't need telemetry
 * - Minimizing overhead in performance-critical paths
 *
 * All operations are essentially free (no allocations, no I/O).
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
// NoOp Span
// ============================================================================

/**
 * A span that does nothing - all methods are no-ops
 */
class NoOpSpan implements Span {
  readonly spanId = "noop";
  readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  setStatus(_status: SpanStatus, _message?: string): void {
    // No-op
  }

  setAttributes(_attributes: Attributes): void {
    // No-op
  }

  setAttribute(_key: string, _value: AttributeValue): void {
    // No-op
  }

  recordException(_error: Error | unknown, _attributes?: Attributes): void {
    // No-op
  }

  addEvent(_name: string, _attributes?: Attributes): void {
    // No-op
  }

  end(): void {
    // No-op
  }

  isRecording(): boolean {
    return false;
  }
}

// Singleton instance to avoid allocations
const NOOP_SPAN = new NoOpSpan("noop");

// ============================================================================
// NoOp Provider
// ============================================================================

/**
 * NoOp Telemetry Provider
 *
 * All methods do nothing, making this provider essentially free.
 * Perfect for:
 * - Production when telemetry is disabled
 * - Tests that don't need telemetry
 * - Performance benchmarks
 *
 * @example
 * ```typescript
 * const telemetry = new NoOpTelemetryProvider();
 *
 * // All these calls do nothing
 * const span = telemetry.startSpan("my-operation");
 * span.setAttributes({ key: "value" });
 * span.end();
 * ```
 */
export class NoOpTelemetryProvider implements TelemetryProvider {
  readonly name = "noop";
  readonly enabled = false;

  constructor(_config?: TelemetryConfig) {
    // Config is ignored
  }

  startSpan(_name: string, _options?: SpanOptions): Span {
    return NOOP_SPAN;
  }

  log(_severity: LogSeverity, _message: string, _attributes?: Attributes): void {
    // No-op
  }

  recordMetric(_name: string, _value: number, _attributes?: Attributes): void {
    // No-op
  }

  async flush(): Promise<void> {
    // No-op
  }

  async shutdown(): Promise<void> {
    // No-op
  }
}

/**
 * Create a NoOp telemetry provider
 */
export function createNoOpTelemetry(_config?: TelemetryConfig): TelemetryProvider {
  return new NoOpTelemetryProvider();
}

