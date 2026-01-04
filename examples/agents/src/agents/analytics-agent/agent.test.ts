import { ToolLoopAgent } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, it } from "vitest";
import { createAnalyticsAgent } from "./agent";

describe("Analytics Agent", () => {
  it("should create agent with no tools (chart generation in adapter layer)", () => {
    const agent = createAnalyticsAgent(new MockLanguageModelV3());
    expect(agent).toBeInstanceOf(ToolLoopAgent);
    expect(agent.tools).toEqual({});
  });

  it("should respond to chart requests", async () => {
    const mockModel = new MockLanguageModelV3({
      doGenerate: async () => ({
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: {
            total: 20,
            noCache: undefined,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: { total: 30, text: undefined, reasoning: undefined },
        },
        content: [
          { type: "text", text: "I'll create a bar chart showing your quarterly sales data." },
        ],
        warnings: [],
      }),
    });

    const result = await createAnalyticsAgent(mockModel).generate({
      prompt: "Generate a chart of sales: Q1:1000 Q2:2000 Q3:1500",
    });

    expect(result.text).toContain("chart");
  });
});
