# Pluggable Telemetry System

This document describes the pluggable telemetry system for A2A agents, designed to be provider-agnostic while supporting industry standards like OpenTelemetry.

## 🎯 Design Principles

1. **Provider-Agnostic**: Same agent code works with any telemetry backend
2. **Minimal Overhead**: NoOp provider for zero cost when disabled
3. **Semantic Alignment**: Follows OpenTelemetry concepts (spans, events, attributes)
4. **Edge-Compatible**: Works in Cloudflare Workers, Vercel Edge, and Node.js
5. **Pluggable**: Easy to swap providers without code changes

---

## 📦 Available Providers

| Provider | Use Case | Overhead |
|----------|----------|----------|
| `console` | Development, debugging | Low |
| `noop` | Production when disabled | Zero |
| `opentelemetry` | Full observability stack | Medium |
| `custom` | Bring your own | Varies |

---

## 🚀 Quick Start

### Basic Usage

```typescript
import { createTelemetry, AgentAttributes, SpanNames } from "a2a-agents";

// Create a telemetry provider
const telemetry = createTelemetry({
  provider: "console",
  serviceName: "my-agent",
  format: "pretty",
});

// Start a span for an operation
const span = telemetry.startSpan(SpanNames.PROCESS_MESSAGE, {
  attributes: {
    [AgentAttributes.MESSAGE_ID]: "msg-123",
  },
});

try {
  // Do work...
  const result = await processMessage();
  
  span.setAttributes({ "result.length": result.length });
  span.setStatus("ok");
} catch (error) {
  span.recordException(error);
  span.setStatus("error", error.message);
} finally {
  span.end();
}
```

### Environment-Based Provider Selection

```typescript
import { createTelemetry, getDefaultTelemetry } from "a2a-agents";

// Auto-select based on NODE_ENV
const telemetry = getDefaultTelemetry("my-agent");
// - Development: Console (pretty)
// - Production: NoOp (silent)

// Or explicitly configure per environment
const telemetry = createTelemetry(
  process.env.NODE_ENV === "production"
    ? { provider: "opentelemetry", serviceName: "my-agent" }
    : { provider: "console", serviceName: "my-agent", format: "pretty" }
);
```

---

## 📝 Provider Configuration

### Console Provider

Best for development and debugging.

```typescript
const telemetry = createTelemetry({
  provider: "console",
  serviceName: "dice-agent",
  
  // Output format
  format: "pretty",  // or "json" for structured logs
  
  // Minimum log level
  minSeverity: "debug",
  
  // Include timestamps
  includeTimestamp: true,
});
```

**Pretty Output Example:**
```
[2024-12-16T10:30:00.000Z] INFO Processing message {"messageId":"msg-123"}
▶ SPAN START [a1b2c3d4] a2a.process_message
  → tool.called {"name":"rollDice"}
◼ SPAN END [a1b2c3d4] a2a.process_message (45ms) status=ok
```

**JSON Output Example:**
```json
{"type":"log","severity":"info","message":"Processing message","timestamp":"2024-12-16T10:30:00.000Z","service":"dice-agent","attributes":{"messageId":"msg-123"}}
{"type":"span_start","spanId":"a1b2c3d4","name":"a2a.process_message","timestamp":"2024-12-16T10:30:00.000Z"}
{"type":"span_end","spanId":"a1b2c3d4","duration":45,"status":"ok"}
```

### NoOp Provider

Zero overhead when telemetry is disabled.

```typescript
const telemetry = createTelemetry({
  provider: "noop",
  serviceName: "my-agent",
});

// All calls are essentially free
const span = telemetry.startSpan("operation"); // Returns singleton NoOp span
span.setAttributes({ key: "value" });          // Does nothing
span.end();                                     // Does nothing
```

### OpenTelemetry Provider

Full integration with the OpenTelemetry ecosystem.

```typescript
// 1. Configure OTEL SDK (typically in your app's entry point)
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

const otelProvider = new NodeTracerProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: "my-agent",
  }),
});

otelProvider.addSpanProcessor(
  new SimpleSpanProcessor(
    new OTLPTraceExporter({
      url: "http://localhost:4318/v1/traces",
    })
  )
);
otelProvider.register();

// 2. Create our provider (uses global tracer)
import { createTelemetry } from "a2a-agents";

const telemetry = createTelemetry({
  provider: "opentelemetry",
  serviceName: "my-agent",
  serviceVersion: "1.0.0",
});
```

### Custom Provider

Bring your own telemetry backend.

