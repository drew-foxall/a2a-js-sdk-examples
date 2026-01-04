import { ToolLoopAgent } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, it } from "vitest";
import { createCoderAgent } from "./agent";
import { CODER_SYSTEM_PROMPT } from "./code-format";

/**
 * Coder Agent Tests
 *
 * Purpose: Demonstrates code generation with streaming artifacts
 * - High-quality code generation
 * - Multi-file support
 * - Markdown parsing for code blocks
 *
 * Note: Code parsing tested in code-format.test.ts
 */

describe("Coder Agent", () => {
  it("should create agent with no tools", () => {
    const mockModel = new MockLanguageModelV3();
    const agent = createCoderAgent(mockModel);

    expect(agent).toBeInstanceOf(ToolLoopAgent);
    expect(Object.keys(agent.tools)).toHaveLength(0);
  });

  it("should have code generation instructions", () => {
    expect(CODER_SYSTEM_PROMPT).toBeDefined();
    expect(CODER_SYSTEM_PROMPT.toLowerCase()).toContain("code");
  });

  it("should respond to code generation requests", async () => {
    const mockModel = new MockLanguageModelV3({
      doGenerate: async () => ({
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: {
            total: 30,
            noCache: undefined,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: { total: 60, text: undefined, reasoning: undefined },
        },
        content: [
          {
            type: "text",
            text: "```typescript fibonacci.ts\nfunction fib(n: number): number {\n  return n <= 1 ? n : fib(n-1) + fib(n-2);\n}\n```",
          },
        ],
        warnings: [],
      }),
    });

    const agent = createCoderAgent(mockModel);
    const result = await agent.generate({
      prompt: "Write a Fibonacci function in TypeScript",
    });

    expect(result.text).toContain("typescript");
  });
});
