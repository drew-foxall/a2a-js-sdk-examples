import { ToolLoopAgent } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, it } from "vitest";
import { createCurrencyAgent } from "./agent";

/**
 * Currency Agent Tests
 *
 * Purpose: Demonstrates multi-turn conversation with external API integration
 * - Currency conversion using Frankfurter API
 * - Can request missing information (multi-turn)
 * - Maintains conversation context
 *
 * Note: API integration tested in tools.test.ts
 */

describe("Currency Agent", () => {
  it("should create agent with exchange rate tool", () => {
    const mockModel = new MockLanguageModelV3();
    const agent = createCurrencyAgent(mockModel);

    expect(agent).toBeInstanceOf(ToolLoopAgent);
    const toolNames = Object.keys(agent.tools);
    expect(toolNames).toContain("get_exchange_rate");
  });

  it("should respond to currency conversion requests", async () => {
    const mockModel = new MockLanguageModelV3({
      doGenerate: async () => ({
        finishReason: "stop",
        usage: { inputTokens: 20, outputTokens: 30, totalTokens: 50 },
        content: [
          {
            type: "text",
            text: "1 USD is approximately 0.92 EUR",
          },
        ],
        warnings: [],
      }),
    });

    const agent = createCurrencyAgent(mockModel);
    const result = await agent.generate({
      prompt: "Convert 1 USD to EUR",
    });

    expect(result.text).toBeDefined();
  });
});
