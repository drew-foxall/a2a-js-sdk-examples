/**
 * Expense Agent Tests
 */

import { describe, expect, it, vi } from "vitest";
import { createExpenseAgent } from "./agent";
import { getExpenseAgentPrompt } from "./prompt";

// Mock the AI SDK
vi.mock("ai", () => ({
  ToolLoopAgent: vi.fn().mockImplementation((config) => ({
    config,
    tools: config.tools,
    generate: vi.fn().mockResolvedValue({
      text: "Expense submitted successfully",
    }),
  })),
}));

describe("Expense Agent", () => {
  describe("createExpenseAgent", () => {
    it("should create an agent", () => {
      const mockModel = {} as Parameters<typeof createExpenseAgent>[0];
      const agent = createExpenseAgent(mockModel);

      expect(agent).toBeDefined();
    });

    it("should have submit_expense tool", () => {
      const mockModel = {} as Parameters<typeof createExpenseAgent>[0];
      const agent = createExpenseAgent(mockModel);

      expect(agent.tools).toHaveProperty("submit_expense");
    });
  });

  describe("getExpenseAgentPrompt", () => {
    it("should return a non-empty prompt", () => {
      const prompt = getExpenseAgentPrompt();
      expect(prompt).toBeTruthy();
      expect(prompt.length).toBeGreaterThan(100);
    });

    it("should include required field mentions", () => {
      const prompt = getExpenseAgentPrompt();
      expect(prompt).toContain("Expense Type");
      expect(prompt).toContain("Amount");
      expect(prompt).toContain("Date");
    });

    it("should include expense types", () => {
      const prompt = getExpenseAgentPrompt();
      expect(prompt).toContain("travel");
      expect(prompt).toContain("meals");
      expect(prompt).toContain("supplies");
    });
  });
});
