import { MockLanguageModelV3 } from "ai/test";
import { ToolLoopAgent } from "ai";
import { describe, expect, it, vi } from "vitest";

// Stub the environment variable before imports
vi.stubEnv("TMDB_API_KEY", "test-api-key");

// Mock the TMDB functions to avoid actual API calls
vi.mock("./tmdb.js", async (importOriginal) => {
	const mod = await importOriginal<typeof import("./tmdb.js")>();
	return {
		...mod,
		searchMovies: vi.fn(async () => ({ results: [] })),
		searchPeople: vi.fn(async () => ({ results: [] })),
	};
});

import { createMovieAgent } from "./agent";

/**
 * Movie Agent Tests
 * 
 * Purpose: Demonstrates TMDB API integration for movie information
 * - Two tools: searchMovies and searchPeople
 * - External API integration
 * - Multi-turn conversation support
 * 
 * Note: API integration tested in tmdb.test.ts
 */

describe("Movie Agent", () => {
	it("should create agent with two TMDB tools", () => {
		const mockModel = new MockLanguageModelV3();
		const agent = createMovieAgent(mockModel);

		expect(agent).toBeInstanceOf(ToolLoopAgent);
		const toolNames = Object.keys(agent.tools);
		expect(toolNames).toHaveLength(2);
		expect(toolNames).toContain("searchMovies");
		expect(toolNames).toContain("searchPeople");
	});

	it("should respond to movie queries", async () => {
		const mockModel = new MockLanguageModelV3({
			doGenerate: async () => ({
				finishReason: "stop",
				usage: { inputTokens: 20, outputTokens: 40, totalTokens: 60 },
				content: [
					{
						type: "text",
						text: "I found information about Inception.",
					},
				],
				warnings: [],
			}),
		});

		const agent = createMovieAgent(mockModel);
		const result = await agent.generate({
			prompt: "Tell me about Inception",
		});

		expect(result.text).toBeDefined();
	});
});
