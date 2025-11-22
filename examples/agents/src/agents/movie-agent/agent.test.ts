import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import { ToolLoopAgent, type LanguageModel } from "ai";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

// Stub the environment variable before any imports
vi.stubEnv("TMDB_API_KEY", "test-api-key");

// Mock the TMDB functions to avoid actual API calls
vi.mock("./tmdb.js", async (importOriginal) => {
	const mod = await importOriginal<typeof import("./tmdb.js")>();
	return {
		...mod,
		searchMovies: vi.fn(async (query: string) => {
			if (query.toLowerCase().includes("inception")) {
				return {
					results: [
						{
							id: 27205,
							title: "Inception",
							release_date: "2010-07-16",
							overview: "A mind-bending thriller",
							poster_path: "https://image.tmdb.org/t/p/w500/inception.jpg",
						},
					],
				};
			}
			if (query.toLowerCase().includes("error")) {
				throw new Error("Mock TMDB API error");
			}
			return { results: [] };
		}),
		searchPeople: vi.fn(async (query: string) => {
			if (query.toLowerCase().includes("nolan")) {
				return {
					results: [
						{
							id: 525,
							name: "Christopher Nolan",
							known_for_department: "Directing",
							profile_path: "https://image.tmdb.org/t/p/w500/nolan.jpg",
						},
					],
				};
			}
			if (query.toLowerCase().includes("error")) {
				throw new Error("Mock TMDB API error");
			}
			return { results: [] };
		}),
	};
});

import { createMovieAgent } from "./agent";
import { getMovieAgentPrompt } from "./prompt";
import { searchMovies, searchPeople } from "./tmdb";

