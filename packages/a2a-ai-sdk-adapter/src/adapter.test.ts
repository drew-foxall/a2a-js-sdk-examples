/**
 * A2AAdapter Unit Tests
 *
 * Tests the A2AAdapter using AI SDK's official testing utilities.
 * Reference: https://ai-sdk.dev/docs/ai-sdk-core/testing
 *
 * Note: AI SDK v6 uses MockLanguageModelV3 (not V2)
 */

import type { Message } from "@drew-foxall/a2a-js-sdk";
import { type ExecutionEventBus, RequestContext } from "@drew-foxall/a2a-js-sdk/server";
import type { ToolSet } from "ai";
import { simulateReadableStream, ToolLoopAgent } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { A2AAdapter, ConsoleLogger, NoOpLogger } from "./adapter.js";

describe("A2AAdapter", () => {
  describe("Configuration", () => {
    it("should create adapter with stream mode", () => {
      const testAgent = new ToolLoopAgent({
        model: new MockLanguageModelV3({
          doStream: async () => ({
            stream: simulateReadableStream({
              chunks: [
                { type: "text-start", id: "text-1" },
                { type: "text-delta", id: "text-1", delta: "Hello" },
                { type: "text-end", id: "text-1" },
                {
                  type: "finish",
                  finishReason: { unified: "stop", raw: undefined },
                  logprobs: undefined,
                  usage: {
                    inputTokens: {
                      total: 5,
                      noCache: undefined,
                      cacheRead: undefined,
                      cacheWrite: undefined,
                    },
                    outputTokens: { total: 10, text: undefined, reasoning: undefined },
                  },
                },
              ],
            }),
          }),
        }),
        tools: {},
        instructions: "Test agent",
      });

      const adapter = new A2AAdapter(testAgent, {
        mode: "stream",
      });

      expect(adapter).toBeDefined();
    });

    it("should create adapter with generate mode", () => {
      const testAgent = new ToolLoopAgent({
        model: new MockLanguageModelV3({
          doGenerate: async () => ({
            finishReason: { unified: "stop", raw: undefined },
            usage: {
              inputTokens: {
                total: 10,
                noCache: undefined,
                cacheRead: undefined,
                cacheWrite: undefined,
              },
              outputTokens: { total: 20, text: undefined, reasoning: undefined },
            },
            content: [{ type: "text", text: "Hello, world!" }],
            warnings: [],
          }),
        }),
        tools: {},
        instructions: "Test agent",
      });

      const adapter = new A2AAdapter(testAgent, {
        mode: "generate",
      });

      expect(adapter).toBeDefined();
    });

    it("should accept custom logger", () => {
      const customLogger = {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      const testAgent = new ToolLoopAgent({
        model: new MockLanguageModelV3({
          doGenerate: async () => ({
            finishReason: { unified: "stop", raw: undefined },
            usage: {
              inputTokens: {
                total: 10,
                noCache: undefined,
                cacheRead: undefined,
                cacheWrite: undefined,
              },
              outputTokens: { total: 20, text: undefined, reasoning: undefined },
            },
            content: [{ type: "text", text: "test" }],
            warnings: [],
          }),
        }),
        tools: {},
        instructions: "Test agent",
      });

      const adapter = new A2AAdapter(testAgent, {
        mode: "generate",
        logger: customLogger,
      });

      expect(adapter).toBeDefined();
    });

    it("should accept custom system prompt", () => {
      const testAgent = new ToolLoopAgent({
        model: new MockLanguageModelV3({
          doGenerate: async () => ({
            finishReason: { unified: "stop", raw: undefined },
            usage: {
              inputTokens: {
                total: 10,
                noCache: undefined,
                cacheRead: undefined,
                cacheWrite: undefined,
              },
              outputTokens: { total: 20, text: undefined, reasoning: undefined },
            },
            content: [{ type: "text", text: "test" }],
            warnings: [],
          }),
        }),
        tools: {},
        instructions: "Test agent",
      });

      const adapter = new A2AAdapter(testAgent, {
        mode: "generate",
      });

      expect(adapter).toBeDefined();
    });

    it("should require mode to be specified", () => {
      const testAgent = new ToolLoopAgent({
        model: new MockLanguageModelV3({
          doGenerate: async () => ({
            finishReason: { unified: "stop", raw: undefined },
            usage: {
              inputTokens: {
                total: 10,
                noCache: undefined,
                cacheRead: undefined,
                cacheWrite: undefined,
              },
              outputTokens: { total: 20, text: undefined, reasoning: undefined },
            },
            content: [{ type: "text", text: "test" }],
            warnings: [],
          }),
        }),
        tools: {},
        instructions: "Test agent",
      });

      expect(() => {
        // @ts-expect-error - Testing invalid config
        new A2AAdapter(testAgent, {});
      }).toThrow("A2AAdapter requires 'mode' to be specified");
    });
  });

  describe("Loggers", () => {
    it("ConsoleLogger should log messages", () => {
      // SDK ConsoleLogger uses console.info for info level
      const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
      const logger = ConsoleLogger.create();

      logger.info("test message", { requestId: "123" });

      // SDK ConsoleLogger formats differently - just verify it was called
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("ConsoleLogger should handle messages without metadata", () => {
      // SDK ConsoleLogger uses console.debug for debug level, but need minLevel="debug" to log
      const consoleSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
      const logger = ConsoleLogger.create("debug"); // Enable debug level

      logger.debug("debug message");

      // SDK ConsoleLogger formats differently - just verify it was called
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("NoOpLogger should not log anything", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const logger = NoOpLogger;

      logger.info("test");
      logger.debug("test");
      logger.warn("test");
      logger.error("test");

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("Mode Configuration", () => {
    it("should support stream mode with parseArtifacts", () => {
      const parseArtifacts = vi.fn(() => ({ artifacts: [] }));

      const testAgent = new ToolLoopAgent({
        model: new MockLanguageModelV3({
          doStream: async () => ({
            stream: simulateReadableStream({
              chunks: [
                { type: "text-start", id: "text-1" },
                { type: "text-delta", id: "text-1", delta: "Hello" },
                { type: "text-end", id: "text-1" },
                {
                  type: "finish",
                  finishReason: { unified: "stop", raw: undefined },
                  logprobs: undefined,
                  usage: {
                    inputTokens: {
                      total: 5,
                      noCache: undefined,
                      cacheRead: undefined,
                      cacheWrite: undefined,
                    },
                    outputTokens: { total: 10, text: undefined, reasoning: undefined },
                  },
                },
              ],
            }),
          }),
        }),
        tools: {},
        instructions: "Test agent",
      });

      const adapter = new A2AAdapter(testAgent, {
        mode: "stream",
        parseArtifacts,
      });

      expect(adapter).toBeDefined();
    });

    it("should support generate mode with generateArtifacts", () => {
      const generateArtifacts = vi.fn(async () => []);

      const testAgent = new ToolLoopAgent({
        model: new MockLanguageModelV3({
          doGenerate: async () => ({
            finishReason: { unified: "stop", raw: undefined },
            usage: {
              inputTokens: {
                total: 10,
                noCache: undefined,
                cacheRead: undefined,
                cacheWrite: undefined,
              },
              outputTokens: { total: 20, text: undefined, reasoning: undefined },
            },
            content: [{ type: "text", text: "test" }],
            warnings: [],
          }),
        }),
        tools: {},
        instructions: "Test agent",
      });

      const adapter = new A2AAdapter(testAgent, {
        mode: "generate",
        generateArtifacts,
      });

      expect(adapter).toBeDefined();
    });
  });

  describe("Tool Integration", () => {
    it("should accept agents with typed tool definitions", () => {
      const tools = {
        weatherTool: {
          description: "Get weather",
          inputSchema: z.object({}),
          execute: async () => "sunny",
        },
        timeTool: {
          description: "Get time",
          inputSchema: z.object({}),
          execute: async () => "12:00",
        },
      } satisfies ToolSet;

      const testAgent = new ToolLoopAgent({
        model: new MockLanguageModelV3({
          doGenerate: async () => ({
            finishReason: { unified: "stop", raw: undefined },
            usage: {
              inputTokens: {
                total: 10,
                noCache: undefined,
                cacheRead: undefined,
                cacheWrite: undefined,
              },
              outputTokens: { total: 20, text: undefined, reasoning: undefined },
            },
            content: [{ type: "text", text: "test" }],
            warnings: [],
          }),
        }),
        tools,
      });

      const adapter = new A2AAdapter(testAgent, {
        mode: "generate",
      });

      expect(adapter).toBeDefined();
    });
  });

  describe("Dynamic Response Type Selection", () => {
    // Helper to create a mock event bus
    const createMockEventBus = () => {
      const published: unknown[] = [];
      return {
        publish: vi.fn((event: unknown) => published.push(event)),
        published,
        on: vi.fn(),
        off: vi.fn(),
        once: vi.fn(),
        removeAllListeners: vi.fn(),
      } as unknown as ExecutionEventBus & { published: unknown[] };
    };

    // Helper to create a test user message
    const createUserMessage = (text: string): Message => ({
      kind: "message",
      role: "user",
      messageId: "test-msg-1",
      contextId: "test-context-1",
      parts: [{ kind: "text", text }],
    });

    // Helper to create a test request context
    const createRequestContext = (text: string): RequestContext => {
      const userMessage = createUserMessage(text);
      return new RequestContext(userMessage, "test-task-1", "test-context-1", undefined);
    };

    it("should use Message when selectResponseType returns 'message'", async () => {
      const testAgent = new ToolLoopAgent({
        model: new MockLanguageModelV3({
          doGenerate: async () => ({
            finishReason: { unified: "stop", raw: undefined },
            usage: {
              inputTokens: {
                total: 10,
                noCache: undefined,
                cacheRead: undefined,
                cacheWrite: undefined,
              },
              outputTokens: { total: 20, text: undefined, reasoning: undefined },
            },
            content: [{ type: "text", text: "Hello! Nice to meet you!" }],
            warnings: [],
          }),
        }),
        tools: {},
        instructions: "Test agent",
      });

      const adapter = new A2AAdapter(testAgent, {
        mode: "generate",
        selectResponseType: () => "message",
      });

      const eventBus = createMockEventBus();
      const requestContext = createRequestContext("Hello");

      await adapter.execute(requestContext, eventBus);

      // Should have exactly 1 event (Message response)
      expect(eventBus.published).toHaveLength(1);

      // The event should be a Message, not a Task
      const response = eventBus.published[0] as Message;
      expect(response.kind).toBe("message");
      expect(response.role).toBe("agent");
      expect(response.parts[0]).toEqual({ kind: "text", text: "Hello! Nice to meet you!" });
    });

    it("should use Task when selectResponseType returns 'task'", async () => {
      const testAgent = new ToolLoopAgent({
        model: new MockLanguageModelV3({
          doGenerate: async () => ({
            finishReason: { unified: "stop", raw: undefined },
            usage: {
              inputTokens: {
                total: 10,
                noCache: undefined,
                cacheRead: undefined,
                cacheWrite: undefined,
              },
              outputTokens: { total: 20, text: undefined, reasoning: undefined },
            },
            content: [{ type: "text", text: "Generated report" }],
            warnings: [],
          }),
        }),
        tools: {},
        instructions: "Test agent",
      });

      const adapter = new A2AAdapter(testAgent, {
        mode: "generate",
        selectResponseType: () => "task",
      });

      const eventBus = createMockEventBus();
      const requestContext = createRequestContext("Generate a report");

      await adapter.execute(requestContext, eventBus);

      // Should have Task lifecycle events
      const kinds = eventBus.published.map((e) => (e as { kind: string }).kind);
      expect(kinds).toContain("task"); // Initial task
      expect(kinds).toContain("status-update"); // Working + completed
    });

    it("should default to Task when selectResponseType not provided", async () => {
      const testAgent = new ToolLoopAgent({
        model: new MockLanguageModelV3({
          doGenerate: async () => ({
            finishReason: { unified: "stop", raw: undefined },
            usage: {
              inputTokens: {
                total: 10,
                noCache: undefined,
                cacheRead: undefined,
                cacheWrite: undefined,
              },
              outputTokens: { total: 20, text: undefined, reasoning: undefined },
            },
            content: [{ type: "text", text: "test response" }],
            warnings: [],
          }),
        }),
        tools: {},
        instructions: "Test agent",
      });

      const adapter = new A2AAdapter(testAgent, { mode: "generate" });

      const eventBus = createMockEventBus();
      const requestContext = createRequestContext("Test message");

      await adapter.execute(requestContext, eventBus);

      // Should behave as before (Task-based)
      const kinds = eventBus.published.map((e) => (e as { kind: string }).kind);
      expect(kinds).toContain("task");
    });

    it("should support async selectResponseType", async () => {
      const testAgent = new ToolLoopAgent({
        model: new MockLanguageModelV3({
          doGenerate: async () => ({
            finishReason: { unified: "stop", raw: undefined },
            usage: {
              inputTokens: {
                total: 10,
                noCache: undefined,
                cacheRead: undefined,
                cacheWrite: undefined,
              },
              outputTokens: { total: 20, text: undefined, reasoning: undefined },
            },
            content: [{ type: "text", text: "Async response" }],
            warnings: [],
          }),
        }),
        tools: {},
        instructions: "Test agent",
      });

      const adapter = new A2AAdapter(testAgent, {
        mode: "generate",
        selectResponseType: async (): Promise<"message" | "task"> => {
          // Simulate async classification
          await new Promise((resolve) => setTimeout(resolve, 10));
          return "message";
        },
      });

      const eventBus = createMockEventBus();
      const requestContext = createRequestContext("Hello");

      await adapter.execute(requestContext, eventBus);

      // Should have Message response
      expect(eventBus.published).toHaveLength(1);
      expect((eventBus.published[0] as Message).kind).toBe("message");
    });

    it("should pass context to selectResponseType hook", async () => {
      const selectResponseType = vi.fn(() => "message" as const);

      const testAgent = new ToolLoopAgent({
        model: new MockLanguageModelV3({
          doGenerate: async () => ({
            finishReason: { unified: "stop", raw: undefined },
            usage: {
              inputTokens: {
                total: 10,
                noCache: undefined,
                cacheRead: undefined,
                cacheWrite: undefined,
              },
              outputTokens: { total: 20, text: undefined, reasoning: undefined },
            },
            content: [{ type: "text", text: "test" }],
            warnings: [],
          }),
        }),
        tools: {},
        instructions: "Test agent",
      });

      const adapter = new A2AAdapter(testAgent, {
        mode: "generate",
        selectResponseType,
      });

      const eventBus = createMockEventBus();
      const userMessage = createUserMessage("Hello world");
      const requestContext = new RequestContext(
        userMessage,
        "test-task-1",
        "test-context-1",
        undefined
      );

      await adapter.execute(requestContext, eventBus);

      // Verify the hook was called with correct context
      expect(selectResponseType).toHaveBeenCalledTimes(1);
      expect(selectResponseType).toHaveBeenCalledWith({
        userMessage,
        existingTask: undefined,
      });
    });

    it("should handle errors in Message mode with error Message", async () => {
      const testAgent = new ToolLoopAgent({
        model: new MockLanguageModelV3({
          doGenerate: async () => {
            throw new Error("Test error");
          },
        }),
        tools: {},
        instructions: "Test agent",
      });

      const adapter = new A2AAdapter(testAgent, {
        mode: "generate",
        selectResponseType: () => "message",
      });

      const eventBus = createMockEventBus();
      const requestContext = createRequestContext("Hello");

      await adapter.execute(requestContext, eventBus);

      // Should have error Message response
      expect(eventBus.published).toHaveLength(1);
      const response = eventBus.published[0] as Message;
      expect(response.kind).toBe("message");
      expect(response.role).toBe("agent");
      expect((response.parts[0] as { kind: string; text: string }).text).toContain(
        "Error: Test error"
      );
    });

    it("should handle empty message in Message mode", async () => {
      const testAgent = new ToolLoopAgent({
        model: new MockLanguageModelV3({
          doGenerate: async () => ({
            finishReason: { unified: "stop", raw: undefined },
            usage: {
              inputTokens: {
                total: 10,
                noCache: undefined,
                cacheRead: undefined,
                cacheWrite: undefined,
              },
              outputTokens: { total: 20, text: undefined, reasoning: undefined },
            },
            content: [{ type: "text", text: "Should not be called" }],
            warnings: [],
          }),
        }),
        tools: {},
        instructions: "Test agent",
      });

      const adapter = new A2AAdapter(testAgent, {
        mode: "generate",
        selectResponseType: () => "message",
      });

      const eventBus = createMockEventBus();
      // Create message with empty text
      const emptyMessage: Message = {
        kind: "message",
        role: "user",
        messageId: "test-msg-1",
        contextId: "test-context-1",
        parts: [{ kind: "text", text: "" }],
      };
      const requestContext = new RequestContext(
        emptyMessage,
        "test-task-1",
        "test-context-1",
        undefined
      );

      await adapter.execute(requestContext, eventBus);

      // Should have error Message about no text
      expect(eventBus.published).toHaveLength(1);
      const response = eventBus.published[0] as Message;
      expect(response.kind).toBe("message");
      expect((response.parts[0] as { kind: string; text: string }).text).toContain(
        "Error: No message text to process"
      );
    });

    it("should apply transformResponse in Message mode", async () => {
      const testAgent = new ToolLoopAgent({
        model: new MockLanguageModelV3({
          doGenerate: async () => ({
            finishReason: { unified: "stop", raw: undefined },
            usage: {
              inputTokens: {
                total: 10,
                noCache: undefined,
                cacheRead: undefined,
                cacheWrite: undefined,
              },
              outputTokens: { total: 20, text: undefined, reasoning: undefined },
            },
            content: [{ type: "text", text: "Original response\nSTATUS: OK" }],
            warnings: [],
          }),
        }),
        tools: {},
        instructions: "Test agent",
      });

      const adapter = new A2AAdapter(testAgent, {
        mode: "generate",
        selectResponseType: () => "message",
        transformResponse: (result): { text: string } => {
          // Remove status line
          const lines = result.text.split("\n");
          return { text: lines[0] ?? "" };
        },
      });

      const eventBus = createMockEventBus();
      const requestContext = createRequestContext("Hello");

      await adapter.execute(requestContext, eventBus);

      const response = eventBus.published[0] as Message;
      expect((response.parts[0] as { kind: string; text: string }).text).toBe("Original response");
    });

    it("should support dynamic routing based on message content", async () => {
      const testAgent = new ToolLoopAgent({
        model: new MockLanguageModelV3({
          doGenerate: async () => ({
            finishReason: { unified: "stop", raw: undefined },
            usage: {
              inputTokens: {
                total: 10,
                noCache: undefined,
                cacheRead: undefined,
                cacheWrite: undefined,
              },
              outputTokens: { total: 20, text: undefined, reasoning: undefined },
            },
            content: [{ type: "text", text: "Response" }],
            warnings: [],
          }),
        }),
        tools: {},
        instructions: "Test agent",
      });

      // Dynamic routing: simple greetings -> message, complex -> task
      const adapter = new A2AAdapter(testAgent, {
        mode: "generate",
        selectResponseType: ({ userMessage }) => {
          const text = userMessage.parts
            .filter((p): p is { kind: "text"; text: string } => p.kind === "text")
            .map((p) => p.text)
            .join("");

          // Simple heuristic: short messages without "generate" or "analyze" -> message
          if (text.length < 50 && !text.toLowerCase().includes("generate")) {
            return "message";
          }
          return "task";
        },
      });

      const eventBus1 = createMockEventBus();
      const eventBus2 = createMockEventBus();

      // Short greeting should be Message
      await adapter.execute(createRequestContext("Hi there!"), eventBus1);
      expect((eventBus1.published[0] as Message).kind).toBe("message");

      // Long request with "generate" should be Task
      await adapter.execute(
        createRequestContext("Please generate a detailed report about the quarterly sales"),
        eventBus2
      );
      const kinds = eventBus2.published.map((e) => (e as { kind: string }).kind);
      expect(kinds).toContain("task");
    });
  });
});
