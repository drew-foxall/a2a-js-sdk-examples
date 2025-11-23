import { ToolLoopAgent } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, it } from "vitest";
import { createHelloWorldAgent } from "./agent";
import { getHelloWorldPrompt } from "./prompt";

/**
 * Hello World Agent Tests
 *
 * Purpose: Foundation example demonstrating the simplest possible A2A agent
 * - Pure AI SDK ToolLoopAgent (protocol-agnostic)
 * - No tools (pure text generation)
 * - Clean separation of concerns
 */

describe("Hello World Agent", () => {
  it("should create agent with no tools", () => {
    const mockModel = new MockLanguageModelV3();
    const agent = createHelloWorldAgent(mockModel);

    expect(agent).toBeInstanceOf(ToolLoopAgent);
    expect(Object.keys(agent.tools)).toHaveLength(0);
  });

  it("should have greeting instructions", () => {
    const prompt = getHelloWorldPrompt();

    expect(prompt).toBeDefined();
    expect(typeof prompt).toBe("string");
    expect(prompt.toLowerCase()).toContain("greeting");
  });

  it("should respond to greetings", async () => {
    const mockModel = new MockLanguageModelV3({
      doGenerate: async () => ({
        finishReason: "stop",
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [
          {
            type: "text",
            text: "Hello! How can I help you today?",
          },
        ],
        warnings: [],
      }),
    });

    const agent = createHelloWorldAgent(mockModel);
    const result = await agent.generate({
      prompt: "Hello!",
    });

    expect(result.text).toBeDefined();
    expect(typeof result.text).toBe("string");
  });
});
