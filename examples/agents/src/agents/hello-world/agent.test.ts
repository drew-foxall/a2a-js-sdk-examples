import { ToolLoopAgent } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, it } from "vitest";
import { createHelloWorldAgent } from "./agent";
import { getHelloWorldPrompt } from "./prompt";

describe("Hello World Agent", () => {
  it("should create agent with no tools and greeting instructions", () => {
    const agent = createHelloWorldAgent(new MockLanguageModelV3());
    const prompt = getHelloWorldPrompt();

    expect(agent).toBeInstanceOf(ToolLoopAgent);
    expect(Object.keys(agent.tools)).toHaveLength(0);
    expect(prompt.toLowerCase()).toContain("greeting");
  });

  it("should respond to greetings", async () => {
    const mockModel = new MockLanguageModelV3({
      doGenerate: async () => ({
        finishReason: "stop",
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [{ type: "text", text: "Hello! How can I help you today?" }],
        warnings: [],
      }),
    });

    const result = await createHelloWorldAgent(mockModel).generate({ prompt: "Hello!" });
    expect(result.text).toBeDefined();
  });
});
