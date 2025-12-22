# Agent Test Principles

**Reference Implementation:** [analytics-agent tests](src/agents/analytics-agent/)

This guide establishes consistent patterns for testing A2A agents built with AI SDK's `ToolLoopAgent`.

---

## Core Principles

### 1. 🎯 Test Your Logic, Not the AI SDK

**Focus on:**
- Your agent creation logic
- Your tool implementations
- Your data transformations
- Your error handling

**Don't test:**
- AI SDK internals
- Model behavior
- Streaming mechanics

### 2. ⚡ Keep Tests Fast

**Target:** < 1 second per test file

✅ **DO:**
- Mock all AI model calls
- Test pure functions directly
- Use `MockLanguageModelV3` from `ai/test`

❌ **DON'T:**
- Make real API calls to LLMs
- Test with actual OpenAI/Anthropic keys
- Wait for streaming in unit tests

### 3. 📂 Separate Concerns

Split tests by responsibility:

```
analytics-agent/
├── agent.ts              # Agent creation
├── agent.test.ts         # Test agent with mocks (fast)
├── tools.ts              # Utility functions
├── tools.test.ts         # Test tools directly (fast)
└── index.ts              # A2A server (not unit tested)
```

---

## File Structure Pattern

### `agent.test.ts` - Test the ToolLoopAgent

**Purpose:** Verify agent creation and basic behavior with mocked models

```typescript
import { MockLanguageModelV3 } from "ai/test";
import { simulateReadableStream } from "ai";
import { describe, expect, it } from "vitest";
import { createMyAgent } from "./agent";

describe("My Agent", () => {
  describe("Agent Creation", () => {
    it("should create agent with mock model", () => {
      const mockModel = new MockLanguageModelV3({
        doGenerate: async () => ({
          finishReason: "stop",
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [{ type: "text", text: "Response" }],
          warnings: [],
        }),
      });

      const agent = createMyAgent(mockModel);
      
      expect(agent).toBeDefined();
      expect(agent).toBeInstanceOf(ToolLoopAgent);
    });
  });

  describe("Agent Execution", () => {
    it("should generate response", async () => {
      const mockModel = new MockLanguageModelV3({
        doGenerate: async () => ({
          finishReason: "stop",
          usage: { inputTokens: 20, outputTokens: 30, totalTokens: 50 },
          content: [{ type: "text", text: "Expected response" }],
          warnings: [],
        }),
      });

      const agent = createMyAgent(mockModel);
      const result = await agent.generate({
        prompt: "Test prompt",
      });

      expect(result).toBeDefined();
      expect(result.text).toContain("Expected");
    });
    
    it("should support streaming", async () => {
      const mockModel = new MockLanguageModelV3({
        doStream: async () => ({
          stream: simulateReadableStream({
            chunks: [
              { type: "text-start", id: "text-1" },
              { type: "text-delta", id: "text-1", delta: "Response" },
              { type: "text-end", id: "text-1" },
              {
                type: "finish",
                finishReason: "stop",
                logprobs: undefined,
                usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 },
              },
            ],
          }),
        }),
      });

      const agent = createMyAgent(mockModel);
      const result = await agent.stream({ prompt: "Test" });

      expect(result).toBeDefined();
      expect(result.fullStream).toBeDefined();
      
      const text = await result.text;
      expect(typeof text).toBe("string");
    });
  });

  describe("Agent Error Handling", () => {
    it("should handle model errors gracefully", async () => {
      const mockModel = new MockLanguageModelV3({
        doGenerate: async () => {
          throw new Error("Model error");
        },
      });

      const agent = createMyAgent(mockModel);

      await expect(
        agent.generate({ prompt: "Test" })
      ).rejects.toThrow("Model error");
    });
  });
});
```

### `tools.test.ts` - Test Pure Functions

**Purpose:** Test utility functions, data parsing, and tool implementations

```typescript
import { describe, expect, it } from "vitest";
import { myUtilityFunction, myTool } from "./tools";

describe("My Agent Tools", () => {
  describe("myUtilityFunction", () => {
    it("should parse input correctly", () => {
      const result = myUtilityFunction("input data");
      
      expect(result).toBeDefined();
      expect(result.parsed).toEqual(["expected", "values"]);
    });

    it("should handle edge cases", () => {
      expect(() => myUtilityFunction("")).toThrow();
      expect(myUtilityFunction(null)).toEqual({ parsed: [] });
    });
  });

  describe("myTool", () => {
    it("should execute with valid input", async () => {
      const result = await myTool.execute({ param: "value" });
      
      expect(result).toBeDefined();
      expect(result.output).toBe("expected");
    });

    it("should validate input schema", async () => {
      await expect(
        myTool.execute({ param: 123 }) // Wrong type
      ).rejects.toThrow();
    });
  });
});
```

---

## Common Patterns

### ✅ DO: Mock Models with MockLanguageModelV3

