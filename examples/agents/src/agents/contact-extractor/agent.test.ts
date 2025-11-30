/**
 * Contact Extractor Agent Tests
 */

import { describe, expect, it, vi } from "vitest";
import { createContactExtractorAgent } from "./agent";
import { getContactExtractorPrompt } from "./prompt";

// Mock the AI SDK
vi.mock("ai", () => ({
  ToolLoopAgent: vi.fn().mockImplementation((config) => ({
    config,
    generate: vi.fn().mockResolvedValue({
      text: "Contact extracted:\n- Name: John Doe\n- Email: john@example.com\n- Phone: +1-555-123-4567",
    }),
  })),
}));

describe("Contact Extractor Agent", () => {
  describe("createContactExtractorAgent", () => {
    it("should create an agent", () => {
      const mockModel = {} as Parameters<typeof createContactExtractorAgent>[0];
      const agent = createContactExtractorAgent(mockModel);

      expect(agent).toBeDefined();
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
