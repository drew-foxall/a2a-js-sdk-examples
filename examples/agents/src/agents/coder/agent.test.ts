import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import { ToolLoopAgent } from "ai";
import { describe, expect, it } from "vitest";
import { createCoderAgent } from "./agent";
import { CODER_SYSTEM_PROMPT } from "./code-format";

describe("Coder Agent", () => {
	describe("Agent Creation", () => {
		it("should create an agent instance", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createCoderAgent(mockModel);

			expect(agent).toBeDefined();
			expect(agent).toBeInstanceOf(ToolLoopAgent);
		});

		it("should initialize with coder system prompt", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createCoderAgent(mockModel);

			// Agent should be properly created with instructions
			expect(agent).toBeDefined();
			expect(agent).toBeInstanceOf(ToolLoopAgent);

			// Verify the prompt is defined
			expect(CODER_SYSTEM_PROMPT).toBeDefined();
			expect(CODER_SYSTEM_PROMPT.length).toBeGreaterThan(0);
		});

		it("should have no tools defined", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createCoderAgent(mockModel);

			expect(Object.keys(agent.tools)).toHaveLength(0);
		});
	});

	describe("Agent Execution (Mocked Model)", () => {
		it("should respond to code generation requests", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 30, outputTokens: 60, totalTokens: 90 },
					content: [
						{
							type: "text",
							text: "```typescript fibonacci.ts\nfunction fib(n: number): number {\n  return n <= 1 ? n : fib(n-1) + fib(n-2);\n}\n```",
						},
					],
					warnings: [],
				}),
			});

			const agent = createCoderAgent(mockModel);
			const result = await agent.generate({
				prompt: "Write a Fibonacci function in TypeScript",
			});

			expect(result).toBeDefined();
			expect(result.text).toBeDefined();
			expect(typeof result.text).toBe("string");
			expect(result.text).toContain("typescript");
		});

		it("should respond to Python code requests", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 25, outputTokens: 50, totalTokens: 75 },
					content: [
						{
							type: "text",
							text: '```python hello.py\ndef hello():\n    print("Hello, World!")\n```',
						},
					],
					warnings: [],
				}),
			});

			const agent = createCoderAgent(mockModel);
			const result = await agent.generate({
				prompt: "Write a hello world function in Python",
			});

			expect(result).toBeDefined();
			expect(result.text).toContain("python");
			expect(result.text).toContain("Hello");
		});

		it("should respond to JavaScript/React requests", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 40, outputTokens: 80, totalTokens: 120 },
					content: [
						{
							type: "text",
							text: "```tsx Button.tsx\nexport const Button = () => <button>Click</button>;\n```",
						},
					],
					warnings: [],
				}),
			});

			const agent = createCoderAgent(mockModel);
			const result = await agent.generate({
				prompt: "Create a simple React Button component",
			});

			expect(result).toBeDefined();
			expect(result.text).toMatch(/button|Button/i);
		});

		it("should support streaming mode", async () => {
			const mockModel = new MockLanguageModelV3({
				doStream: async () => ({
					stream: simulateReadableStream({
						chunks: [
							{ type: "text-start", id: "text-1" },
							{ type: "text-delta", id: "text-1", delta: "```typescript " },
							{ type: "text-delta", id: "text-1", delta: "example.ts\n" },
							{ type: "text-delta", id: "text-1", delta: "const x = 42;\n" },
							{ type: "text-delta", id: "text-1", delta: "```" },
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

			const agent = createCoderAgent(mockModel);
			const result = await agent.stream({
				prompt: "Write a simple TypeScript example",
			});

			expect(result).toBeDefined();
			expect(result.fullStream).toBeDefined();
			expect(result.text).toBeDefined();

			const text = await result.text;
			expect(typeof text).toBe("string");
			expect(text.length).toBeGreaterThan(0);
		});

		it("should handle multi-file generation requests", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 50, outputTokens: 100, totalTokens: 150 },
					content: [
						{
							type: "text",
							text: "```typescript utils.ts\nexport const add = (a: number, b: number) => a + b;\n```\n\n```typescript test.ts\nimport { add } from './utils';\nconsole.log(add(1, 2));\n```",
						},
					],
					warnings: [],
				}),
			});

			const agent = createCoderAgent(mockModel);
			const result = await agent.generate({
				prompt: "Create a utility function and a test file",
			});

			expect(result).toBeDefined();
			expect(result.text).toContain("utils.ts");
			expect(result.text).toContain("test.ts");
		});

		it("should handle complex code with explanations", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 60, outputTokens: 120, totalTokens: 180 },
					content: [
						{
							type: "text",
							text: "Here's a sorting algorithm:\n\n```typescript sort.ts\n/** QuickSort implementation */\nfunction quicksort(arr: number[]): number[] {\n  if (arr.length <= 1) return arr;\n  // ... implementation\n}\n```\n\nThis uses the divide-and-conquer approach.",
						},
					],
					warnings: [],
				}),
			});

			const agent = createCoderAgent(mockModel);
			const result = await agent.generate({
				prompt: "Implement quicksort with explanation",
			});

			expect(result).toBeDefined();
			expect(result.text).toContain("```");
			expect(result.text).toMatch(/sort|algorithm/i);
		});
	});

	describe("Agent Error Handling", () => {
		it("should handle model errors gracefully", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => {
					throw new Error("Model error");
				},
			});

			const agent = createCoderAgent(mockModel);

			await expect(
				agent.generate({
					prompt: "Write some code",
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
							text: "What code would you like me to generate?",
						},
					],
					warnings: [],
				}),
			});

			const agent = createCoderAgent(mockModel);
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
					usage: { inputTokens: 15, outputTokens: 30, totalTokens: 45 },
					content: [
						{
							type: "text",
							text: "```typescript example.ts\n// Example code\nconst example = true;\n```",
						},
					],
					warnings: [],
				}),
			});

			const agent = createCoderAgent(mockModel);
			const result = await agent.generate({
				prompt: "code",
			});

			expect(result).toBeDefined();
			expect(result.text).toBeDefined();
		});
	});

	describe("Agent Configuration", () => {
		it("should create agent with custom model", () => {
			const customModel = new MockLanguageModelV3({
				modelId: "custom-coder-model",
			});

			const agent = createCoderAgent(customModel);

			expect(agent).toBeDefined();
			expect(agent).toBeInstanceOf(ToolLoopAgent);
		});

		it("should accept any language model", () => {
			const mockModel = new MockLanguageModelV3({
				modelId: "codellama-7b",
			});

			const agent = createCoderAgent(mockModel);

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
				const agent = createCoderAgent(model);
				expect(agent).toBeInstanceOf(ToolLoopAgent);
			}
		});
	});

	describe("Code Generation Patterns", () => {
		it("should follow markdown code block format", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 20, outputTokens: 40, totalTokens: 60 },
					content: [
						{
							type: "text",
							text: "```typescript example.ts\nconst code = true;\n```",
						},
					],
					warnings: [],
				}),
			});

			const agent = createCoderAgent(mockModel);
			const result = await agent.generate({
				prompt: "Generate code",
			});

			// Should contain markdown code block delimiters
			expect(result.text).toMatch(/```\w+/);
		});

		it("should include language identifiers", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 25, outputTokens: 45, totalTokens: 70 },
					content: [
						{
							type: "text",
							text: "```python script.py\nprint('test')\n```",
						},
					],
					warnings: [],
				}),
			});

			const agent = createCoderAgent(mockModel);
			const result = await agent.generate({
				prompt: "Python script",
			});

			expect(result.text).toContain("python");
		});

		it("should include filenames in code blocks", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => ({
					finishReason: "stop",
					usage: { inputTokens: 30, outputTokens: 50, totalTokens: 80 },
					content: [
						{
							type: "text",
							text: "```typescript main.ts\nconsole.log('main');\n```",
						},
					],
					warnings: [],
				}),
			});

			const agent = createCoderAgent(mockModel);
			const result = await agent.generate({
				prompt: "Main file",
			});

			expect(result.text).toMatch(/\w+\.\w+/); // filename.extension pattern
		});
	});
});