```typescript
import { MockLanguageModelV3 } from "ai/test";

const mockModel = new MockLanguageModelV3({
  doGenerate: async () => ({
    finishReason: "stop",
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    content: [{ type: "text", text: "Mocked response" }],
    warnings: [],
  }),
});

const agent = createMyAgent(mockModel);
```

### ✅ DO: Test Tools Directly

```typescript
// Don't involve the agent at all
it("should parse data format", () => {
  const result = parseData("A:10 B:20");
  expect(result).toEqual({ labels: ["A", "B"], values: [10, 20] });
});
```

### ✅ DO: Test Public Behavior

```typescript
it("should create agent successfully", () => {
  const agent = createMyAgent(mockModel);
  expect(agent).toBeDefined();
  expect(agent).toBeInstanceOf(ToolLoopAgent);
});
```

### ✅ DO: Use Descriptive Test Names

```typescript
// ✅ Good: Describes behavior
it("should parse colon-separated data format")
it("should handle empty input gracefully")
it("should throw error for invalid schema")

// ❌ Bad: Vague or implementation-focused
it("should work")
it("test parsing")
it("checks the function")
```

---

## Common Anti-Patterns

### ❌ DON'T: Make Real API Calls

```typescript
// ❌ BAD: Real API call in test
it("should generate response", async () => {
  const agent = new ToolLoopAgent({
    model: openai("gpt-4"), // Real API!
    tools: {},
  });
  
  const result = await agent.generate({prompt: "test"});
  // This is slow, costs money, and unreliable
});

// ✅ GOOD: Mocked model
it("should generate response", async () => {
  const mockModel = new MockLanguageModelV3({...});
  const agent = createMyAgent(mockModel);
  const result = await agent.generate({prompt: "test"});
});
```

### ❌ DON'T: Test Private Properties

```typescript
// ❌ BAD: Testing implementation details
it("should have correct model", () => {
  const agent = createMyAgent(mockModel);
  expect(agent.model).toBe(mockModel); // Private property!
  expect(agent.instructions).toBeDefined(); // Private property!
});

// ✅ GOOD: Test behavior
it("should create agent successfully", () => {
  const agent = createMyAgent(mockModel);
  expect(agent).toBeDefined();
  expect(agent).toBeInstanceOf(ToolLoopAgent);
});
```

### ❌ DON'T: Use Type Casting

**`as any` and `as unknown as` are highly discouraged.**

```typescript
// ❌ BAD: Hiding type errors with casting
for await (const chunk of result.fullStream) {
  if (chunk.type === "text-delta") {
    text += (chunk as { delta: string }).delta; // Type cast!
  }
}

// ❌ BAD: Using `as any` to bypass type checking
const executor = createA2AExecutor(config, { modelId: "test" } as any, mockEnv);

// ❌ BAD: Using `as unknown as` for complex casts
const workflow = vi.fn() as unknown as DurableWorkflowFn;

// ✅ GOOD: Use proper mock types from AI SDK
import { MockLanguageModelV3 } from "ai/test";
const mockModel = new MockLanguageModelV3();
const executor = createA2AExecutor(config, mockModel, mockEnv);

// ✅ GOOD: Use the public API
const result = await agent.stream({prompt: "test"});
const text = await result.text; // Use Promise directly
expect(typeof text).toBe("string");

// ✅ GOOD: Use vi.mocked() for type-safe mock assertions
vi.mocked(mockStart).mockResolvedValue(createMockRun());
```

### ❌ DON'T: Mix Concerns in One File

```typescript
// ❌ BAD: Everything in index.test.ts
describe("My Agent", () => {
  it("should create agent");
  it("should parse data");
  it("should call API");
  it("should handle A2A protocol");
  it("should test adapter");
  // 50 more mixed tests...
});

// ✅ GOOD: Separate by concern
// agent.test.ts - Agent behavior (10 tests, 40ms)
// tools.test.ts - Tool functions (21 tests, 330ms)
// No need to test index.ts (it's the server)
```

### ❌ DON'T: Test Adapter Integration

```typescript
// ❌ BAD: Testing adapter in agent tests
it("should work with A2AAdapter", async () => {
  const adapter = new A2AAdapter(agent, {...});
  // Adapter integration uses execute(requestContext, eventBus)
  // and publishes A2A events to the event bus. This belongs in adapter tests.
  // This belongs in adapter tests!
});

// ✅ GOOD: Test adapter separately
// The adapter has its own test file:
// packages/a2a-ai-sdk-adapter/src/adapter.test.ts
```

---

## AI SDK v6 Specifics

### Tool Definitions

```typescript
// ✅ AI SDK v6: Use inputSchema (Zod)
import { z } from "zod";

const myTool = {
  description: "Tool description",
  inputSchema: z.object({
    param: z.string(),
    count: z.number().optional(),
  }),
  execute: async (input) => {
    return { result: input.param };
  },
};

// ❌ OLD: Don't use parameters (deprecated)
const myTool = {
  description: "Tool description",
  parameters: { // Old pattern
    type: "object",
    properties: { param: { type: "string" } },
  },
};
```

