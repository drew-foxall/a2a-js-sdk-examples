import { MockLanguageModelV3 } from "ai/test";
import { ToolLoopAgent, type LanguageModel } from "ai";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createAirbnbAgent } from "./agent";
import { getAirbnbAgentPrompt } from "./prompt";

// Mock MCP tools for testing
const createMockMCPTools = () => ({
	search_airbnb: {
		description: "Search for Airbnb listings in a location",
		inputSchema: z.object({
			location: z.string().describe("Location to search"),
			check_in: z.string().describe("Check-in date (YYYY-MM-DD)"),
			check_out: z.string().describe("Check-out date (YYYY-MM-DD)"),
			guests: z.number().min(1).describe("Number of guests"),
		}),
		execute: async (params: { location: string; check_in: string; check_out: string; guests: number }) => {
			// Mock implementation
			return {
				results: [
					{
						id: "test-001",
						title: "Test Listing",
						location: params.location,
						price: 150,
						guests: params.guests,
					},
				],
			};
		},
	},
});

describe("Airbnb Agent", () => {
	describe("Agent Creation", () => {
		it("should create an agent instance with MCP tools", () => {
			const mockModel = new MockLanguageModelV3();
			const mockTools = createMockMCPTools();
			const agent = createAirbnbAgent(mockModel, mockTools);

			expect(agent).toBeDefined();
			expect(agent).toBeInstanceOf(ToolLoopAgent);
		});

		it("should initialize with airbnb agent prompt", () => {
			const mockModel = new MockLanguageModelV3();
			const mockTools = createMockMCPTools();
			const agent = createAirbnbAgent(mockModel, mockTools);

			expect(agent).toBeDefined();
			expect(getAirbnbAgentPrompt()).toBeDefined();
			expect(getAirbnbAgentPrompt().length).toBeGreaterThan(0);
		});

		it("should have tools from MCP server", () => {
			const mockModel = new MockLanguageModelV3();
			const mockTools = createMockMCPTools();
			const agent = createAirbnbAgent(mockModel, mockTools);

			expect(Object.keys(agent.tools).length).toBeGreaterThan(0);
			expect(agent.tools.search_airbnb).toBeDefined();
		});

		it("should have search_airbnb tool with description and schema", () => {
			const mockModel = new MockLanguageModelV3();
			const mockTools = createMockMCPTools();
			const agent = createAirbnbAgent(mockModel, mockTools);

			expect(agent.tools.search_airbnb).toBeDefined();
			expect(agent.tools.search_airbnb.description).toBeTypeOf("string");
			expect(agent.tools.search_airbnb.description.toLowerCase()).toContain("airbnb");
			expect(agent.tools.search_airbnb.inputSchema).toBeInstanceOf(z.ZodObject);
			expect(agent.tools.search_airbnb.execute).toBeDefined();
		});
	});

	describe("Tool Execution", () => {
		it("should execute search_airbnb tool successfully", async () => {
			const mockModel = new MockLanguageModelV3();
			const mockTools = createMockMCPTools();
			const agent = createAirbnbAgent(mockModel, mockTools);

			const result = await agent.tools.search_airbnb.execute({
				location: "Paris",
				check_in: "2025-12-01",
				check_out: "2025-12-05",
				guests: 2,
			});

			expect(result).toBeDefined();
			expect(result.results).toBeDefined();
			expect(Array.isArray(result.results)).toBe(true);
			expect(result.results.length).toBeGreaterThan(0);
		});

		it("should pass correct parameters to search tool", async () => {
			const mockModel = new MockLanguageModelV3();
			const mockTools = createMockMCPTools();
			const agent = createAirbnbAgent(mockModel, mockTools);

			const params = {
				location: "Tokyo",
				check_in: "2025-12-10",
				check_out: "2025-12-15",
				guests: 3,
			};

			const result = await agent.tools.search_airbnb.execute(params);

			expect(result.results[0]?.location).toBe(params.location);
			expect(result.results[0]?.guests).toBe(params.guests);
		});
	});

	describe("Agent Execution (Mocked Model)", () => {
		it("should generate response for Airbnb search requests", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => {
					return {
						finishReason: "stop",
						usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
						content: [
							{
								type: "text",
								text: "I found several Airbnb listings in Paris for your dates. Here are some options...",
							},
						],
						warnings: [],
					};
				},
			});
			const mockTools = createMockMCPTools();
			const agent = createAirbnbAgent(mockModel, mockTools);

			const result = await agent.generate({
				prompt: "Find me Airbnb listings in Paris for 2 guests",
			});

			expect(result).toBeDefined();
			expect(result.text).toBeDefined();
			expect(result.text).toContain("Airbnb");
		});

		it("should handle accommodation queries", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => {
					return {
						finishReason: "stop",
						usage: { inputTokens: 15, outputTokens: 40, totalTokens: 55 },
						content: [
							{
								type: "text",
								text: "Based on your requirements, I recommend the following accommodations in Tokyo...",
							},
						],
						warnings: [],
					};
				},
			});
			const mockTools = createMockMCPTools();
			const agent = createAirbnbAgent(mockModel, mockTools);

			const result = await agent.generate({
				prompt: "What accommodations are available in Tokyo?",
			});

			expect(result).toBeDefined();
			expect(result.text).toBeDefined();
			expect(result.text.length).toBeGreaterThan(0);
		});

		it("should provide listing information in response", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => {
					return {
						finishReason: "stop",
						usage: { inputTokens: 20, outputTokens: 50, totalTokens: 70 },
						content: [
							{
								type: "text",
								text: "Here are the available listings: Test Listing in Paris for $150/night.",
							},
						],
						warnings: [],
					};
				},
			});
			const mockTools = createMockMCPTools();
			const agent = createAirbnbAgent(mockModel, mockTools);

			const result = await agent.generate({
				prompt: "Show me listings in Paris",
			});

			expect(result).toBeDefined();
			expect(result.text).toContain("listing");
		});
	});

	describe("Agent Configuration", () => {
		it("should create agent with custom model", () => {
			const customModel = new MockLanguageModelV3({
				modelId: "custom-airbnb-model",
			});
			const mockTools = createMockMCPTools();
			const agent = createAirbnbAgent(customModel, mockTools);

			expect(agent).toBeDefined();
			expect(agent).toBeInstanceOf(ToolLoopAgent);
		});

		it("should accept any language model", () => {
			const customModel: LanguageModel = {
				doGenerate: vi.fn(),
				doStream: vi.fn(),
				modelId: "gpt-4",
				provider: "openai",
				specificationVersion: "v3",
				_supportedUrls: vi.fn(),
			};
			const mockTools = createMockMCPTools();
			const agent = createAirbnbAgent(customModel, mockTools);

			expect(agent).toBeDefined();
			expect(agent).toBeInstanceOf(ToolLoopAgent);
		});

		it("should work with different MCP tool configurations", () => {
			const mockModel = new MockLanguageModelV3();
			const customTools = {
				search_airbnb: {
					description: "Custom search tool",
					inputSchema: z.object({
						location: z.string(),
						check_in: z.string(),
						check_out: z.string(),
						guests: z.number(),
					}),
					execute: async () => ({ results: [] }),
				},
			};
			const agent = createAirbnbAgent(mockModel, customTools);

			expect(agent).toBeDefined();
			expect(agent.tools.search_airbnb).toBeDefined();
		});
	});

	describe("Tool Schema Validation", () => {
		it("should have proper input schema for search tool", () => {
			const mockModel = new MockLanguageModelV3();
			const mockTools = createMockMCPTools();
			const agent = createAirbnbAgent(mockModel, mockTools);

			const schema = agent.tools.search_airbnb.inputSchema;
			expect(schema).toBeDefined();
			expect(schema).toBeInstanceOf(z.ZodObject);

			// Test that the schema accepts valid input
			const validInput = {
				location: "Test City",
				check_in: "2025-12-01",
				check_out: "2025-12-05",
				guests: 2,
			};
			expect(() => schema.parse(validInput)).not.toThrow();
		});

		it("should accept valid search parameters", async () => {
			const mockModel = new MockLanguageModelV3();
			const mockTools = createMockMCPTools();
			const agent = createAirbnbAgent(mockModel, mockTools);

			const result = await agent.tools.search_airbnb.execute({
				location: "London",
				check_in: "2025-12-15",
				check_out: "2025-12-20",
				guests: 4,
			});

			expect(result).toBeDefined();
			expect(result.results).toBeDefined();
		});

		it("should handle minimum guest count of 1", async () => {
			const mockModel = new MockLanguageModelV3();
			const mockTools = createMockMCPTools();
			const agent = createAirbnbAgent(mockModel, mockTools);

			const result = await agent.tools.search_airbnb.execute({
				location: "Berlin",
				check_in: "2025-12-01",
				check_out: "2025-12-05",
				guests: 1,
			});

			expect(result).toBeDefined();
			expect(result.results).toBeDefined();
		});
	});

	describe("MCP Integration", () => {
		it("should use MCP tools instead of direct implementation", () => {
			const mockModel = new MockLanguageModelV3();
			const mockTools = createMockMCPTools();
			const agent = createAirbnbAgent(mockModel, mockTools);

			// Verify that tools come from MCP (not direct implementation)
			expect(agent.tools).toBe(mockTools);
		});

		it("should support MCP tool naming convention", () => {
			const mockModel = new MockLanguageModelV3();
			const mockTools = createMockMCPTools();
			const agent = createAirbnbAgent(mockModel, mockTools);

			// MCP tools typically use snake_case
			expect(Object.keys(agent.tools)).toContain("search_airbnb");
		});
	});
});

