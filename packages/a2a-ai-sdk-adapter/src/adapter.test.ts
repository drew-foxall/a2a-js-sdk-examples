/**
 * A2AAdapter Unit Tests
 *
 * Tests the A2AAdapter using AI SDK's official testing utilities.
 * Reference: https://ai-sdk.dev/docs/ai-sdk-core/testing
 *
 * Note: AI SDK v6 uses MockLanguageModelV3 (not V2)
 */

import { describe, it, expect, vi } from "vitest";
import { ToolLoopAgent } from "ai";
import type { ToolSet } from "ai";
import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import { A2AAdapter, ConsoleLogger, NoOpLogger } from "./adapter";

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
				systemPrompt: "You are a helpful assistant.",
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
				// @ts-expect-error - Testing runtime validation
				new A2AAdapter(testAgent, {});
			}).toThrow("A2AAdapter requires 'mode' to be specified");
		});
	});

	describe("Loggers", () => {
		it("ConsoleLogger should format messages correctly", () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
			const logger = new ConsoleLogger();

			logger.info("test message", { key: "value" });

			expect(consoleSpy).toHaveBeenCalledWith(
				'[A2AAdapter] [INFO] test message {"key":"value"}',
			);

			consoleSpy.mockRestore();
		});

		it("ConsoleLogger should handle messages without metadata", () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
			const logger = new ConsoleLogger();

			logger.debug("debug message");

			expect(consoleSpy).toHaveBeenCalledWith("[A2AAdapter] [DEBUG] debug message");

			consoleSpy.mockRestore();
		});

		it("NoOpLogger should not log anything", () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
			const logger = new NoOpLogger();

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
			const parseArtifacts = vi.fn(() => []);

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
					parameters: {},
					execute: async () => "sunny",
				},
				timeTool: {
					description: "Get time",
					parameters: {},
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

	describe("Max Steps Configuration", () => {
		it("should accept custom maxSteps", () => {
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
				maxSteps: 10,
			});

			expect(adapter).toBeDefined();
		});
	});
});

