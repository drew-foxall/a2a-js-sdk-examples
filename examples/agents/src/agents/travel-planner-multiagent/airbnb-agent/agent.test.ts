import { ToolLoopAgent } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, it } from "vitest";
import { getAirbnbAgentPrompt } from "./prompt";

describe("Airbnb Agent", () => {
  it("should have valid prompt and create ToolLoopAgent", () => {
    const prompt = getAirbnbAgentPrompt();
    expect(prompt.toLowerCase()).toContain("airbnb");

    const agent = new ToolLoopAgent({
      model: new MockLanguageModelV3(),
      instructions: prompt,
      tools: {},
    });
    expect(agent).toBeInstanceOf(ToolLoopAgent);
  });

  it("should respond to accommodation queries", async () => {
    const mockModel = new MockLanguageModelV3({
      doGenerate: async () => ({
        finishReason: "stop",
        usage: { inputTokens: 20, outputTokens: 40, totalTokens: 60 },
        content: [{ type: "text", text: "Here are accommodations in Paris." }],
        warnings: [],
      }),
    });

    const agent = new ToolLoopAgent({ model: mockModel, instructions: getAirbnbAgentPrompt(), tools: {} });
    const result = await agent.generate({ prompt: "Find a place in Paris for 2 people" });
    expect(result.text).toBeDefined();
  });
});
