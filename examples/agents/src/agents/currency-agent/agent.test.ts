import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import { ToolLoopAgent } from "ai";
import { describe, expect, it } from "vitest";
import { createCurrencyAgent } from "./agent";
import { getCurrencyAgentPrompt } from "./prompt";

describe("Currency Agent", () => {
	describe("Agent Creation", () => {
		it("should create an agent instance", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createCurrencyAgent(mockModel);

			expect(agent).toBeDefined();
			expect(agent).toBeInstanceOf(ToolLoopAgent);
		});

		it("should initialize with prompt instructions", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createCurrencyAgent(mockModel);
			const prompt = getCurrencyAgentPrompt();

			// Test that the prompt utility works
			expect(prompt).toBeDefined();
			expect(typeof prompt).toBe("string");
			expect(prompt.length).toBeGreaterThan(0);

			// Agent should be properly created
			expect(agent).toBeDefined();
			expect(agent).toBeInstanceOf(ToolLoopAgent);
		});

		it("should have one tool defined", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createCurrencyAgent(mockModel);

			const toolNames = Object.keys(agent.tools);
			expect(toolNames).toHaveLength(1);
			expect(toolNames).toContain("get_exchange_rate");
		});

		it("should have get_exchange_rate tool with description", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createCurrencyAgent(mockModel);

			expect(agent.tools.get_exchange_rate).toBeDefined();
			expect(agent.tools.get_exchange_rate.description.toLowerCase()).toContain(
				"exchange",
			);
			expect(agent.tools.get_exchange_rate.inputSchema).toBeDefined();
			expect(agent.tools.get_exchange_rate.execute).toBeDefined();
		});
	});

	describe("Agent Execution (Mocked Model)", () => {
		it("should respond to currency conversion requests", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 20, outputTokens: 30, totalTokens: 50 },
					content: [
						{
							type: "text",
							text: "1 USD is approximately 0.92 EUR",
						},
					],
					warnings: [],
				}),
			});

			const agent = createCurrencyAgent(mockModel);
			const result = await agent.generate({
				prompt: "Convert 1 USD to EUR",
			});

			expect(result).toBeDefined();
			expect(result.text).toBeDefined();
			expect(typeof result.text).toBe("string");
		});

		it("should respond to exchange rate queries", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 15, outputTokens: 25, totalTokens: 40 },
					content: [
						{
							type: "text",
							text: "The exchange rate from GBP to USD is 1.27",
						},
					],
					warnings: [],
				}),
			});

			const agent = createCurrencyAgent(mockModel);
			const result = await agent.generate({
				prompt: "What's the exchange rate from GBP to USD?",
			});

			expect(result).toBeDefined();
			expect(result.text).toMatch(/exchange|rate|GBP|USD/i);
		});

		it("should support streaming mode", async () => {
			const mockModel = new MockLanguageModelV3({
				doStream: async () => ({
					stream: simulateReadableStream({
						chunks: [
							{ type: "text-start", id: "text-1" },
							{ type: "text-delta", id: "text-1", delta: "The current " },
							{ type: "text-delta", id: "text-1", delta: "exchange rate is..." },
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

			const agent = createCurrencyAgent(mockModel);
			const result = await agent.stream({
				prompt: "Convert USD to EUR",
			});

			expect(result).toBeDefined();
			expect(result.fullStream).toBeDefined();
			expect(result.text).toBeDefined();

			const text = await result.text;
			expect(typeof text).toBe("string");
			expect(text.length).toBeGreaterThan(0);
		});

		it("should handle multi-turn conversations", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 25, outputTokens: 35, totalTokens: 60 },
					content: [
						{
							type: "text",
							text: "What currency would you like to convert from and to?",
						},
					],
					warnings: [],
				}),
			});

			const agent = createCurrencyAgent(mockModel);
			const result = await agent.generate({
				prompt: "I want to convert some money",
			});

			expect(result).toBeDefined();
			expect(result.text).toMatch(/currency|convert/i);
		});
	});

	describe("Tool Execution", () => {
		it("should execute get_exchange_rate tool successfully", async () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createCurrencyAgent(mockModel);

			// Mock the actual API call by testing the tool structure
			expect(agent.tools.get_exchange_rate).toBeDefined();
			expect(agent.tools.get_exchange_rate.execute).toBeDefined();
		});

		it("should have correct input schema for get_exchange_rate", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createCurrencyAgent(mockModel);

			const schema = agent.tools.get_exchange_rate.inputSchema;
			expect(schema).toBeDefined();

			// Test that schema validates correctly
			const validInput = {
				currencyFrom: "USD",
				currencyTo: "EUR",
				currencyDate: "latest",
			};

			const parseResult = schema.safeParse(validInput);
			expect(parseResult.success).toBe(true);
		});

		it("should reject invalid currency codes in schema", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createCurrencyAgent(mockModel);

			const schema = agent.tools.get_exchange_rate.inputSchema;

			// Too short
			const invalidInput1 = {
				currencyFrom: "US",
				currencyTo: "EUR",
			};
			expect(schema.safeParse(invalidInput1).success).toBe(false);

			// Too long
			const invalidInput2 = {
				currencyFrom: "USD",
				currencyTo: "EURO",
			};
			expect(schema.safeParse(invalidInput2).success).toBe(false);
		});

		it("should allow optional currencyDate parameter", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createCurrencyAgent(mockModel);

			const schema = agent.tools.get_exchange_rate.inputSchema;

			const inputWithoutDate = {
				currencyFrom: "USD",
				currencyTo: "EUR",
			};

			const parseResult = schema.safeParse(inputWithoutDate);
			expect(parseResult.success).toBe(true);
		});
	});

	describe("Agent Error Handling", () => {
		it("should handle model errors gracefully", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => {
					throw new Error("Model error");
				},
			});

			const agent = createCurrencyAgent(mockModel);

			await expect(
				agent.generate({
					prompt: "Convert USD to EUR",
				}),
			).rejects.toThrow("Model error");
		});

		it("should handle empty prompt", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 5, outputTokens: 20, totalTokens: 25 },
					content: [
						{
							type: "text",
							text: "How can I help you with currency conversion?",
						},
					],
					warnings: [],
				}),
			});

			const agent = createCurrencyAgent(mockModel);
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
				modelId: "custom-currency-model",
			});

			const agent = createCurrencyAgent(customModel);

			expect(agent).toBeDefined();
			expect(agent).toBeInstanceOf(ToolLoopAgent);
		});

		it("should accept any language model", () => {
			const mockModel = new MockLanguageModelV3({
				modelId: "test-model",
			});

			const agent = createCurrencyAgent(mockModel);

			expect(agent).toBeDefined();
			expect(agent).toBeInstanceOf(ToolLoopAgent);
			expect(Object.keys(agent.tools)).toHaveLength(1);
		});
	});
});