```typescript
import { TelemetryProvider, TelemetryConfig } from "a2a-agents";

class MyCustomProvider implements TelemetryProvider {
  readonly name = "my-custom";
  readonly enabled = true;

  startSpan(name: string, options?: SpanOptions): Span {
    // Create span in your system
  }

  log(severity: LogSeverity, message: string, attributes?: Attributes): void {
    // Log to your system
  }

  recordMetric(name: string, value: number, attributes?: Attributes): void {
    // Record metric in your system
  }

  async flush(): Promise<void> {
    // Ensure all data is sent
  }

  async shutdown(): Promise<void> {
    // Clean up resources
  }
}

const telemetry = createTelemetry({
  provider: "custom",
  serviceName: "my-agent",
  factory: (config) => new MyCustomProvider(config),
});
```

---

## 🏷️ Semantic Conventions

Use the provided constants for consistent attribute naming across agents.

### Agent Attributes

```typescript
import { AgentAttributes } from "a2a-agents";

span.setAttributes({
  [AgentAttributes.AGENT_NAME]: "dice-agent",
  [AgentAttributes.TASK_ID]: "task-123",
  [AgentAttributes.TOOL_NAME]: "rollDice",
  [AgentAttributes.TOOL_DURATION_MS]: 45,
  [AgentAttributes.TOOL_SUCCESS]: true,
});
```

**Available Attributes:**

| Constant | Value | Description |
|----------|-------|-------------|
| `AGENT_NAME` | `agent.name` | Agent identifier |
| `AGENT_VERSION` | `agent.version` | Agent version |
| `AGENT_SKILL` | `agent.skill` | Active skill |
| `MESSAGE_ID` | `message.id` | Message identifier |
| `MESSAGE_ROLE` | `message.role` | user/agent |
| `TASK_ID` | `task.id` | A2A task ID |
| `TASK_STATE` | `task.state` | Task lifecycle state |
| `CONTEXT_ID` | `context.id` | Conversation context |
| `TOOL_NAME` | `tool.name` | Tool being executed |
| `TOOL_DURATION_MS` | `tool.duration_ms` | Execution time |
| `TOOL_SUCCESS` | `tool.success` | Success/failure |
| `MODEL_PROVIDER` | `model.provider` | LLM provider |
| `MODEL_NAME` | `model.name` | Model identifier |

### Span Names

```typescript
import { SpanNames } from "a2a-agents";

// High-level A2A operations
telemetry.startSpan(SpanNames.PROCESS_MESSAGE);
telemetry.startSpan(SpanNames.SEND_RESPONSE);

// Agent operations
telemetry.startSpan(SpanNames.AGENT_THINK);
telemetry.startSpan(SpanNames.AGENT_EXECUTE_TOOL);

// Multi-agent operations
telemetry.startSpan(SpanNames.DISCOVER_AGENT);
telemetry.startSpan(SpanNames.CALL_SUB_AGENT);
```

---

## 🔧 Helper Functions

### Instrument Function

Automatically wrap async functions with telemetry.

```typescript
import { instrument } from "a2a-agents";

const fetchWeather = async (location: string) => {
  // ... actual implementation
};

// Wrap with telemetry
const instrumentedFetchWeather = instrument(
  telemetry,
  "external.fetch_weather",
  fetchWeather,
  (location) => ({ location }) // Extract attributes from args
);

// Use it
const weather = await instrumentedFetchWeather("Tokyo");
// Automatically creates span, tracks timing, records errors
```

---

## 📊 Metrics

Record numeric metrics for monitoring dashboards.

```typescript
// Count operations
telemetry.recordMetric("agent.messages.processed", 1, {
  agentName: "dice-agent",
});

// Track latency
telemetry.recordMetric("agent.response.latency_ms", 234, {
  agentName: "dice-agent",
  success: true,
});

// Track token usage
telemetry.recordMetric("model.tokens.total", 1500, {
  provider: "openai",
  model: "gpt-4o-mini",
});
```

---

## 🔗 Integration Examples

### With Cloudflare Workers

```typescript
// examples/workers/dice-agent/src/index.ts
import { createTelemetry, createInstrumentedDiceAgent } from "a2a-agents";

app.all("/*", async (c) => {
  // Create telemetry (console for dev, noop for prod)
  const telemetry = createTelemetry(
    c.env.TELEMETRY_ENABLED === "true"
      ? { provider: "console", serviceName: "dice-agent", format: "json" }
      : { provider: "noop", serviceName: "dice-agent" }
  );

  const agent = createInstrumentedDiceAgent(getModel(c.env), telemetry);
  // ... rest of handler
});
```

### With Vercel Edge

```typescript
// examples/vercel/dice-agent/api/index.ts
import { createTelemetry, createInstrumentedDiceAgent } from "a2a-agents";

const telemetry = createTelemetry({
  provider: process.env.NODE_ENV === "production" ? "noop" : "console",
  serviceName: "dice-agent-vercel",
});

export default async function handler(req: Request) {
  const agent = createInstrumentedDiceAgent(getModel(), telemetry);
  // ... rest of handler
}
```

### With OpenTelemetry Collector

