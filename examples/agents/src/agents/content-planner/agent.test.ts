/**
 * Content Planner Agent Tests
 */

import { describe, expect, it, vi } from "vitest";
import { createContentPlannerAgent } from "./agent";
import { getContentPlannerPrompt } from "./prompt";

// Mock the AI SDK
vi.mock("ai", () => ({
  ToolLoopAgent: vi.fn().mockImplementation((config) => ({
    config,
    generate: vi.fn().mockResolvedValue({
      text: "# Content Outline\n\n## Introduction\n- Key point 1\n- Key point 2",
    }),
  })),
}));

describe("Content Planner Agent", () => {
  describe("createContentPlannerAgent", () => {
    it("should create an agent", () => {
      const mockModel = {} as Parameters<typeof createContentPlannerAgent>[0];
      const agent = createContentPlannerAgent(mockModel);

      expect(agent).toBeDefined();
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
