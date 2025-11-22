import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import { ToolLoopAgent } from "ai";
import { describe, expect, it } from "vitest";
import { createGitHubAgent } from "./agent";
import { getGitHubAgentPrompt } from "./prompt";

describe("GitHub Agent", () => {
	describe("Agent Creation", () => {
		it("should create an agent instance", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createGitHubAgent(mockModel);

			expect(agent).toBeDefined();
			expect(agent).toBeInstanceOf(ToolLoopAgent);
		});

		it("should initialize with prompt instructions", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createGitHubAgent(mockModel);
			const prompt = getGitHubAgentPrompt();

			// Test that the prompt utility works
			expect(prompt).toBeDefined();
			expect(typeof prompt).toBe("string");
			expect(prompt.length).toBeGreaterThan(0);

			// Agent should be properly created
			expect(agent).toBeDefined();
			expect(agent).toBeInstanceOf(ToolLoopAgent);
		});

		it("should have three tools defined", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createGitHubAgent(mockModel);

			const toolNames = Object.keys(agent.tools);
			expect(toolNames).toHaveLength(3);
			expect(toolNames).toContain("getUserRepositories");
			expect(toolNames).toContain("getRecentCommits");
			expect(toolNames).toContain("searchRepositories");
		});

		it("should have getUserRepositories tool with description", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createGitHubAgent(mockModel);

			expect(agent.tools.getUserRepositories).toBeDefined();
			expect(
				agent.tools.getUserRepositories.description.toLowerCase(),
			).toContain("repositor");
			expect(agent.tools.getUserRepositories.inputSchema).toBeDefined();
			expect(agent.tools.getUserRepositories.execute).toBeDefined();
		});

		it("should have getRecentCommits tool with description", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createGitHubAgent(mockModel);

			expect(agent.tools.getRecentCommits).toBeDefined();
			expect(agent.tools.getRecentCommits.description.toLowerCase()).toContain(
				"commit",
			);
			expect(agent.tools.getRecentCommits.inputSchema).toBeDefined();
			expect(agent.tools.getRecentCommits.execute).toBeDefined();
		});

		it("should have searchRepositories tool with description", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createGitHubAgent(mockModel);

			expect(agent.tools.searchRepositories).toBeDefined();
			expect(
				agent.tools.searchRepositories.description.toLowerCase(),
			).toContain("search");
			expect(agent.tools.searchRepositories.inputSchema).toBeDefined();
			expect(agent.tools.searchRepositories.execute).toBeDefined();
		});
	});

	describe("Agent Execution (Mocked Model)", () => {
		it("should respond to repository queries", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 20, outputTokens: 40, totalTokens: 60 },
					content: [
						{
							type: "text",
							text: "Here are the recent repositories for the user.",
						},
					],
					warnings: [],
				}),
			});

			const agent = createGitHubAgent(mockModel);
			const result = await agent.generate({
				prompt: "Show me repositories for testuser",
			});

			expect(result).toBeDefined();
			expect(result.text).toBeDefined();
			expect(typeof result.text).toBe("string");
		});

		it("should respond to commit queries", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 25, outputTokens: 45, totalTokens: 70 },
					content: [
						{
							type: "text",
							text: "Here are the recent commits for the repository.",
						},
					],
					warnings: [],
				}),
			});

			const agent = createGitHubAgent(mockModel);
			const result = await agent.generate({
				prompt: "Get commits for facebook/react",
			});

			expect(result).toBeDefined();
			expect(result.text).toMatch(/commit/i);
		});

		it("should respond to search queries", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 30, outputTokens: 50, totalTokens: 80 },
					content: [
						{
							type: "text",
							text: "I found several machine learning repositories.",
						},
					],
					warnings: [],
				}),
			});

			const agent = createGitHubAgent(mockModel);
			const result = await agent.generate({
				prompt: "Search for machine learning repositories",
			});

			expect(result).toBeDefined();
			expect(result.text).toMatch(/repositor/i);
		});

		it("should support streaming mode", async () => {
			const mockModel = new MockLanguageModelV3({
				doStream: async () => ({
					stream: simulateReadableStream({
						chunks: [
							{ type: "text-start", id: "text-1" },
							{ type: "text-delta", id: "text-1", delta: "Searching GitHub... " },
							{ type: "text-delta", id: "text-1", delta: "Found results!" },
							{ type: "text-end", id: "text-1" },
							{
								type: "finish",
								finishReason: "stop",
								logprobs: undefined,
								usage: { inputTokens: 15, outputTokens: 20, totalTokens: 35 },
							},
						],
					}),
				}),
			});

			const agent = createGitHubAgent(mockModel);
			const result = await agent.stream({
				prompt: "Find repositories",
			});

			expect(result).toBeDefined();
			expect(result.fullStream).toBeDefined();
			expect(result.text).toBeDefined();

			const text = await result.text;
			expect(typeof text).toBe("string");
			expect(text.length).toBeGreaterThan(0);
		});
	});

	describe("Tool Schema Validation", () => {
		it("should validate getUserRepositories input schema", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createGitHubAgent(mockModel);

			const schema = agent.tools.getUserRepositories.inputSchema;

			// Valid input
			const validInput = {
				username: "testuser",
				days: 30,
				limit: 10,
			};
			expect(schema.safeParse(validInput).success).toBe(true);

			// Invalid input (negative days)
			const invalidInput = {
				username: "testuser",
				days: -5,
				limit: 10,
			};
			expect(schema.safeParse(invalidInput).success).toBe(false);
		});

		it("should validate getRecentCommits input schema", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createGitHubAgent(mockModel);

			const schema = agent.tools.getRecentCommits.inputSchema;

			// Valid input
			const validInput = {
				repoName: "owner/repo",
				days: 7,
				limit: 10,
			};
			expect(schema.safeParse(validInput).success).toBe(true);

			// Missing required field
			const invalidInput = {
				days: 7,
				limit: 10,
			};
			expect(schema.safeParse(invalidInput).success).toBe(false);
		});

		it("should validate searchRepositories input schema", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createGitHubAgent(mockModel);

			const schema = agent.tools.searchRepositories.inputSchema;

			// Valid input
			const validInput = {
				query: "machine learning",
				sort: "stars" as const,
				limit: 20,
			};
			expect(schema.safeParse(validInput).success).toBe(true);

			// Invalid sort option
			const invalidInput = {
				query: "test",
				sort: "invalid",
				limit: 10,
			};
			expect(schema.safeParse(invalidInput).success).toBe(false);
		});

		it("should allow optional parameters with defaults", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createGitHubAgent(mockModel);

			const schema = agent.tools.getUserRepositories.inputSchema;

			// Minimal input (all optional)
			const minimalInput = {};
			const parseResult = schema.safeParse(minimalInput);
			expect(parseResult.success).toBe(true);
		});
	});

	describe("Agent Error Handling", () => {
		it("should handle model errors gracefully", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => {
					throw new Error("Model error");
				},
			});

			const agent = createGitHubAgent(mockModel);

			await expect(
				agent.generate({
					prompt: "Search repositories",
				}),
			).rejects.toThrow("Model error");
		});

		it("should handle empty prompt", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 5, outputTokens: 25, totalTokens: 30 },
					content: [
						{
							type: "text",
							text: "How can I help you with GitHub?",
						},
					],
					warnings: [],
				}),
			});

			const agent = createGitHubAgent(mockModel);
			const result = await agent.generate({
				prompt: "",
			});

			expect(result).toBeDefined();
			expect(result.text).toBeDefined();
		});
	});

	describe("Agent Configuration", () => {
		it("should create agent with custom model", () => {
			const customModel = new MockLanguageModelV3({
				modelId: "custom-github-model",
			});

			const agent = createGitHubAgent(customModel);

			expect(agent).toBeDefined();
			expect(agent).toBeInstanceOf(ToolLoopAgent);
		});

		it("should accept any language model", () => {
			const mockModel = new MockLanguageModelV3({
				modelId: "test-model",
			});

			const agent = createGitHubAgent(mockModel);

			expect(agent).toBeDefined();
			expect(agent).toBeInstanceOf(ToolLoopAgent);
			expect(Object.keys(agent.tools)).toHaveLength(3);
		});
	});
});

