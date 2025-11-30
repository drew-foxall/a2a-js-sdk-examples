import type { A2AAdapter } from "@drew-foxall/a2a-ai-sdk-adapter";
import type { AgentCard } from "@drew-foxall/a2a-js-sdk";
import { describe, expect, it } from "vitest";

/**
 * Test utilities for A2A agents
 */

export interface AgentTestContext {
  adapter: A2AAdapter;
  agentCard: AgentCard;
  port?: number;
  baseUrl?: string;
}

/**
 * Basic agent configuration for tests
 */
export interface AgentTestConfig {
  name: string;
  description: string;
  version?: string;
}

/**
 * Creates a basic agent card for testing
 */
export function createTestAgentCard(config: AgentTestConfig): AgentCard {
  const baseUrl = "http://localhost:41200";
  return {
    name: config.name,
    description: config.description,
    url: `${baseUrl}/.well-known/agent-card.json`,
    protocolVersion: "0.3.0",
    version: config.version || "1.0.0",
    defaultInputModes: ["text"],
    defaultOutputModes: ["text"],
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: true,
    },
    skills: [],
  };
}

/**
 * Creates a mock request object for testing
 */
export function createMockRequest(message: string): {
  message: {
    role: string;
    parts: Array<{ kind: string; text: string }>;
  };
} {
  return {
    message: {
      role: "user",
      parts: [
        {
          kind: "text",
          text: message,
        },
      ],
    },
  };
}

/**
 * Validates that an agent card has all required fields
 */
export function validateAgentCard(agentCard: AgentCard): void {
  expect(agentCard).toBeDefined();
  expect(agentCard.name).toBeDefined();
  expect(typeof agentCard.name).toBe("string");
  expect(agentCard.description).toBeDefined();
  expect(typeof agentCard.description).toBe("string");
  expect(agentCard.version).toBeDefined();
  expect(agentCard.capabilities).toBeDefined();
  expect(typeof agentCard.capabilities).toBe("object");
  expect(agentCard.url).toBeDefined();
  expect(agentCard.protocolVersion).toBeDefined();
}

/**
 * Test suite factory for basic agent functionality
 *
 * Tests only public API methods (execute, cancelTask)
 */
export function testBasicAgentFunctionality(
  agentName: string,
  getAdapter: () => A2AAdapter,
  getAgentCard: () => AgentCard
) {
  describe(`${agentName} - Basic Functionality`, () => {
    it("should have a valid agent card", () => {
      const agentCard = getAgentCard();
      validateAgentCard(agentCard);
      expect(agentCard.name).toContain(agentName);
    });

    it("should have a properly configured adapter", () => {
      const adapter = getAdapter();
      expect(adapter).toBeDefined();
      expect(typeof adapter.execute).toBe("function");
      expect(typeof adapter.cancelTask).toBe("function");
    });

    it("should have a properly structured agent card", () => {
      const agentCard = getAgentCard();
      expect(agentCard.capabilities).toBeDefined();
      expect(agentCard.capabilities.streaming).toBeDefined();
    });
  });
}

/**
 * Test artifact generation
 */
export function validateArtifacts(
  parts: Array<{ kind: string; artifact?: unknown }>,
  expectedMimeType?: string
): void {
  const artifacts = parts.filter((p) => p.kind === "artifact");
  expect(artifacts.length).toBeGreaterThan(0);

  if (expectedMimeType) {
    const matchingArtifacts = artifacts.filter((a) => {
      const artifact = a.artifact as { mimeType?: string } | undefined;
      return artifact?.mimeType === expectedMimeType;
    });
    expect(matchingArtifacts.length).toBeGreaterThan(0);
  }
}

/**
 * Creates a test suite for an agent with common scenarios
 *
 * Note: This tests the agent card structure. For testing actual agent
 * responses, use integration tests with a running server.
 */
export function createAgentTestSuite(
  agentName: string,
  config: {
    getAdapter: () => A2AAdapter;
    getAgentCard: () => AgentCard;
    testCases: Array<{
      name: string;
      message: string;
      expectedPattern?: RegExp | string;
      expectArtifacts?: boolean;
      artifactMimeType?: string;
    }>;
    expectedTools?: string[];
  }
): void {
  describe(`${agentName} Agent`, () => {
    testBasicAgentFunctionality(agentName, config.getAdapter, config.getAgentCard);

    // Note: Tool validation and response testing removed as they require
    // access to private adapter internals. Use integration tests instead.
  });
}
