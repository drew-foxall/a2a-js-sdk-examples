/**
 * Content Planner Agent Tests
 */

import { ToolLoopAgent } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, it } from "vitest";
import { createContentPlannerAgent } from "./agent";
import { getContentPlannerPrompt } from "./prompt";

describe("Content Planner Agent", () => {
  describe("createContentPlannerAgent", () => {
    it("should create an agent", () => {
      const mockModel = new MockLanguageModelV3();
      const agent = createContentPlannerAgent(mockModel);

      expect(agent).toBeInstanceOf(ToolLoopAgent);
    });
  });

  describe("getContentPlannerPrompt", () => {
    it("should return a non-empty prompt", () => {
      const prompt = getContentPlannerPrompt();
      expect(prompt).toBeTruthy();
      expect(prompt.length).toBeGreaterThan(100);
    });

    it("should include key planning elements", () => {
      const prompt = getContentPlannerPrompt();
      expect(prompt).toContain("outline");
      expect(prompt).toContain("Section");
      expect(prompt).toContain("Word Count");
      expect(prompt).toContain("Target Audience");
    });
  });
});
