/**
 * Console Telemetry Provider
 *
 * A simple telemetry provider that logs to the console. Perfect for:
 * - Local development
 * - Debugging
 * - Simple production environments without full observability stack
 *
 * Features:
 * - Structured JSON output option
 * - Colorized output for readability
 * - Timing information for spans
 * - Works in all JavaScript runtimes
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

export interface ConsoleProviderConfig extends TelemetryConfig {
  /** Output format: "pretty" for human-readable, "json" for structured logs */
  format?: "pretty" | "json";

  /** Minimum severity level to log (default: "debug") */
  minSeverity?: LogSeverity;

  /** Include timestamps in output (default: true) */
  includeTimestamp?: boolean;

  /** Include span timing in output (default: true) */
  includeTiming?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

const SEVERITY_LEVELS: Record<LogSeverity, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
};

const SEVERITY_COLORS: Record<LogSeverity, string> = {
  trace: "\x1b[90m", // Gray
  debug: "\x1b[36m", // Cyan
  info: "\x1b[32m", // Green
  warn: "\x1b[33m", // Yellow
  error: "\x1b[31m", // Red
  fatal: "\x1b[35m", // Magenta
};

const RESET_COLOR = "\x1b[0m";

function generateSpanId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatDuration(startTime: number): string {
  const duration = Date.now() - startTime;
  if (duration < 1000) return `${duration}ms`;
  return `${(duration / 1000).toFixed(2)}s`;
}

// ============================================================================
// Console Span
// ============================================================================

class ConsoleSpan implements Span {
  readonly spanId: string;
  readonly name: string;

  private status: SpanStatus = "unset";
  private statusMessage?: string;
  private attributes: Attributes = {};
  private events: Array<{ name: string; timestamp: string; attributes?: Attributes }> = [];
  private startTime: number;
  private ended = false;

  constructor(
    name: string,
    private config: ConsoleProviderConfig,
    options?: SpanOptions
  ) {
    this.spanId = generateSpanId();
    this.name = name;
    this.startTime = Date.now();

    if (options?.attributes) {
      this.attributes = { ...options.attributes };
    }

    this.logSpanStart();
  }

  private logSpanStart(): void {
    if (this.config.format === "json") {
      console.log(
        JSON.stringify({
          type: "span_start",
          spanId: this.spanId,
          name: this.name,
          timestamp: formatTimestamp(),
          attributes: this.attributes,
        })
      );
    } else {
      const attrs = Object.keys(this.attributes).length
        ? ` ${JSON.stringify(this.attributes)}`
        : "";
      console.log(`\x1b[34m▶ SPAN START\x1b[0m [${this.spanId}] ${this.name}${attrs}`);
    }
  }

  setStatus(status: SpanStatus, message?: string): void {
    if (this.ended) return;
    this.status = status;
    this.statusMessage = message;
  }

  setAttributes(attributes: Attributes): void {
    if (this.ended) return;
    this.attributes = { ...this.attributes, ...attributes };
  }

  setAttribute(key: string, value: AttributeValue): void {
    if (this.ended) return;
    this.attributes[key] = value;
  }

  recordException(error: Error | unknown, attributes?: Attributes): void {
    if (this.ended) return;

    const errorInfo =
      error instanceof Error
        ? { type: error.name, message: error.message, stack: error.stack }
        : { type: "unknown", message: String(error) };

    this.events.push({
      name: "exception",
      timestamp: formatTimestamp(),
      attributes: { ...errorInfo, ...attributes },
    });

    if (this.config.format === "json") {
      console.log(
        JSON.stringify({
          type: "span_exception",
          spanId: this.spanId,
          timestamp: formatTimestamp(),
          error: errorInfo,
          attributes,
        })
      );
    } else {
      console.log(
        `\x1b[31m✕ EXCEPTION\x1b[0m [${this.spanId}] ${errorInfo.type}: ${errorInfo.message}`
      );
    }
  }

