/**
 * Agent Card Builder Tests
 */

import { describe, expect, it } from "vitest";
import {
  buildAgentCard,
  createSkill,
  mergeSkills,
  DEFAULT_AGENT_CARD_CONFIG,
} from "./agent-card.js";
import type { AgentSkill } from "@drew-foxall/a2a-js-sdk";

// Test Fixtures
const testSkill: AgentSkill = {
  id: "test_skill",
  name: "Test Skill",
  description: "A skill for testing",
  tags: ["test"],
  examples: ["Do something"],
};

const baseOptions = {
  name: "Test Agent",
  description: "A test agent",
  skills: [testSkill],
};

describe("buildAgentCard", () => {
  it("should set required fields from options and baseUrl", () => {
    const card = buildAgentCard("https://example.com", baseOptions);

    expect(card.url).toBe("https://example.com");
    expect(card.name).toBe("Test Agent");
    expect(card.description).toBe("A test agent");
    expect(card.skills).toEqual([testSkill]);
  });

  it("should use defaults for optional fields", () => {
    const card = buildAgentCard("https://example.com", baseOptions);

    expect(card.version).toBe(DEFAULT_AGENT_CARD_CONFIG.version);
    expect(card.protocolVersion).toBe(DEFAULT_AGENT_CARD_CONFIG.protocolVersion);
    expect(card.preferredTransport).toBe(DEFAULT_AGENT_CARD_CONFIG.preferredTransport);
    expect(card.defaultInputModes).toEqual(DEFAULT_AGENT_CARD_CONFIG.defaultInputModes);
    expect(card.defaultOutputModes).toEqual(DEFAULT_AGENT_CARD_CONFIG.defaultOutputModes);
    expect(card.capabilities).toEqual(DEFAULT_AGENT_CARD_CONFIG.capabilities);
  });

  it("should allow overriding defaults", () => {
    const card = buildAgentCard("https://example.com", {
      ...baseOptions,
      version: "2.0.0",
      protocolVersion: "0.4.0",
      preferredTransport: "HTTP",
      defaultInputModes: ["text", "image"],
    });

    expect(card.version).toBe("2.0.0");
    expect(card.protocolVersion).toBe("0.4.0");
    expect(card.preferredTransport).toBe("HTTP");
    expect(card.defaultInputModes).toEqual(["text", "image"]);
  });

  it("should merge custom capabilities with defaults", () => {
    const card = buildAgentCard("https://example.com", {
      ...baseOptions,
      capabilities: { stateTransitionHistory: true },
    });

    expect(card.capabilities).toEqual({
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: true,
    });
  });

  it("should include optional fields only when provided", () => {
    const minimal = buildAgentCard("https://example.com", baseOptions);
    expect(minimal.securitySchemes).toBeUndefined();
    expect(minimal.security).toBeUndefined();
    expect(minimal.provider).toBeUndefined();

    const full = buildAgentCard("https://example.com", {
      ...baseOptions,
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } },
      security: [{ bearerAuth: [] }],
      provider: { name: "Test Provider" },
    });
    expect(full.securitySchemes).toBeDefined();
    expect(full.security).toBeDefined();
    expect(full.provider).toEqual({ name: "Test Provider" });
  });
});

describe("createSkill", () => {
  it("should return the skill unchanged", () => {
    const skill = createSkill(testSkill);
    expect(skill).toEqual(testSkill);
  });
});

describe("mergeSkills", () => {
  it("should merge multiple skill arrays preserving order", () => {
    const skill2: AgentSkill = { id: "2", name: "Two", description: "Second" };
    const merged = mergeSkills([testSkill], [skill2]);

    expect(merged).toHaveLength(2);
    expect(merged[0].id).toBe("test_skill");
    expect(merged[1].id).toBe("2");
  });

  it("should handle empty arrays and no arguments", () => {
    expect(mergeSkills([], [testSkill], [])).toHaveLength(1);
    expect(mergeSkills()).toEqual([]);
  });
});

describe("DEFAULT_AGENT_CARD_CONFIG", () => {
  it("should have correct values", () => {
    expect(DEFAULT_AGENT_CARD_CONFIG.protocolVersion).toBe("0.3.0");
    expect(DEFAULT_AGENT_CARD_CONFIG.version).toBe("1.0.0");
    expect(DEFAULT_AGENT_CARD_CONFIG.preferredTransport).toBe("JSONRPC");
    expect(DEFAULT_AGENT_CARD_CONFIG.capabilities.streaming).toBe(true);
    expect(DEFAULT_AGENT_CARD_CONFIG.capabilities.pushNotifications).toBe(false);
  });
});
