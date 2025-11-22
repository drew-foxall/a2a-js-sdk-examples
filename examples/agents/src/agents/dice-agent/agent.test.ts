import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import { ToolLoopAgent } from "ai";
import { describe, expect, it } from "vitest";
import { createDiceAgent } from "./agent";
import { getDiceAgentPrompt } from "./prompt";

describe("Dice Agent", () => {
	describe("Agent Creation", () => {
		it("should create an agent instance", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createDiceAgent(mockModel);

			expect(agent).toBeDefined();
			expect(agent).toBeInstanceOf(ToolLoopAgent);
		});

		it("should initialize with prompt instructions", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createDiceAgent(mockModel);
			const prompt = getDiceAgentPrompt();

			// Test that the prompt utility works
			expect(prompt).toBeDefined();
			expect(typeof prompt).toBe("string");
			expect(prompt.length).toBeGreaterThan(0);

			// Agent should be properly created
			expect(agent).toBeDefined();
			expect(agent).toBeInstanceOf(ToolLoopAgent);
		});

		it("should have two tools defined", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createDiceAgent(mockModel);

			const toolNames = Object.keys(agent.tools);
			expect(toolNames).toHaveLength(2);
			expect(toolNames).toContain("rollDice");
			expect(toolNames).toContain("checkPrime");
		});

		it("should have rollDice tool with description", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createDiceAgent(mockModel);

			expect(agent.tools.rollDice).toBeDefined();
			expect(agent.tools.rollDice.description.toLowerCase()).toContain("roll");
			expect(agent.tools.rollDice.inputSchema).toBeDefined();
			expect(agent.tools.rollDice.execute).toBeDefined();
		});

		it("should have checkPrime tool with description", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createDiceAgent(mockModel);

			expect(agent.tools.checkPrime).toBeDefined();
			expect(agent.tools.checkPrime.description).toContain("prime");
			expect(agent.tools.checkPrime.inputSchema).toBeDefined();
			expect(agent.tools.checkPrime.execute).toBeDefined();
		});
	});

	describe("Agent Execution (Mocked Model)", () => {
		it("should respond to dice roll requests", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 15, outputTokens: 25, totalTokens: 40 },
					content: [
						{
							type: "text",
							text: "I rolled a 6-sided die and got: 4",
						},
					],
					warnings: [],
				}),
			});

			const agent = createDiceAgent(mockModel);
			const result = await agent.generate({
				prompt: "Roll a 6-sided die",
			});

			expect(result).toBeDefined();
			expect(result.text).toBeDefined();
			expect(typeof result.text).toBe("string");
		});

		it("should respond to prime number requests", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 20, outputTokens: 30, totalTokens: 50 },
					content: [
						{
							type: "text",
							text: "7 is a prime number!",
						},
					],
					warnings: [],
				}),
			});

			const agent = createDiceAgent(mockModel);
			const result = await agent.generate({
				prompt: "Is 7 prime?",
			});

			expect(result).toBeDefined();
			expect(result.text).toMatch(/prime|7/i);
		});

		it("should support streaming mode", async () => {
			const mockModel = new MockLanguageModelV3({
				doStream: async () => ({
					stream: simulateReadableStream({
						chunks: [
							{ type: "text-start", id: "text-1" },
							{ type: "text-delta", id: "text-1", delta: "Rolling dice... " },
							{ type: "text-delta", id: "text-1", delta: "Got a 5!" },
							{ type: "text-end", id: "text-1" },
							{
								type: "finish",
								finishReason: "stop",
								logprobs: undefined,
								usage: { inputTokens: 10, outputTokens: 15, totalTokens: 25 },
							},
						],
					}),
				}),
			});

			const agent = createDiceAgent(mockModel);
			const result = await agent.stream({
				prompt: "Roll a die",
			});

			expect(result).toBeDefined();
			expect(result.fullStream).toBeDefined();
			expect(result.text).toBeDefined();

			const text = await result.text;
			expect(typeof text).toBe("string");
			expect(text.length).toBeGreaterThan(0);
		});

		it("should handle multiple tool requests", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 25, outputTokens: 35, totalTokens: 60 },
					content: [
						{
							type: "text",
							text: "I rolled a d20 and got 15. Also, 2, 3, 5 are prime numbers.",
						},
					],
					warnings: [],
				}),
			});

			const agent = createDiceAgent(mockModel);
			const result = await agent.generate({
				prompt: "Roll a d20 and check if 2, 3, 4, 5 are prime",
			});

			expect(result).toBeDefined();
			expect(result.text).toBeDefined();
		});
	});

	describe("Tool Execution", () => {
		it("should execute rollDice tool with default sides", async () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createDiceAgent(mockModel);

			const result = await agent.tools.rollDice.execute({ sides: 6 });

			expect(result).toBeDefined();
			expect(result.sides).toBe(6);
			expect(result.result).toBeGreaterThanOrEqual(1);
			expect(result.result).toBeLessThanOrEqual(6);
			expect(result.message).toContain("Rolled");
		});

		it("should execute rollDice tool with custom sides", async () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createDiceAgent(mockModel);

			const result = await agent.tools.rollDice.execute({ sides: 20 });

			expect(result).toBeDefined();
			expect(result.sides).toBe(20);
			expect(result.result).toBeGreaterThanOrEqual(1);
			expect(result.result).toBeLessThanOrEqual(20);
		});

		it("should execute checkPrime tool with prime numbers", async () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createDiceAgent(mockModel);

			const result = await agent.tools.checkPrime.execute({
				numbers: [2, 3, 5, 7],
			});

			expect(result).toBeDefined();
			expect(result.checked).toEqual([2, 3, 5, 7]);
			expect(result.result).toContain("2");
			expect(result.result).toContain("3");
			expect(result.result).toContain("5");
			expect(result.result).toContain("7");
			expect(result.result).toContain("prime");
		});

		it("should execute checkPrime tool with non-prime numbers", async () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createDiceAgent(mockModel);

			const result = await agent.tools.checkPrime.execute({
				numbers: [4, 6, 8],
			});

			expect(result).toBeDefined();
			expect(result.checked).toEqual([4, 6, 8]);
			expect(result.result).toBe("No prime numbers found.");
		});

		it("should execute checkPrime tool with mixed numbers", async () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createDiceAgent(mockModel);

			const result = await agent.tools.checkPrime.execute({
				numbers: [2, 4, 7, 10, 11],
			});

			expect(result).toBeDefined();
			expect(result.result).toContain("2");
			expect(result.result).toContain("7");
			expect(result.result).toContain("11");
			expect(result.result).not.toContain("4");
			expect(result.result).not.toContain("10");
		});
	});

	describe("Agent Error Handling", () => {
		it("should handle model errors gracefully", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => {
					throw new Error("Model error");
				},
			});

			const agent = createDiceAgent(mockModel);

			await expect(
				agent.generate({
					prompt: "Roll a die",
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
							text: "How can I help you with dice or prime numbers?",
						},
					],
					warnings: [],
				}),
			});

			const agent = createDiceAgent(mockModel);
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
				modelId: "custom-dice-model",
			});

			const agent = createDiceAgent(customModel);

			expect(agent).toBeDefined();
			expect(agent).toBeInstanceOf(ToolLoopAgent);
		});

		it("should accept any language model", () => {
			const mockModel = new MockLanguageModelV3({
				modelId: "test-model",
			});

			const agent = createDiceAgent(mockModel);

			expect(agent).toBeDefined();
			expect(agent).toBeInstanceOf(ToolLoopAgent);
			expect(Object.keys(agent.tools)).toHaveLength(2);
		});
	});
});

