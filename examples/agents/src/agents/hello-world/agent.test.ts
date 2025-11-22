import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import { ToolLoopAgent } from "ai";
import { describe, expect, it } from "vitest";
import { createHelloWorldAgent } from "./agent";
import { getHelloWorldPrompt } from "./prompt";

describe("Hello World Agent", () => {
	describe("Agent Creation", () => {
		it("should create an agent instance", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createHelloWorldAgent(mockModel);

			expect(agent).toBeDefined();
			expect(agent).toBeInstanceOf(ToolLoopAgent);
		});

		it("should initialize with prompt instructions", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createHelloWorldAgent(mockModel);
			const prompt = getHelloWorldPrompt();

			// Test that the prompt utility works (indirect test of instructions)
			expect(prompt).toBeDefined();
			expect(typeof prompt).toBe("string");
			expect(prompt.length).toBeGreaterThan(0);
			
			// Agent should be properly created (behavior test, not implementation)
			expect(agent).toBeDefined();
			expect(agent).toBeInstanceOf(ToolLoopAgent);
		});

		it("should have no tools defined", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createHelloWorldAgent(mockModel);

			expect(Object.keys(agent.tools)).toHaveLength(0);
		});
	});

	describe("Agent Execution (Mocked Model)", () => {
		it("should respond to greetings in generate mode", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
					content: [
						{
							type: "text",
							text: "Hello! How can I help you today?",
						},
					],
					warnings: [],
				}),
			});

			const agent = createHelloWorldAgent(mockModel);
			const result = await agent.generate({
				prompt: "Hello!",
			});

			expect(result).toBeDefined();
			expect(result.text).toBeDefined();
			expect(typeof result.text).toBe("string");
			expect(result.text).toContain("Hello");
		});

		it("should respond to questions in generate mode", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 15, outputTokens: 25, totalTokens: 40 },
					content: [
						{
							type: "text",
							text: "I'm the Hello World Agent! I'm here to help with friendly greetings.",
						},
					],
					warnings: [],
				}),
			});

			const agent = createHelloWorldAgent(mockModel);
			const result = await agent.generate({
				prompt: "What is your name?",
			});

			expect(result).toBeDefined();
			expect(result.text).toContain("Hello World");
		});

		it("should support streaming mode", async () => {
			const mockModel = new MockLanguageModelV3({
				doStream: async () => ({
					stream: simulateReadableStream({
						chunks: [
							{ type: "text-start", id: "text-1" },
							{ type: "text-delta", id: "text-1", delta: "Hello! " },
							{ type: "text-delta", id: "text-1", delta: "How are you?" },
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
			});

			const agent = createHelloWorldAgent(mockModel);
			const result = await agent.stream({
				prompt: "Hi there",
			});

			expect(result).toBeDefined();
			expect(result.fullStream).toBeDefined();
			expect(result.text).toBeDefined();

			const text = await result.text;
			expect(typeof text).toBe("string");
			expect(text.length).toBeGreaterThan(0);
		});

		it("should be conversational", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 12, outputTokens: 18, totalTokens: 30 },
					content: [
						{
							type: "text",
							text: "I'm doing great, thank you for asking! How can I assist you today?",
						},
					],
					warnings: [],
				}),
			});

			const agent = createHelloWorldAgent(mockModel);
			const result = await agent.generate({
				prompt: "How are you?",
			});

			expect(result).toBeDefined();
			expect(result.text).toMatch(/doing|great|good|well|fine/i);
		});
	});

	describe("Agent Error Handling", () => {
		it("should handle model errors gracefully", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => {
					throw new Error("Model error");
				},
			});

			const agent = createHelloWorldAgent(mockModel);

			await expect(
				agent.generate({
					prompt: "Hello",
				}),
			).rejects.toThrow("Model error");
		});

		it("should handle empty prompt", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 5, outputTokens: 15, totalTokens: 20 },
					content: [
						{
							type: "text",
							text: "Hello! How may I help you?",
						},
					],
					warnings: [],
				}),
			});

			const agent = createHelloWorldAgent(mockModel);
			const result = await agent.generate({
				prompt: "",
			});

			expect(result).toBeDefined();
			expect(result.text).toBeDefined();
		});
	});

	describe("Agent Configuration", () => {
		it("should create agent with custom model", () => {
			const customModel = new MockLanguageModelV3({
				modelId: "custom-model",
			});

			const agent = createHelloWorldAgent(customModel);

			// Test behavior, not implementation
			expect(agent).toBeDefined();
			expect(agent).toBeInstanceOf(ToolLoopAgent);
		});

		it("should accept any language model", () => {
			const mockModel = new MockLanguageModelV3({
				modelId: "test-model",
			});

			const agent = createHelloWorldAgent(mockModel);

			expect(agent).toBeDefined();
			expect(agent).toBeInstanceOf(ToolLoopAgent);
		});
	});
});

