import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import { ToolLoopAgent, type LanguageModel } from "ai";
import { describe, expect, it, vi } from "vitest";
import { createContentEditorAgent } from "./agent";
import { CONTENT_EDITOR_PROMPT } from "./prompt";

describe("Content Editor Agent", () => {
	describe("Agent Creation", () => {
		it("should create an agent instance", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createContentEditorAgent(mockModel);

			expect(agent).toBeDefined();
			expect(agent).toBeInstanceOf(ToolLoopAgent);
		});

		it("should initialize with content editor prompt", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createContentEditorAgent(mockModel);

			// Agent should be properly created
			expect(agent).toBeDefined();
			expect(agent).toBeInstanceOf(ToolLoopAgent);

			// Verify the prompt is defined
			expect(CONTENT_EDITOR_PROMPT).toBeDefined();
			expect(CONTENT_EDITOR_PROMPT.length).toBeGreaterThan(0);
		});

		it("should have no tools defined", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createContentEditorAgent(mockModel);

			expect(Object.keys(agent.tools)).toHaveLength(0);
		});
	});

	describe("Agent Execution (Mocked Model)", () => {
		it("should respond to content editing requests", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 30, outputTokens: 60, totalTokens: 90 },
					content: [
						{
							type: "text",
							text: "Here's your edited content:\n\nThe quick brown fox jumps over the lazy dog.\n\nChanges made: Fixed grammar and punctuation.",
						},
					],
					warnings: [],
				}),
			});

			const agent = createContentEditorAgent(mockModel);
			const result = await agent.generate({
				prompt: "Edit this: the quick brown fox jump over lazy dog",
			});

			expect(result).toBeDefined();
			expect(result.text).toBeDefined();
			expect(typeof result.text).toBe("string");
			expect(result.text).toContain("edited");
		});

		it("should respond to proofreading requests", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 25, outputTokens: 50, totalTokens: 75 },
					content: [
						{
							type: "text",
							text: "Your text looks good! No major errors found.",
						},
					],
					warnings: [],
				}),
			});

			const agent = createContentEditorAgent(mockModel);
			const result = await agent.generate({
				prompt: "Proofread this: Hello, world!",
			});

			expect(result).toBeDefined();
			expect(result.text).toContain("text");
		});

		it("should respond to style improvement requests", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 40, outputTokens: 80, totalTokens: 120 },
					content: [
						{
							type: "text",
							text: "Improved version:\n\nThis solution enhances clarity and engagement.\n\nChanges: Made language more professional and concise.",
						},
					],
					warnings: [],
				}),
			});

			const agent = createContentEditorAgent(mockModel);
			const result = await agent.generate({
				prompt: "Improve the style: This makes things better.",
			});

			expect(result).toBeDefined();
			expect(result.text).toMatch(/improve|enhance|better/i);
		});

		it("should support streaming mode", async () => {
			const mockModel = new MockLanguageModelV3({
				doStream: async () => ({
					stream: simulateReadableStream({
						chunks: [
							{ type: "text-start", id: "text-1" },
							{ type: "text-delta", id: "text-1", delta: "Here's the " },
							{ type: "text-delta", id: "text-1", delta: "edited version: " },
							{ type: "text-delta", id: "text-1", delta: "The content is now improved." },
							{ type: "text-end", id: "text-1" },
							{
								type: "finish",
								finishReason: "stop",
								logprobs: undefined,
								usage: { inputTokens: 20, outputTokens: 30, totalTokens: 50 },
							},
						],
					}),
				}),
			});

			const agent = createContentEditorAgent(mockModel);
			const result = await agent.stream({
				prompt: "Edit my content",
			});

			expect(result).toBeDefined();
			expect(result.fullStream).toBeDefined();
			expect(result.text).toBeDefined();

			const text = await result.text;
			expect(typeof text).toBe("string");
			expect(text.length).toBeGreaterThan(0);
		});

		it("should handle grammar correction requests", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 35, outputTokens: 70, totalTokens: 105 },
					content: [
						{
							type: "text",
							text: "Corrected: They are going to the store.\n\nFixed: Subject-verb agreement.",
						},
					],
					warnings: [],
				}),
			});

			const agent = createContentEditorAgent(mockModel);
			const result = await agent.generate({
				prompt: "Fix grammar: They is going to store",
			});

			expect(result).toBeDefined();
			expect(result.text).toContain("Corrected");
		});

		it("should handle spelling correction requests", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 30, outputTokens: 55, totalTokens: 85 },
					content: [
						{
							type: "text",
							text: "Corrected: I received your message.\n\nFixed: 'recieved' → 'received'",
						},
					],
					warnings: [],
				}),
			});

			const agent = createContentEditorAgent(mockModel);
			const result = await agent.generate({
				prompt: "Check spelling: I recieved your message",
			});

			expect(result).toBeDefined();
			expect(result.text).toMatch(/correct|fix|received/i);
		});

		it("should handle long-form content editing", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 100, outputTokens: 150, totalTokens: 250 },
					content: [
						{
							type: "text",
							text: "Edited article:\n\n[Long edited content here]\n\nSummary of changes:\n1. Improved clarity\n2. Fixed grammar\n3. Enhanced flow",
						},
					],
					warnings: [],
				}),
			});

			const agent = createContentEditorAgent(mockModel);
			const result = await agent.generate({
				prompt: "Edit this article: [long content]",
			});

			expect(result).toBeDefined();
			expect(result.text).toContain("Edited");
		});
	});

	describe("Agent Error Handling", () => {
		it("should handle model errors gracefully", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => {
					throw new Error("Model error");
				},
			});

			const agent = createContentEditorAgent(mockModel);

			await expect(
				agent.generate({
					prompt: "Edit this text",
				}),
			).rejects.toThrow("Model error");
		});

		it("should handle empty prompt", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 5, outputTokens: 20, totalTokens: 25 },
					content: [
						{
							type: "text",
							text: "Please provide content to edit.",
						},
					],
					warnings: [],
				}),
			});

			const agent = createContentEditorAgent(mockModel);
			const result = await agent.generate({
				prompt: "",
			});

			expect(result).toBeDefined();
			expect(result.text).toBeDefined();
		});

		it("should handle vague requests", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 10, outputTokens: 25, totalTokens: 35 },
					content: [
						{
							type: "text",
							text: "Please provide the specific content you'd like me to edit.",
						},
					],
					warnings: [],
				}),
			});

			const agent = createContentEditorAgent(mockModel);
			const result = await agent.generate({
				prompt: "help",
			});

			expect(result).toBeDefined();
			expect(result.text).toBeDefined();
		});
	});

	describe("Agent Configuration", () => {
		it("should create agent with custom model", () => {
			const customModel = new MockLanguageModelV3({
				modelId: "custom-editor-model",
			});

			const agent = createContentEditorAgent(customModel);

			expect(agent).toBeDefined();
			expect(agent).toBeInstanceOf(ToolLoopAgent);
		});

		it("should accept any language model", () => {
			const customModel: LanguageModel = {
				doGenerate: vi.fn(),
				doStream: vi.fn(),
				modelId: "gpt-4",
				provider: "openai",
				specificationVersion: "v3",
				_supportedUrls: vi.fn(),
			};

			const agent = createContentEditorAgent(customModel);

			expect(agent).toBeDefined();
			expect(agent).toBeInstanceOf(ToolLoopAgent);
			expect(Object.keys(agent.tools)).toHaveLength(0);
		});

		it("should work with different model types (conceptual test)", () => {
			// Test that the factory function can accept any LanguageModel
			const models = [
				new MockLanguageModelV3({ modelId: "gpt-4" }),
				new MockLanguageModelV3({ modelId: "claude-3" }),
				new MockLanguageModelV3({ modelId: "gemini-pro" }),
			];

			for (const model of models) {
				const agent = createContentEditorAgent(model);
				expect(agent).toBeInstanceOf(ToolLoopAgent);
			}
		});
	});

	describe("Content Editor Prompt", () => {
		it("should have a well-defined prompt", () => {
			expect(CONTENT_EDITOR_PROMPT).toBeDefined();
			expect(typeof CONTENT_EDITOR_PROMPT).toBe("string");
			expect(CONTENT_EDITOR_PROMPT.length).toBeGreaterThan(50);
		});

		it("should mention editing responsibilities", () => {
			expect(CONTENT_EDITOR_PROMPT.toLowerCase()).toContain("edit");
			expect(CONTENT_EDITOR_PROMPT.toLowerCase()).toContain("content");
		});

		it("should mention grammar and spelling", () => {
			expect(CONTENT_EDITOR_PROMPT.toLowerCase()).toContain("grammar");
			expect(CONTENT_EDITOR_PROMPT.toLowerCase()).toContain("spelling");
		});

		it("should mention maintaining user's voice", () => {
			expect(CONTENT_EDITOR_PROMPT.toLowerCase()).toMatch(/voice|intent/);
		});
	});

	describe("Content Editing Patterns", () => {
		it("should provide edited content with explanations", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 20, outputTokens: 40, totalTokens: 60 },
					content: [
						{
							type: "text",
							text: "Edited: Great work!\n\nChanges: Capitalized first letter.",
						},
					],
					warnings: [],
				}),
			});

			const agent = createContentEditorAgent(mockModel);
			const result = await agent.generate({
				prompt: "Edit: great work",
			});

			expect(result.text).toContain("Edit");
		});

		it("should handle requests for specific types of edits", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 25, outputTokens: 45, totalTokens: 70 },
					content: [
						{
							type: "text",
							text: "Here's a more professional version: ...",
						},
					],
					warnings: [],
				}),
			});

			const agent = createContentEditorAgent(mockModel);
			const result = await agent.generate({
				prompt: "Make this more professional: hey dude",
			});

			expect(result.text).toMatch(/professional|formal/i);
		});

		it("should maintain conversational tone", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 30, outputTokens: 50, totalTokens: 80 },
					content: [
						{
							type: "text",
							text: "I've edited your content to be clearer and more engaging.",
						},
					],
					warnings: [],
				}),
			});

			const agent = createContentEditorAgent(mockModel);
			const result = await agent.generate({
				prompt: "Can you edit this for me?",
			});

			expect(result.text).toBeDefined();
			expect(typeof result.text).toBe("string");
		});
	});
});