  addEvent(name: string, attributes?: Attributes): void {
    if (this.ended) return;

    this.events.push({
      name,
      timestamp: formatTimestamp(),
      attributes,
    });

    if (this.config.format === "json") {
      console.log(
        JSON.stringify({
          type: "span_event",
          spanId: this.spanId,
          name,
          timestamp: formatTimestamp(),
          attributes,
        })
      );
    } else {
      const attrs = attributes ? ` ${JSON.stringify(attributes)}` : "";
      console.log(`  \x1b[90m→ ${name}\x1b[0m${attrs}`);
    }
  }

  end(): void {
    if (this.ended) return;
    this.ended = true;

    const duration = formatDuration(this.startTime);
    const statusColor =
      this.status === "ok" ? "\x1b[32m" : this.status === "error" ? "\x1b[31m" : "\x1b[90m";

    if (this.config.format === "json") {
      console.log(
        JSON.stringify({
          type: "span_end",
          spanId: this.spanId,
          name: this.name,
          timestamp: formatTimestamp(),
          duration: Date.now() - this.startTime,
          status: this.status,
          statusMessage: this.statusMessage,
          attributes: this.attributes,
          events: this.events,
        })
      );
    } else {
      const status = this.statusMessage ? `${this.status}: ${this.statusMessage}` : this.status;
      console.log(
        `${statusColor}◼ SPAN END\x1b[0m [${this.spanId}] ${this.name} (${duration}) status=${status}`
      );
    }
  }

  isRecording(): boolean {
    return !this.ended;
  }
}

// ============================================================================
// Console Provider
// ============================================================================

/**
 * Console Telemetry Provider
 *
 * Outputs telemetry to the console in either human-readable or JSON format.
 *
 * @example
 * ```typescript
 * const telemetry = new ConsoleTelemetryProvider({
 *   serviceName: "dice-agent",
 *   format: "pretty",
 * });
 *
 * const span = telemetry.startSpan("roll-dice", {
 *   attributes: { sides: 20 },
 * });
 *
 * telemetry.log("info", "Rolling dice", { sides: 20 });
 *
 * span.setAttributes({ result: 17 });
 * span.setStatus("ok");
 * span.end();
 * ```
 */
export class ConsoleTelemetryProvider implements TelemetryProvider {
  readonly name = "console";
  readonly enabled: boolean;

  private config: ConsoleProviderConfig;

  constructor(config: ConsoleProviderConfig) {
    this.config = {
      format: "pretty",
      minSeverity: "debug",
      includeTimestamp: true,
      includeTiming: true,
      ...config,
    };
    this.enabled = config.enabled !== false;
  }

  startSpan(name: string, options?: SpanOptions): Span {
    return new ConsoleSpan(name, this.config, options);
  }

  log(severity: LogSeverity, message: string, attributes?: Attributes): void {
    if (!this.enabled) return;

    // Check minimum severity
    if (SEVERITY_LEVELS[severity] < SEVERITY_LEVELS[this.config.minSeverity!]) {
      return;
    }

    if (this.config.format === "json") {
      console.log(
        JSON.stringify({
          type: "log",
          severity,
          message,
          timestamp: formatTimestamp(),
          service: this.config.serviceName,
          attributes,
        })
      );
    } else {
      const color = SEVERITY_COLORS[severity];
      const timestamp = this.config.includeTimestamp ? `[${formatTimestamp()}] ` : "";
      const attrs = attributes ? ` ${JSON.stringify(attributes)}` : "";
      console.log(`${timestamp}${color}${severity.toUpperCase()}${RESET_COLOR} ${message}${attrs}`);
    }
  }

  recordMetric(name: string, value: number, attributes?: Attributes): void {
    if (!this.enabled) return;

    if (this.config.format === "json") {
      console.log(
        JSON.stringify({
          type: "metric",
          name,
          value,
          timestamp: formatTimestamp(),
          attributes,
        })
      );
    } else {
      const attrs = attributes ? ` ${JSON.stringify(attributes)}` : "";
      console.log(`\x1b[35m📊 METRIC\x1b[0m ${name}=${value}${attrs}`);
    }
  }

  async flush(): Promise<void> {
    // Console output is synchronous, nothing to flush
  }

  async shutdown(): Promise<void> {
    // Nothing to clean up
  }
}

/**
 * Create a console telemetry provider
 */
export function createConsoleTelemetry(config: ConsoleProviderConfig): TelemetryProvider {
  return new ConsoleTelemetryProvider(config);
}

