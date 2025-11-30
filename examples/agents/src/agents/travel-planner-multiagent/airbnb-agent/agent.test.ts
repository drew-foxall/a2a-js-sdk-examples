import { ToolLoopAgent } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, it } from "vitest";
import { getAirbnbAgentPrompt } from "./prompt";

/**
 * Airbnb Agent Tests (Multi-Agent System)
 *
 * Purpose: Specialist agent for accommodation search
 * - Part of travel planner multi-agent system
 * - Uses real MCP (@openbnb/mcp-server-airbnb)
 * - Real listings with prices, ratings, amenities
 *
 * Note: Full MCP integration requires a running MCP server.
 * These tests verify the agent structure and prompt.
 */

describe("Airbnb Agent", () => {
  it("should have a valid prompt", () => {
    const prompt = getAirbnbAgentPrompt();
    expect(prompt).toBeDefined();
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
    expect(prompt.toLowerCase()).toContain("airbnb");
  });

  it("should create a ToolLoopAgent when given model and tools", () => {
    const mockModel = new MockLanguageModelV3();

    // Create a minimal agent without MCP tools to verify structure
    const agent = new ToolLoopAgent({
      model: mockModel,
      instructions: getAirbnbAgentPrompt(),
      tools: {},
    });

    expect(agent).toBeInstanceOf(ToolLoopAgent);
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

    // Test without MCP tools (they require a running server)
    const agent = new ToolLoopAgent({
      model: mockModel,
      instructions: getAirbnbAgentPrompt(),
      tools: {},
    });

    const result = await agent.generate({
      prompt: "Find a place in Paris for 2 people",
    });

    expect(result.text).toBeDefined();
  });
});
