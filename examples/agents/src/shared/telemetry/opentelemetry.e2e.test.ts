/**
 * OpenTelemetry E2E Tests
 *
 * These tests verify that OpenTelemetry integration works correctly
 * by setting up a real OTEL SDK with an in-memory exporter to capture
 * and verify spans, attributes, and trace propagation.
 *
 * This tests the full telemetry pipeline:
 * 1. Our TelemetryProvider abstraction
 * 2. OpenTelemetry SDK integration
 * 3. Span creation, attributes, events, and status
 * 4. Trace context propagation
 * 5. Agent-specific semantic conventions
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { trace, SpanStatusCode, context } from "@opentelemetry/api";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { SimpleSpanProcessor, InMemorySpanExporter } from "@opentelemetry/sdk-trace-base";
import { Resource } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

import {
  createTelemetry,
  OpenTelemetryProvider,
  AgentAttributes,
  SpanNames,
  instrument,
} from "./index.js";

// ============================================================================
// Test Setup - Real OpenTelemetry SDK
// ============================================================================

let provider: NodeTracerProvider;
let exporter: InMemorySpanExporter;

beforeAll(() => {
  // Create in-memory exporter to capture spans for verification
  exporter = new InMemorySpanExporter();

  // Create a real OTEL provider with our test exporter
  provider = new NodeTracerProvider({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: "a2a-telemetry-test",
      [ATTR_SERVICE_VERSION]: "1.0.0",
    }),
  });

  // Use SimpleSpanProcessor for immediate span export (no batching delay)
  provider.addSpanProcessor(new SimpleSpanProcessor(exporter));

  // Register as global tracer provider
  provider.register();
});

afterAll(async () => {
  await provider.shutdown();
});

beforeEach(() => {
  // Clear spans before each test
  exporter.reset();
});

// ============================================================================
// OpenTelemetry Provider E2E Tests
// ============================================================================

describe("OpenTelemetry E2E", () => {
  describe("Span Creation and Export", () => {
    it("should create and export spans to OTEL collector", async () => {
      const telemetry = new OpenTelemetryProvider({
        serviceName: "test-agent",
        serviceVersion: "1.0.0",
      });

      const span = telemetry.startSpan("test-operation");
      span.setStatus("ok");
      span.end();

      // Force flush to ensure spans are exported
      await provider.forceFlush();

      const spans = exporter.getFinishedSpans();
      expect(spans.length).toBe(1);
      expect(spans[0].name).toBe("test-operation");
      expect(spans[0].status.code).toBe(SpanStatusCode.OK);
    });

    it("should include span attributes in exported spans", async () => {
      const telemetry = new OpenTelemetryProvider({
        serviceName: "test-agent",
      });

      const span = telemetry.startSpan("attributed-operation", {
        attributes: {
          [AgentAttributes.AGENT_NAME]: "dice-agent",
          [AgentAttributes.TASK_ID]: "task-123",
        },
      });

      span.setAttribute(AgentAttributes.TOOL_NAME, "rollDice");
      span.setAttributes({
        [AgentAttributes.TOOL_SUCCESS]: true,
        [AgentAttributes.TOOL_DURATION_MS]: 42,
      });
      span.end();

      await provider.forceFlush();

      const spans = exporter.getFinishedSpans();
      expect(spans.length).toBe(1);

      const exportedSpan = spans[0];
      expect(exportedSpan.attributes[AgentAttributes.AGENT_NAME]).toBe("dice-agent");
      expect(exportedSpan.attributes[AgentAttributes.TASK_ID]).toBe("task-123");
      expect(exportedSpan.attributes[AgentAttributes.TOOL_NAME]).toBe("rollDice");
      expect(exportedSpan.attributes[AgentAttributes.TOOL_SUCCESS]).toBe(true);
      expect(exportedSpan.attributes[AgentAttributes.TOOL_DURATION_MS]).toBe(42);
    });

    it("should record span events", async () => {
      const telemetry = new OpenTelemetryProvider({
        serviceName: "test-agent",
      });

      const span = telemetry.startSpan("event-operation");
      span.addEvent("tool.started", { "tool.name": "rollDice" });
      span.addEvent("tool.completed", { "tool.result": 6 });
      span.end();

      await provider.forceFlush();

      const spans = exporter.getFinishedSpans();
      expect(spans.length).toBe(1);

      const events = spans[0].events;
      expect(events.length).toBe(2);
      expect(events[0].name).toBe("tool.started");
      expect(events[0].attributes?.["tool.name"]).toBe("rollDice");
      expect(events[1].name).toBe("tool.completed");
      expect(events[1].attributes?.["tool.result"]).toBe(6);
    });

    it("should record exceptions with stack traces", async () => {
      const telemetry = new OpenTelemetryProvider({
        serviceName: "test-agent",
      });

      const span = telemetry.startSpan("error-operation");
      const error = new Error("Test error for telemetry");
      span.recordException(error);
      span.setStatus("error", error.message);
      span.end();

      await provider.forceFlush();

      const spans = exporter.getFinishedSpans();
      expect(spans.length).toBe(1);

      const exportedSpan = spans[0];
      expect(exportedSpan.status.code).toBe(SpanStatusCode.ERROR);
      expect(exportedSpan.status.message).toBe("Test error for telemetry");

      // Exception should be recorded as an event
      const exceptionEvent = exportedSpan.events.find((e) => e.name === "exception");
      expect(exceptionEvent).toBeDefined();
    });

    it("should set span status correctly", async () => {
      const telemetry = new OpenTelemetryProvider({
        serviceName: "test-agent",
      });

      // Test OK status
      const okSpan = telemetry.startSpan("ok-operation");
      okSpan.setStatus("ok");
      okSpan.end();

      // Test error status
      const errorSpan = telemetry.startSpan("error-operation");
      errorSpan.setStatus("error", "Something went wrong");
      errorSpan.end();

      // Test unset status
      const unsetSpan = telemetry.startSpan("unset-operation");
      unsetSpan.setStatus("unset");
      unsetSpan.end();

      await provider.forceFlush();

      const spans = exporter.getFinishedSpans();
      expect(spans.length).toBe(3);

      const okExported = spans.find((s) => s.name === "ok-operation");
      const errorExported = spans.find((s) => s.name === "error-operation");
      const unsetExported = spans.find((s) => s.name === "unset-operation");

      expect(okExported?.status.code).toBe(SpanStatusCode.OK);
      expect(errorExported?.status.code).toBe(SpanStatusCode.ERROR);
      expect(errorExported?.status.message).toBe("Something went wrong");
      expect(unsetExported?.status.code).toBe(SpanStatusCode.UNSET);
    });
  });

  describe("Trace Context and Hierarchy", () => {
    it("should create nested spans with parent-child relationship", async () => {
      const telemetry = new OpenTelemetryProvider({
        serviceName: "test-agent",
      });

      // Use OTEL context to create parent-child relationship
      const tracer = trace.getTracer("test-agent");

      const parentSpan = tracer.startSpan(SpanNames.PROCESS_MESSAGE);

      // Create child span within parent context
      context.with(trace.setSpan(context.active(), parentSpan), () => {
        const childSpan = tracer.startSpan(SpanNames.AGENT_EXECUTE_TOOL);
        childSpan.setAttribute(AgentAttributes.TOOL_NAME, "rollDice");
        childSpan.end();
      });

      parentSpan.end();

      await provider.forceFlush();

      const spans = exporter.getFinishedSpans();
      expect(spans.length).toBe(2);

      const parent = spans.find((s) => s.name === SpanNames.PROCESS_MESSAGE);
      const child = spans.find((s) => s.name === SpanNames.AGENT_EXECUTE_TOOL);

      expect(parent).toBeDefined();
      expect(child).toBeDefined();

      // Verify parent-child relationship via trace ID and parent span ID
      expect(child?.spanContext().traceId).toBe(parent?.spanContext().traceId);
      expect(child?.parentSpanId).toBe(parent?.spanContext().spanId);
    });

    it("should maintain trace context across async operations", async () => {
      const tracer = trace.getTracer("test-agent");

      const rootSpan = tracer.startSpan("root-operation");

      await context.with(trace.setSpan(context.active(), rootSpan), async () => {
        // Simulate async operation
        await new Promise((resolve) => setTimeout(resolve, 10));

        const asyncSpan = tracer.startSpan("async-child");
        asyncSpan.end();
      });

      rootSpan.end();

      await provider.forceFlush();

      const spans = exporter.getFinishedSpans();
      expect(spans.length).toBe(2);

      const root = spans.find((s) => s.name === "root-operation");
      const asyncChild = spans.find((s) => s.name === "async-child");

      // Both should share the same trace ID
      expect(asyncChild?.spanContext().traceId).toBe(root?.spanContext().traceId);
    });
  });

  describe("Agent Workflow Tracing", () => {
    it("should trace complete agent message processing flow", async () => {
      const telemetry = new OpenTelemetryProvider({
        serviceName: "dice-agent",
        serviceVersion: "1.0.0",
      });

      const tracer = trace.getTracer("dice-agent");

      // Simulate full agent workflow
      const processSpan = tracer.startSpan(SpanNames.PROCESS_MESSAGE, {
        attributes: {
          [AgentAttributes.AGENT_NAME]: "dice-agent",
          [AgentAttributes.MESSAGE_ID]: "msg-abc123",
          [AgentAttributes.CONTEXT_ID]: "ctx-xyz789",
        },
      });

      await context.with(trace.setSpan(context.active(), processSpan), async () => {
        // Agent thinking
        const thinkSpan = tracer.startSpan(SpanNames.AGENT_THINK);
        await new Promise((resolve) => setTimeout(resolve, 5));
        thinkSpan.end();

        // Tool execution
        const toolSpan = tracer.startSpan(SpanNames.AGENT_EXECUTE_TOOL, {
          attributes: {
            [AgentAttributes.TOOL_NAME]: "rollDice",
          },
        });

        toolSpan.addEvent("dice.rolling", { sides: 20 });

        // Simulate tool execution
        const result = Math.floor(Math.random() * 20) + 1;

        toolSpan.addEvent("dice.rolled", { result });
        toolSpan.setAttributes({
          [AgentAttributes.TOOL_SUCCESS]: true,
          [AgentAttributes.TOOL_DURATION_MS]: 15,
          "dice.result": result,
        });
        toolSpan.end();

        // Response generation
        const responseSpan = tracer.startSpan(SpanNames.SEND_RESPONSE);
        responseSpan.setAttributes({
          "response.length": 42,
        });
        responseSpan.end();
      });

      processSpan.setStatus({ code: SpanStatusCode.OK });
      processSpan.end();

      await provider.forceFlush();

      const spans = exporter.getFinishedSpans();

      // Should have 4 spans: process, think, tool, response
      expect(spans.length).toBe(4);

      // Verify span names
      const spanNames = spans.map((s) => s.name);
      expect(spanNames).toContain(SpanNames.PROCESS_MESSAGE);
      expect(spanNames).toContain(SpanNames.AGENT_THINK);
      expect(spanNames).toContain(SpanNames.AGENT_EXECUTE_TOOL);
      expect(spanNames).toContain(SpanNames.SEND_RESPONSE);

      // All should share same trace ID
      const traceIds = new Set(spans.map((s) => s.spanContext().traceId));
      expect(traceIds.size).toBe(1);

      // Verify tool span has expected attributes
      const toolSpan = spans.find((s) => s.name === SpanNames.AGENT_EXECUTE_TOOL);
      expect(toolSpan?.attributes[AgentAttributes.TOOL_NAME]).toBe("rollDice");
      expect(toolSpan?.attributes[AgentAttributes.TOOL_SUCCESS]).toBe(true);
      expect(toolSpan?.events.length).toBe(2);
    });

    it("should trace multi-agent coordination", async () => {
      const tracer = trace.getTracer("orchestrator-agent");

      const coordinateSpan = tracer.startSpan(SpanNames.COORDINATE_AGENTS, {
        attributes: {
          [AgentAttributes.AGENT_NAME]: "travel-planner",
          "agents.count": 2,
        },
      });

      await context.with(trace.setSpan(context.active(), coordinateSpan), async () => {
        // Discover weather agent
        const discoverWeatherSpan = tracer.startSpan(SpanNames.DISCOVER_AGENT, {
          attributes: { "agent.target": "weather-agent" },
        });
        discoverWeatherSpan.end();

        // Call weather agent
        const callWeatherSpan = tracer.startSpan(SpanNames.CALL_SUB_AGENT, {
          attributes: {
            "subagent.name": "weather-agent",
            "subagent.url": "http://weather-agent.local",
          },
        });
        await new Promise((resolve) => setTimeout(resolve, 10));
        callWeatherSpan.setAttributes({ "subagent.response.status": "completed" });
        callWeatherSpan.end();

        // Discover airbnb agent
        const discoverAirbnbSpan = tracer.startSpan(SpanNames.DISCOVER_AGENT, {
          attributes: { "agent.target": "airbnb-agent" },
        });
        discoverAirbnbSpan.end();

        // Call airbnb agent
        const callAirbnbSpan = tracer.startSpan(SpanNames.CALL_SUB_AGENT, {
          attributes: {
            "subagent.name": "airbnb-agent",
            "subagent.url": "http://airbnb-agent.local",
          },
        });
        await new Promise((resolve) => setTimeout(resolve, 10));
        callAirbnbSpan.setAttributes({ "subagent.response.status": "completed" });
        callAirbnbSpan.end();
      });

      coordinateSpan.setStatus({ code: SpanStatusCode.OK });
      coordinateSpan.end();

      await provider.forceFlush();

      const spans = exporter.getFinishedSpans();

      // Should have 5 spans: coordinate, 2x discover, 2x call
      expect(spans.length).toBe(5);

      // Verify all spans share same trace
      const traceIds = new Set(spans.map((s) => s.spanContext().traceId));
      expect(traceIds.size).toBe(1);

      // Verify sub-agent calls
      const subAgentCalls = spans.filter((s) => s.name === SpanNames.CALL_SUB_AGENT);
      expect(subAgentCalls.length).toBe(2);

      const subAgentNames = subAgentCalls.map((s) => s.attributes["subagent.name"]);
      expect(subAgentNames).toContain("weather-agent");
      expect(subAgentNames).toContain("airbnb-agent");
    });
  });

  describe("Error Handling and Propagation", () => {
    it("should trace error scenarios with proper status", async () => {
      const tracer = trace.getTracer("test-agent");

      const span = tracer.startSpan(SpanNames.AGENT_EXECUTE_TOOL, {
        attributes: {
          [AgentAttributes.TOOL_NAME]: "failingTool",
        },
      });

      try {
        // Simulate tool failure
        throw new Error("Tool execution failed: API rate limited");
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: (error as Error).message,
        });
        span.setAttributes({
          [AgentAttributes.TOOL_SUCCESS]: false,
          [AgentAttributes.ERROR_TYPE]: "RateLimitError",
          [AgentAttributes.ERROR_MESSAGE]: (error as Error).message,
        });
      } finally {
        span.end();
      }

      await provider.forceFlush();

      const spans = exporter.getFinishedSpans();
      expect(spans.length).toBe(1);

      const errorSpan = spans[0];
      expect(errorSpan.status.code).toBe(SpanStatusCode.ERROR);
      expect(errorSpan.attributes[AgentAttributes.TOOL_SUCCESS]).toBe(false);
      expect(errorSpan.attributes[AgentAttributes.ERROR_TYPE]).toBe("RateLimitError");
      expect(errorSpan.events.some((e) => e.name === "exception")).toBe(true);
    });

    it("should propagate errors through span hierarchy", async () => {
      const tracer = trace.getTracer("test-agent");

      const parentSpan = tracer.startSpan(SpanNames.PROCESS_MESSAGE);
      let childError: Error | null = null;

      try {
        await context.with(trace.setSpan(context.active(), parentSpan), async () => {
          const childSpan = tracer.startSpan(SpanNames.AGENT_EXECUTE_TOOL);

          try {
            throw new Error("Child operation failed");
          } catch (error) {
            childError = error as Error;
            childSpan.recordException(error as Error);
            childSpan.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
            childSpan.end();
            throw error;
          }
        });
      } catch {
        parentSpan.recordException(childError!);
        parentSpan.setStatus({ code: SpanStatusCode.ERROR, message: "Child operation failed" });
      } finally {
        parentSpan.end();
      }

      await provider.forceFlush();

      const spans = exporter.getFinishedSpans();
      expect(spans.length).toBe(2);

      // Both spans should have error status
      expect(spans.every((s) => s.status.code === SpanStatusCode.ERROR)).toBe(true);

      // Both should have exception events
      expect(spans.every((s) => s.events.some((e) => e.name === "exception"))).toBe(true);
    });
  });

  describe("Instrument Helper Integration", () => {
    it("should work with instrument helper", async () => {
      const telemetry = new OpenTelemetryProvider({
        serviceName: "test-agent",
      });

      const rollDice = async (sides: number): Promise<number> => {
        return Math.floor(Math.random() * sides) + 1;
      };

      const instrumentedRollDice = instrument(
        telemetry,
        "dice.roll",
        rollDice,
        (sides) => ({ "dice.sides": sides })
      );

      const result = await instrumentedRollDice(20);

      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(20);

      await provider.forceFlush();

      const spans = exporter.getFinishedSpans();
      expect(spans.length).toBe(1);
      expect(spans[0].name).toBe("dice.roll");
      expect(spans[0].attributes["dice.sides"]).toBe(20);
      expect(spans[0].status.code).toBe(SpanStatusCode.OK);
    });

    it("should capture errors in instrumented functions", async () => {
      const telemetry = new OpenTelemetryProvider({
        serviceName: "test-agent",
      });

      const failingOperation = async (): Promise<never> => {
        throw new Error("Instrumented function failed");
      };

      const instrumentedFailing = instrument(telemetry, "failing.operation", failingOperation);

      await expect(instrumentedFailing()).rejects.toThrow("Instrumented function failed");

      await provider.forceFlush();

      const spans = exporter.getFinishedSpans();
      expect(spans.length).toBe(1);
      expect(spans[0].status.code).toBe(SpanStatusCode.ERROR);
      expect(spans[0].events.some((e) => e.name === "exception")).toBe(true);
    });
  });

  describe("Semantic Conventions Verification", () => {
    it("should use correct A2A semantic conventions", async () => {
      const tracer = trace.getTracer("a2a-agent");

      const span = tracer.startSpan(SpanNames.PROCESS_MESSAGE, {
        attributes: {
          // Agent identity
          [AgentAttributes.AGENT_NAME]: "dice-agent",
          [AgentAttributes.AGENT_VERSION]: "1.0.0",
          [AgentAttributes.AGENT_SKILL]: "roll-dice",

          // Message context
          [AgentAttributes.MESSAGE_ID]: "msg-123",
          [AgentAttributes.MESSAGE_ROLE]: "user",
          [AgentAttributes.MESSAGE_PARTS_COUNT]: 1,

          // Task context
          [AgentAttributes.TASK_ID]: "task-456",
          [AgentAttributes.TASK_STATE]: "working",
          [AgentAttributes.CONTEXT_ID]: "ctx-789",

          // A2A protocol
          [AgentAttributes.A2A_METHOD]: "message/send",
          [AgentAttributes.A2A_TRANSPORT]: "http",
        },
      });

      span.end();

      await provider.forceFlush();

      const spans = exporter.getFinishedSpans();
      const exportedSpan = spans[0];

      // Verify all semantic conventions are present
      expect(exportedSpan.attributes[AgentAttributes.AGENT_NAME]).toBe("dice-agent");
      expect(exportedSpan.attributes[AgentAttributes.AGENT_VERSION]).toBe("1.0.0");
      expect(exportedSpan.attributes[AgentAttributes.AGENT_SKILL]).toBe("roll-dice");
      expect(exportedSpan.attributes[AgentAttributes.MESSAGE_ID]).toBe("msg-123");
      expect(exportedSpan.attributes[AgentAttributes.TASK_ID]).toBe("task-456");
      expect(exportedSpan.attributes[AgentAttributes.CONTEXT_ID]).toBe("ctx-789");
      expect(exportedSpan.attributes[AgentAttributes.A2A_METHOD]).toBe("message/send");
    });

    it("should use correct tool execution conventions", async () => {
      const tracer = trace.getTracer("a2a-agent");

      const span = tracer.startSpan(SpanNames.AGENT_EXECUTE_TOOL, {
        attributes: {
          [AgentAttributes.TOOL_NAME]: "rollDice",
        },
      });

      // Simulate tool execution
      const startTime = Date.now();
      await new Promise((resolve) => setTimeout(resolve, 10));
      const duration = Date.now() - startTime;

      span.setAttributes({
        [AgentAttributes.TOOL_SUCCESS]: true,
        [AgentAttributes.TOOL_DURATION_MS]: duration,
      });

      span.end();

      await provider.forceFlush();

      const spans = exporter.getFinishedSpans();
      const toolSpan = spans[0];

      expect(toolSpan.name).toBe(SpanNames.AGENT_EXECUTE_TOOL);
      expect(toolSpan.attributes[AgentAttributes.TOOL_NAME]).toBe("rollDice");
      expect(toolSpan.attributes[AgentAttributes.TOOL_SUCCESS]).toBe(true);
      expect(toolSpan.attributes[AgentAttributes.TOOL_DURATION_MS]).toBeGreaterThanOrEqual(10);
    });

    it("should use correct model conventions", async () => {
      const tracer = trace.getTracer("a2a-agent");

      const span = tracer.startSpan(SpanNames.AGENT_GENERATE, {
        attributes: {
          [AgentAttributes.MODEL_PROVIDER]: "openai",
          [AgentAttributes.MODEL_NAME]: "gpt-4o-mini",
        },
      });

      // Simulate LLM call
      span.setAttributes({
        [AgentAttributes.MODEL_TOKENS_INPUT]: 150,
        [AgentAttributes.MODEL_TOKENS_OUTPUT]: 75,
      });

      span.end();

      await provider.forceFlush();

      const spans = exporter.getFinishedSpans();
      const modelSpan = spans[0];

      expect(modelSpan.attributes[AgentAttributes.MODEL_PROVIDER]).toBe("openai");
      expect(modelSpan.attributes[AgentAttributes.MODEL_NAME]).toBe("gpt-4o-mini");
      expect(modelSpan.attributes[AgentAttributes.MODEL_TOKENS_INPUT]).toBe(150);
      expect(modelSpan.attributes[AgentAttributes.MODEL_TOKENS_OUTPUT]).toBe(75);
    });
  });
});

describe("OpenTelemetry Factory Integration", () => {
  it("should create working provider via createTelemetry factory", async () => {
    const telemetry = createTelemetry({
      provider: "opentelemetry",
      serviceName: "factory-test",
      serviceVersion: "1.0.0",
    });

    expect(telemetry.name).toBe("opentelemetry");
    expect(telemetry.enabled).toBe(true);

    const span = telemetry.startSpan("factory-span");
    span.setAttributes({ "test.key": "test-value" });
    span.setStatus("ok");
    span.end();

    await provider.forceFlush();

    const spans = exporter.getFinishedSpans();
    expect(spans.length).toBeGreaterThanOrEqual(1);

    const factorySpan = spans.find((s) => s.name === "factory-span");
    expect(factorySpan).toBeDefined();
    expect(factorySpan?.attributes["test.key"]).toBe("test-value");
  });
});