### Model Mocking

```typescript
// ✅ AI SDK v6: MockLanguageModelV3
import { MockLanguageModelV3 } from "ai/test";

const mockModel = new MockLanguageModelV3({...});

// ❌ OLD: Don't use V2 or V1
import { MockLanguageModelV2 } from "ai/test"; // Doesn't exist in v6
```

### Stream Testing

```typescript
// ✅ Use simulateReadableStream
import { simulateReadableStream } from "ai";

const stream = simulateReadableStream({
  chunks: [
    { type: "text-delta", id: "1", delta: "text" },
  ],
});

// ✅ Use result.text Promise
const text = await result.text;

// ❌ DON'T: Manually iterate chunks
for await (const chunk of result.fullStream) { ... }
```

---

## Test Performance Guidelines

### Target Metrics

| Metric | Target | Example |
|--------|--------|---------|
| **Per test file** | < 1 second | analytics agent: 782ms |
| **Test collection** | < 200ms | Transform + imports |
| **Individual test** | < 50ms | Most agent tests |
| **Tool tests** | < 5ms | Pure function tests |

### Performance Tips

```typescript
// ✅ Fast: Mock everything
const mockModel = new MockLanguageModelV3({...}); // Instant

// ❌ Slow: Real API calls
const model = openai("gpt-4"); // 2-30 seconds per call

// ✅ Fast: Test pure functions
const result = parseData("input"); // < 1ms

// ❌ Slow: Integration tests in unit tests
await startServer(); // Don't do this
```

---

## Example Test Files

### Reference Implementations

**Best Example:** [analytics-agent](src/agents/analytics-agent/)
```
✓ agent.test.ts (10 tests) 38ms
✓ tools.test.ts (21 tests) 329ms
Total: 31 tests, 782ms
```

**Structure:**
- `agent.ts` - Creates the ToolLoopAgent
- `agent.test.ts` - Tests agent with MockLanguageModelV3
- `tools.ts` - Utility functions (parseData, generateChart)
- `tools.test.ts` - Tests tools directly without agent
- `index.ts` - A2A server setup (not unit tested)

### Files to Reference

1. **Test utilities:** `src/test-utils/agent-test-helpers.ts`
2. **Adapter tests:** `../../packages/a2a-ai-sdk-adapter/src/adapter.test.ts`
3. **Example agent tests:** `src/agents/analytics-agent/agent.test.ts` and `tools.test.ts`

---

## Running Tests

```bash
# Run all agent tests
pnpm test

# Run specific agent
pnpm test src/agents/analytics-agent/

# Run specific file
pnpm test src/agents/analytics-agent/agent.test.ts

# Watch mode for development
pnpm test:watch

# With coverage
pnpm test:coverage
```

---

## Checklist for New Agent Tests

Before creating tests for a new agent:

- [ ] Create separate `agent.test.ts` and `tools.test.ts` files
- [ ] Use `MockLanguageModelV3` from `ai/test`
- [ ] Test tools directly without involving the agent
- [ ] Avoid testing private properties (model, instructions)
- [ ] No type casting (`as any` or `as unknown as`)
- [ ] All tests run in < 1 second
- [ ] No real API calls or API keys required
- [ ] Use descriptive test names (behavior, not implementation)
- [ ] Follow the analytics agent pattern
- [ ] Tests pass with `pnpm test`
- [ ] No TypeScript errors with `pnpm typecheck`
- [ ] Test file is shorter than source file (ratio < 1.0x)

---

## Test File Verbosity

**Rule:** Test files should NOT be longer than the files they test.

**Target Ratio:** Test lines / Source lines < 1.0x

If your test file is longer than the source file, it's likely:
- Testing too many edge cases that don't add value
- Duplicating test setup code
- Testing implementation details instead of behavior

**Consolidation Strategies:**
- Group related assertions in single test cases
- Use `it.each()` for parameterized tests
- Extract common setup into fixtures
- Test multiple scenarios per test when logically related

---

## Summary

**Key Principles:**
1. 🎯 Test your logic, not the AI SDK
2. ⚡ Keep tests fast (< 1s per file)
3. 📂 Separate concerns (agent vs tools)
4. 🚫 No real API calls
5. ✅ Use AI SDK test utilities
6. 🎭 Test behavior, not implementation
7. 📝 Clear, descriptive test names
8. 🔒 Type-safe (no `as any` or `as unknown as` casts)
9. 📏 Keep tests lean (test lines < source lines)

**Result:** Fast, reliable, maintainable tests that provide confidence without slowing down development.

**Questions?** See the [Analytics Agent tests](src/agents/analytics-agent/) for detailed examples of applying these principles.

