/**
 * Expense Agent Tests
 */

import { ToolLoopAgent } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, it } from "vitest";
import { createExpenseAgent } from "./agent";
import { getExpenseAgentPrompt } from "./prompt";

describe("Expense Agent", () => {
  describe("createExpenseAgent", () => {
    it("should create an agent", () => {
      const mockModel = new MockLanguageModelV3();
      const agent = createExpenseAgent(mockModel);

      expect(agent).toBeInstanceOf(ToolLoopAgent);
    });

    it("should have submit_expense tool", () => {
      const mockModel = new MockLanguageModelV3();
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
