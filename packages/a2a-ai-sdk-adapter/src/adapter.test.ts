/**
 * A2AAdapter Unit Tests
 *
 * Tests the A2AAdapter using AI SDK's official testing utilities.
 * Reference: https://ai-sdk.dev/docs/ai-sdk-core/testing
 *
 * Note: AI SDK v6 uses MockLanguageModelV3 (not V2)
 */

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
                  finishReason: "stop",
                  logprobs: undefined,
                  usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
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
            finishReason: "stop",
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
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
            finishReason: "stop",
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
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
            finishReason: "stop",
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
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
            finishReason: "stop",
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
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
                  finishReason: "stop",
                  logprobs: undefined,
                  usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
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
            finishReason: "stop",
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
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
            finishReason: "stop",
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
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
});
