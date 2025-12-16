/**
 * Contact Extractor Agent Tests
 */

import { ToolLoopAgent } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, it } from "vitest";
import { createContactExtractorAgent } from "./agent";
import { getContactExtractorPrompt } from "./prompt";

describe("Contact Extractor Agent", () => {
  describe("createContactExtractorAgent", () => {
    it("should create an agent", () => {
      const mockModel = new MockLanguageModelV3();
      const agent = createContactExtractorAgent(mockModel);

      expect(agent).toBeInstanceOf(ToolLoopAgent);
    });
  });

  describe("getContactExtractorPrompt", () => {
    it("should return a non-empty prompt", () => {
      const prompt = getContactExtractorPrompt();
      expect(prompt).toBeTruthy();
      expect(prompt.length).toBeGreaterThan(100);
    });

    it("should include required field mentions", () => {
      const prompt = getContactExtractorPrompt();
      expect(prompt).toContain("Name");
      expect(prompt).toContain("Email");
      expect(prompt).toContain("Phone");
    });

    it("should mention clarifying questions", () => {
      const prompt = getContactExtractorPrompt();
      expect(prompt).toContain("clarifying");
    });
  });
});