describe("Movie Agent", () => {
	describe("Agent Creation", () => {
		it("should create an agent instance", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createMovieAgent(mockModel);

			expect(agent).toBeDefined();
			expect(agent).toBeInstanceOf(ToolLoopAgent);
		});

		it("should initialize with prompt instructions", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createMovieAgent(mockModel);

			// Agent should be properly created
			expect(agent).toBeDefined();
			expect(agent).toBeInstanceOf(ToolLoopAgent);

			// Verify the prompt is defined
			expect(getMovieAgentPrompt()).toBeDefined();
			expect(getMovieAgentPrompt().length).toBeGreaterThan(0);
		});

		it("should have two tools defined", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createMovieAgent(mockModel);

			expect(Object.keys(agent.tools)).toHaveLength(2);
			expect(agent.tools.searchMovies).toBeDefined();
			expect(agent.tools.searchPeople).toBeDefined();
		});

		it("should have searchMovies tool with description and schema", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createMovieAgent(mockModel);

			expect(agent.tools.searchMovies).toBeDefined();
			expect(agent.tools.searchMovies.description).toBeTypeOf("string");
			expect(agent.tools.searchMovies.description.toLowerCase()).toContain("movie");
			expect(agent.tools.searchMovies.inputSchema).toBeInstanceOf(z.ZodObject);
			expect(agent.tools.searchMovies.execute).toBeDefined();
		});

		it("should have searchPeople tool with description and schema", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createMovieAgent(mockModel);

			expect(agent.tools.searchPeople).toBeDefined();
			expect(agent.tools.searchPeople.description).toBeTypeOf("string");
			expect(agent.tools.searchPeople.description.toLowerCase()).toContain("people");
			expect(agent.tools.searchPeople.inputSchema).toBeInstanceOf(z.ZodObject);
			expect(agent.tools.searchPeople.execute).toBeDefined();
		});
	});

	describe("Agent Execution (Mocked Model)", () => {
		it("should respond to movie questions", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 20, outputTokens: 40, totalTokens: 60 },
					content: [
						{
							type: "text",
							text: "Inception is a 2010 science fiction action film directed by Christopher Nolan.",
						},
					],
					warnings: [],
				}),
			});

			const agent = createMovieAgent(mockModel);
			const result = await agent.generate({
				prompt: "Tell me about Inception",
			});

			expect(result.text).toContain("Inception");
		});

		it("should respond to general movie questions", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 15, outputTokens: 30, totalTokens: 45 },
					content: [
						{
							type: "text",
							text: "I can help you find information about movies and actors using TMDB.",
						},
					],
					warnings: [],
				}),
			});

			const agent = createMovieAgent(mockModel);
			const result = await agent.generate({
				prompt: "What can you do?",
			});

			expect(result.text).toContain("movies");
		});

		it("should support streaming mode", async () => {
			const mockModel = new MockLanguageModelV3({
				doStream: async () => ({
					stream: simulateReadableStream({
						chunks: [
							{ type: "text-start", id: "text-1" },
							{ type: "text-delta", id: "text-1", delta: "The Matrix " },
							{ type: "text-delta", id: "text-1", delta: "is a classic sci-fi film." },
							{ type: "text-end", id: "text-1" },
							{
								type: "finish",
								finishReason: "stop",
								logprobs: undefined,
								usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
							},
						],
					}),
				}),
			});

			const agent = createMovieAgent(mockModel);
			const result = await agent.stream({
				prompt: "Tell me about The Matrix",
			});

			expect(result).toBeDefined();
			expect(result.fullStream).toBeDefined();
			expect(result.text).toBeDefined();

			const text = await result.text;
			expect(text).toContain("Matrix");
		});
	});

	describe("Tool Execution", () => {
		it("should execute searchMovies tool successfully", async () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createMovieAgent(mockModel);

			const result = await agent.tools.searchMovies.execute({ query: "Inception" });

			expect(result.results).toBeDefined();
			expect(result.results).toHaveLength(1);
			expect(result.results[0].title).toBe("Inception");
			expect(searchMovies).toHaveBeenCalledWith("Inception");
		});

		it("should execute searchPeople tool successfully", async () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createMovieAgent(mockModel);

			const result = await agent.tools.searchPeople.execute({ query: "Christopher Nolan" });

			expect(result.results).toBeDefined();
			expect(result.results).toHaveLength(1);
			expect(result.results[0].name).toBe("Christopher Nolan");
			expect(searchPeople).toHaveBeenCalledWith("Christopher Nolan");
		});

		it("should handle empty search results for movies", async () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createMovieAgent(mockModel);

			const result = await agent.tools.searchMovies.execute({ query: "NonexistentMovie12345" });

			expect(result.results).toBeDefined();
			expect(result.results).toHaveLength(0);
		});

		it("should handle empty search results for people", async () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createMovieAgent(mockModel);

			const result = await agent.tools.searchPeople.execute({ query: "NonexistentPerson12345" });

			expect(result.results).toBeDefined();
			expect(result.results).toHaveLength(0);
		});
	});

	describe("Advanced Features - callOptionsSchema & prepareCall", () => {
		it("should accept goal in call options", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async ({ messages }) => ({
					finishReason: "stop",
					usage: { inputTokens: 20, outputTokens: 40, totalTokens: 60 },
					content: [
						{ type: "text", text: "I'll help you find sci-fi movies." },
					],
					warnings: [],
				}),
			});

			const agent = createMovieAgent(mockModel);

			// The agent accepts goal via callOptionsSchema
			const result = await agent.generate({
				prompt: "What can you do?",
				contextId: "test-context",
				goal: "Help user find sci-fi movies",
			});

			expect(result.text).toBeDefined();
		});

		it("should generate prompt with goal using prepareCall", () => {
			// Test the prompt generation with goal
			const promptWithGoal = getMovieAgentPrompt("Find action movies");
			expect(promptWithGoal).toContain("Find action movies");
			expect(promptWithGoal).toContain("Your goal in this task is");
		});

		it("should generate prompt without goal", () => {
			const promptWithoutGoal = getMovieAgentPrompt();
			expect(promptWithoutGoal).toBeDefined();
			expect(promptWithoutGoal).not.toContain("Your goal in this task is");
		});
	});

	describe("Agent Error Handling", () => {
		it("should handle model errors gracefully", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => {
					throw new Error("Model error");
				},
			});

			const agent = createMovieAgent(mockModel);

			await expect(
				agent.generate({
					prompt: "Tell me about movies",
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
							text: "What would you like to know about movies?",
						},
					],
					warnings: [],
				}),
			});

			const agent = createMovieAgent(mockModel);
			const result = await agent.generate({
				prompt: "",
			});

			expect(result).toBeDefined();
			expect(result.text).toBeDefined();
		});
	});

	describe("Agent Configuration", () => {
		it("should create agent with custom model", () => {
			const customModel = new MockLanguageModelV3({ modelId: "custom-movie-model" });
			const agent = createMovieAgent(customModel);

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

			const agent = createMovieAgent(customModel);

			expect(agent).toBeDefined();
			expect(agent).toBeInstanceOf(ToolLoopAgent);
		});
	});

	describe("Output Instructions", () => {
		it("should include COMPLETED/AWAITING_USER_INPUT instructions in prompt", () => {
			const prompt = getMovieAgentPrompt();

			expect(prompt).toContain("COMPLETED");
			expect(prompt).toContain("AWAITING_USER_INPUT");
		});

		it("should include example in prompt", () => {
			const prompt = getMovieAgentPrompt();

			expect(prompt).toContain("Example:");
			expect(prompt).toContain("when was Inception released");
		});

		it("should include current date in prompt", () => {
			const prompt = getMovieAgentPrompt();

			expect(prompt).toContain("current date and time");
		});
	});
});

