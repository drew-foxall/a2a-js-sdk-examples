import { ToolLoopAgent } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, it } from "vitest";
import { createGitHubAgent } from "./agent";

/**
 * GitHub Agent Tests
 *
 * Purpose: Demonstrates external API integration with GitHub REST API
 * - Three tools: getUserRepositories, getRecentCommits, searchRepositories
 * - Optional authentication pattern
 * - Rate limit awareness
 *
 * Note: API integration tested in tools.test.ts
 */

describe("GitHub Agent", () => {
  it("should create agent with three GitHub tools", () => {
    const mockModel = new MockLanguageModelV3();
    const agent = createGitHubAgent(mockModel);

    expect(agent).toBeInstanceOf(ToolLoopAgent);
    const toolNames = Object.keys(agent.tools);
    expect(toolNames).toHaveLength(3);
    expect(toolNames).toContain("getUserRepositories");
    expect(toolNames).toContain("getRecentCommits");
    expect(toolNames).toContain("searchRepositories");
  });

  it("should respond to repository queries", async () => {
    const mockModel = new MockLanguageModelV3({
      doGenerate: async () => ({
        finishReason: "stop",
        usage: { inputTokens: 20, outputTokens: 40, totalTokens: 60 },
        content: [
          {
            type: "text",
            text: "Here are the recent repositories for the user.",
          },
        ],
        warnings: [],
      }),
    });

    const agent = createGitHubAgent(mockModel);
    const result = await agent.generate({
      prompt: "Show me repositories for testuser",
    });

    expect(result.text).toBeDefined();
  });
});
