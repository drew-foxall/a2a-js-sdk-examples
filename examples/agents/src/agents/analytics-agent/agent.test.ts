/**
 * Analytics Agent Tests
 *
 * Tests the ToolLoopAgent itself using AI SDK test utilities.
 * Reference: https://ai-sdk.dev/docs/ai-sdk-core/testing
 */

import { simulateReadableStream, ToolLoopAgent } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, it } from "vitest";
import { createAnalyticsAgent } from "./agent";

describe("Analytics Agent", () => {
	describe("Agent Creation", () => {
		it("should create agent with mock model", () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
					content: [
						{ type: "text", text: "I'll create a chart with your data." },
					],
					warnings: [],
				}),
			});

			const agent = createAnalyticsAgent(mockModel);

			expect(agent).toBeDefined();
			expect(agent).toBeInstanceOf(ToolLoopAgent);
		});

		it("should have empty tools object", () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
					content: [{ type: "text", text: "Response" }],
					warnings: [],
				}),
			});

			const agent = createAnalyticsAgent(mockModel);

			// Analytics agent has no tools - chart generation happens in adapter layer
			expect(agent.tools).toEqual({});
		});

		it("should have model configured", () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
					content: [{ type: "text", text: "Response" }],
					warnings: [],
				}),
			});

			const agent = createAnalyticsAgent(mockModel);

			// Agent is properly configured
			expect(agent).toBeDefined();
			expect(agent).toBeInstanceOf(ToolLoopAgent);
		});
	});

	describe("Agent Execution", () => {
		it("should generate response for chart request", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 20, outputTokens: 30, totalTokens: 50 },
					content: [
						{
							type: "text",
							text: "I'll create a bar chart showing your quarterly sales data.",
						},
					],
					warnings: [],
				}),
			});

			const agent = createAnalyticsAgent(mockModel);

			const result = await agent.generate({
				prompt: "Generate a chart of sales: Q1:1000 Q2:2000 Q3:1500",
			});

			expect(result).toBeDefined();
			expect(result.text).toContain("chart");
		});

		it("should support streaming mode", async () => {
			const mockModel = new MockLanguageModelV3({
				doStream: async () => ({
					stream: simulateReadableStream({
						chunks: [
							{ type: "text-start", id: "text-1" },
							{ type: "text-delta", id: "text-1", delta: "I'll create a chart" },
							{ type: "text-end", id: "text-1" },
							{
								type: "finish",
								finishReason: "stop",
								logprobs: undefined,
								usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 },
							},
						],
					}),
				}),
			});

			const agent = createAnalyticsAgent(mockModel);

			const result = await agent.stream({
				prompt: "Create a chart",
			});

			// Verify stream result exists and has expected structure
			expect(result).toBeDefined();
			expect(result.fullStream).toBeDefined();
			expect(result.text).toBeDefined();
			
			// Wait for the stream to complete and get the text
			const text = await result.text;
			expect(text).toBeDefined();
			expect(typeof text).toBe("string");
		});

		it("should respond to data parsing requests", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 25, outputTokens: 40, totalTokens: 65 },
					content: [
						{
							type: "text",
							text: "I can parse your data and create a visualization showing the values.",
						},
					],
					warnings: [],
				}),
			});

			const agent = createAnalyticsAgent(mockModel);

			const result = await agent.generate({
				prompt: "Parse this data: A:10, B:20, C:30",
			});

			expect(result).toBeDefined();
			expect(result.text).toBeDefined();
			expect(typeof result.text).toBe("string");
		});

		it("should handle complex chart requests", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 30, outputTokens: 50, totalTokens: 80 },
					content: [
						{
							type: "text",
							text: "I'll generate a bar chart displaying your monthly revenue data from January through March.",
						},
					],
					warnings: [],
				}),
			});

			const agent = createAnalyticsAgent(mockModel);

			const result = await agent.generate({
				prompt:
					"Generate a chart of revenue: Jan,$1000 Feb,$2000 Mar,$1500 with title 'Q1 Revenue'",
			});

			expect(result).toBeDefined();
			expect(result.text).toContain("chart");
		});
	});

	describe("Agent Error Handling", () => {
		it("should handle empty prompt", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 5, outputTokens: 15, totalTokens: 20 },
					content: [
						{
							type: "text",
							text: "Please provide data for me to visualize.",
						},
					],
					warnings: [],
				}),
			});

			const agent = createAnalyticsAgent(mockModel);

			const result = await agent.generate({
				prompt: "",
			});

			expect(result).toBeDefined();
			expect(result.text).toBeDefined();
		});

		it("should handle model errors gracefully", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => {
					throw new Error("Model error");
				},
			});

			const agent = createAnalyticsAgent(mockModel);

			await expect(
				agent.generate({
					prompt: "Create a chart",
				}),
			).rejects.toThrow("Model error");
		});
	});

	describe("Agent Configuration", () => {
		it("should accept different language models", () => {
			const mockModel1 = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
					content: [{ type: "text", text: "Response 1" }],
					warnings: [],
				}),
			});

			const mockModel2 = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
					content: [{ type: "text", text: "Response 2" }],
					warnings: [],
				}),
			});

			const agent1 = createAnalyticsAgent(mockModel1);
			const agent2 = createAnalyticsAgent(mockModel2);

			expect(agent1).toBeDefined();
			expect(agent2).toBeDefined();
			expect(agent1).toBeInstanceOf(ToolLoopAgent);
			expect(agent2).toBeInstanceOf(ToolLoopAgent);
		});
	});
});

