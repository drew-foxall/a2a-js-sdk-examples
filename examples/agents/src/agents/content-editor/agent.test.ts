import { ToolLoopAgent } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, it } from "vitest";
import { createContentEditorAgent } from "./agent";
import { CONTENT_EDITOR_PROMPT } from "./prompt";

/**
 * Content Editor Agent Tests
 *
 * Purpose: Demonstrates professional content editing and proofreading
 * - Grammar and spelling corrections
 * - Style improvements
 * - Maintains user voice and intent
 */

describe("Content Editor Agent", () => {
  it("should create agent with no tools", () => {
    const mockModel = new MockLanguageModelV3();
    const agent = createContentEditorAgent(mockModel);

    expect(agent).toBeInstanceOf(ToolLoopAgent);
    expect(Object.keys(agent.tools)).toHaveLength(0);
  });

  it("should have content editing instructions", () => {
    expect(CONTENT_EDITOR_PROMPT).toBeDefined();
    expect(CONTENT_EDITOR_PROMPT.toLowerCase()).toContain("editor");
  });

  it("should respond to content editing requests", async () => {
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
            text: "Here's your edited content:\n\nThe quick brown fox jumps over the lazy dog.\n\nChanges made: Fixed grammar and punctuation.",
          },
        ],
        warnings: [],
      }),
    });

    const agent = createContentEditorAgent(mockModel);
    const result = await agent.generate({
      prompt: "Edit this: the quick brown fox jump over lazy dog",
    });

    expect(result.text).toBeDefined();
  });
});