```typescript
// Setup OTEL SDK to export to collector
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

const exporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318/v1/traces",
});

// Then use our provider
const telemetry = createTelemetry({
  provider: "opentelemetry",
  serviceName: "my-agent",
});
```

---

## 📈 Workflow DevKit Integration

When using Workflow DevKit, telemetry is complementary:

- **Workflow DevKit**: Provides durable execution traces, step history, retry visibility
- **Our Telemetry**: Provides detailed operation spans, custom metrics, log correlation

You can use both:

```typescript
import { createTelemetry } from "a2a-agents";

// Use console telemetry for detailed operation logs
const telemetry = createTelemetry({
  provider: "console",
  serviceName: "travel-planner",
});

// Workflow DevKit handles workflow-level observability
// Our telemetry handles operation-level observability
export async function travelPlannerWorkflow(messages) {
  "use workflow";
  
  const span = telemetry.startSpan("coordinate-agents");
  // ... workflow logic
  span.end();
}
```

---

## 🧪 Testing OpenTelemetry Integration

The telemetry system includes comprehensive E2E tests that verify OpenTelemetry integration works correctly. These tests use the real OTEL SDK with an in-memory exporter to capture and verify spans.

### Running Telemetry Tests

```bash
# Run OpenTelemetry E2E tests
cd examples/agents
pnpm test src/shared/telemetry/opentelemetry.e2e.test.ts
```

### Test Coverage

The E2E tests verify:

| Test Category | What It Tests |
|--------------|---------------|
| **Span Creation** | Spans are created and exported correctly |
| **Attributes** | Span attributes are properly attached |
| **Events** | Span events are recorded |
| **Exceptions** | Errors are recorded with stack traces |
| **Status Codes** | OK, ERROR, UNSET status codes work |
| **Trace Context** | Parent-child span relationships |
| **Async Context** | Trace context propagates across async operations |
| **Agent Workflows** | Complete message processing flow |
| **Multi-Agent** | Agent discovery and coordination tracing |
| **Error Propagation** | Errors propagate through span hierarchy |
| **Semantic Conventions** | A2A attributes and span names |

### Example Test Output

```
✓ src/shared/telemetry/opentelemetry.e2e.test.ts (17 tests) 67ms
  ✓ OpenTelemetry E2E > Span Creation and Export
    ✓ should create and export spans to OTEL collector
    ✓ should include span attributes in exported spans
    ✓ should record span events
    ✓ should record exceptions with stack traces
    ✓ should set span status correctly
  ✓ OpenTelemetry E2E > Trace Context and Hierarchy
    ✓ should create nested spans with parent-child relationship
    ✓ should maintain trace context across async operations
  ✓ OpenTelemetry E2E > Agent Workflow Tracing
    ✓ should trace complete agent message processing flow
    ✓ should trace multi-agent coordination
  ...
```

### Test Setup

The tests use the official OpenTelemetry SDK packages:

```typescript
import { trace, SpanStatusCode, context } from "@opentelemetry/api";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { SimpleSpanProcessor, InMemorySpanExporter } from "@opentelemetry/sdk-trace-base";
import { Resource } from "@opentelemetry/resources";

// Create in-memory exporter to capture spans
const exporter = new InMemorySpanExporter();
const provider = new NodeTracerProvider({
  resource: new Resource({
    "service.name": "a2a-telemetry-test",
  }),
});
provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
provider.register();
```

### Writing Your Own Telemetry Tests

```typescript
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { createTelemetry, SpanNames, AgentAttributes } from "a2a-agents";

describe("My Agent Telemetry", () => {
  let exporter: InMemorySpanExporter;
  let provider: NodeTracerProvider;

  beforeAll(() => {
    exporter = new InMemorySpanExporter();
    provider = new NodeTracerProvider();
    provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
    provider.register();
  });

  beforeEach(() => {
    exporter.reset();
  });

  afterAll(async () => {
    await provider.shutdown();
  });

  it("should trace tool execution", async () => {
    const telemetry = createTelemetry({
      provider: "opentelemetry",
      serviceName: "my-agent",
    });

    const span = telemetry.startSpan(SpanNames.AGENT_EXECUTE_TOOL, {
      attributes: {
        [AgentAttributes.TOOL_NAME]: "myTool",
      },
    });

    // Simulate tool execution
    span.setAttributes({
      [AgentAttributes.TOOL_SUCCESS]: true,
      [AgentAttributes.TOOL_DURATION_MS]: 42,
    });
    span.setStatus("ok");
    span.end();

    await provider.forceFlush();

    const spans = exporter.getFinishedSpans();
    expect(spans.length).toBe(1);
    expect(spans[0].attributes[AgentAttributes.TOOL_NAME]).toBe("myTool");
  });
});
```

---

## 🔗 References

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [OpenTelemetry JavaScript](https://github.com/open-telemetry/opentelemetry-js)
- [Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/)
- [Workflow DevKit Observability](https://useworkflow.dev)

