import { ToolLoopAgent } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, it } from "vitest";
import { createAnalyticsAgent } from "./agent";

/**
 * Analytics Agent Tests
 * 
 * Purpose: Demonstrates image artifact generation with streaming
 * - Chart generation using Chart.js
 * - PNG artifacts streamed to clients
 * - Data parsing from natural language
 * 
 * Note: Chart generation tested in tools.test.ts
 */

describe("Analytics Agent", () => {
	it("should create agent with no tools", () => {
		const mockModel = new MockLanguageModelV3();
		const agent = createAnalyticsAgent(mockModel);

		expect(agent).toBeInstanceOf(ToolLoopAgent);
		// Chart generation happens in adapter layer via parseArtifacts
		expect(agent.tools).toEqual({});
	});

	it("should respond to chart requests", async () => {
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

		expect(result.text).toContain("chart");
	});
});

