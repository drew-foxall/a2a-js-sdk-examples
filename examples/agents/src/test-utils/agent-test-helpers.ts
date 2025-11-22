import { describe, expect, it } from "vitest";
import type { A2AAdapter } from "@drew-foxall/a2a-ai-sdk-adapter";
import type { AgentCard } from "@drew-foxall/a2a-js-sdk";

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
 */
export function testBasicAgentFunctionality(
	agentName: string,
	getAdapter: () => A2AAdapter,
	getAgentCard: () => AgentCard,
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
			expect(adapter.agent).toBeDefined();
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
 * Test adapter response handling
 */
export async function testAdapterResponse(
	adapter: A2AAdapter,
	userMessage: string,
	expectedResponsePattern?: RegExp | string,
): Promise<void> {
	const request = createMockRequest(userMessage);

	// Test in generate mode
	if (adapter.mode === "generate") {
		const response = await adapter.handleMessage(request.message, {});
		expect(response).toBeDefined();
		expect(response.message).toBeDefined();
		expect(response.message.role).toBe("agent");
		expect(response.message.parts).toBeDefined();
		expect(Array.isArray(response.message.parts)).toBe(true);
		expect(response.message.parts.length).toBeGreaterThan(0);

		// Check response content if pattern provided
		if (expectedResponsePattern) {
			const textParts = response.message.parts.filter(
				(p: { kind: string; text?: string }) =>
					p.kind === "text" && p.text !== undefined,
			);
			expect(textParts.length).toBeGreaterThan(0);

			const fullText = textParts
				.map((p: { text?: string }) => p.text)
				.join(" ");

			if (typeof expectedResponsePattern === "string") {
				expect(fullText.toLowerCase()).toContain(
					expectedResponsePattern.toLowerCase(),
				);
			} else {
				expect(fullText).toMatch(expectedResponsePattern);
			}
		}
	}
}

/**
 * Test artifact generation
 */
export function validateArtifacts(
	parts: Array<{ kind: string; artifact?: unknown }>,
	expectedMimeType?: string,
): void {
	const artifacts = parts.filter((p) => p.kind === "artifact");
	expect(artifacts.length).toBeGreaterThan(0);

	if (expectedMimeType) {
		const matchingArtifacts = artifacts.filter(
			(a: { artifact?: { mimeType?: string } }) =>
				a.artifact?.mimeType === expectedMimeType,
		);
		expect(matchingArtifacts.length).toBeGreaterThan(0);
	}
}

/**
 * Validates that tools are properly defined
 */
export function validateTools(adapter: A2AAdapter, toolNames: string[]): void {
	expect(adapter.agent).toBeDefined();
	expect(adapter.agent.tools).toBeDefined();

	const actualToolNames = Object.keys(adapter.agent.tools);
	for (const toolName of toolNames) {
		expect(actualToolNames).toContain(toolName);
	}
}

/**
 * Creates a test suite for an agent with common scenarios
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
	},
): void {
	describe(`${agentName} Agent`, () => {
		testBasicAgentFunctionality(
			agentName,
			config.getAdapter,
			config.getAgentCard,
		);

		if (config.expectedTools) {
			it("should have expected tools", () => {
				const adapter = config.getAdapter();
				validateTools(adapter, config.expectedTools!);
			});
		}

		for (const testCase of config.testCases) {
			it(testCase.name, async () => {
				const adapter = config.getAdapter();
				const request = createMockRequest(testCase.message);

				if (adapter.mode === "generate") {
					const response = await adapter.handleMessage(request.message, {});

					if (testCase.expectedPattern) {
						const textParts = response.message.parts.filter(
							(p: { kind: string; text?: string }) =>
								p.kind === "text" && p.text !== undefined,
						);
						const fullText = textParts
							.map((p: { text?: string }) => p.text)
							.join(" ");

						if (typeof testCase.expectedPattern === "string") {
							expect(fullText.toLowerCase()).toContain(
								testCase.expectedPattern.toLowerCase(),
							);
						} else {
							expect(fullText).toMatch(testCase.expectedPattern);
						}
					}

					if (testCase.expectArtifacts) {
						validateArtifacts(
							response.message.parts,
							testCase.artifactMimeType,
						);
					}
				}
			}, 30000); // 30s timeout for LLM calls
		}
	});
}

