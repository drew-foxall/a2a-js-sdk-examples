import { MockLanguageModelV3 } from "ai/test";
import { ToolLoopAgent } from "ai";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createAirbnbAgent } from "./agent";

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
		execute: async () => {
			return {
				results: [
					{
						id: "test-001",
						title: "Test Listing",
						price: 150,
					},
				],
			};
		},
	},
});

/**
 * Airbnb Agent Tests (Multi-Agent System)
 * 
 * Purpose: Specialist agent for accommodation search
 * - Part of travel planner multi-agent system
 * - Uses real MCP (@openbnb/mcp-server-airbnb)
 * - Real listings with prices, ratings, amenities
 * 
 * Note: MCP integration tested in tools.mock.test.ts
 */

describe("Airbnb Agent", () => {
	it("should create agent with MCP tools", () => {
		const mockModel = new MockLanguageModelV3();
		const mockTools = createMockMCPTools();
		const agent = createAirbnbAgent(mockModel, mockTools);

		expect(agent).toBeInstanceOf(ToolLoopAgent);
		expect(agent.tools.search_airbnb).toBeDefined();
	});

	it("should respond to accommodation queries", async () => {
		const mockModel = new MockLanguageModelV3({
			doGenerate: async () => ({
				finishReason: "stop",
				usage: { inputTokens: 20, outputTokens: 40, totalTokens: 60 },
				content: [
					{
						type: "text",
						text: "Here are accommodations in Paris.",
					},
				],
				warnings: [],
			}),
		});

		const mockTools = createMockMCPTools();
		const agent = createAirbnbAgent(mockModel, mockTools);
		const result = await agent.generate({
			prompt: "Find a place in Paris for 2 people",
		});

		expect(result.text).toBeDefined();
	});
});
