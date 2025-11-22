# Agent Testing Guide

This document describes the testing strategy for A2A agents in this repository.

> 📖 **NEW: [Agent Test Principles](AGENT_TEST_PRINCIPLES.md)** - Read this first! Comprehensive guide to writing consistent, fast, reliable agent tests.

## Testing Framework

- **Test Runner**: Vitest 3.x
- **Test Location**: `src/agents/*/agent.test.ts` and `src/agents/*/tools.test.ts`
- **Test Utilities**: `src/test-utils/agent-test-helpers.ts`
- **Reference Implementation**: [analytics-agent](src/agents/analytics-agent/)

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage

# Run specific test file
pnpm test src/agents/hello-world/index.test.ts
```

## Test Structure

Each agent has its own test file that verifies:

1. **Agent Card Validation**: Ensures the agent card has all required A2A protocol fields
2. **Adapter Configuration**: Verifies the A2AAdapter is properly configured
3. **Tool Availability**: Checks that all expected tools are available
4. **Agent Functionality**: Tests actual agent responses with sample queries

## Writing Tests

### Basic Test Template

```typescript
import { describe, expect, it } from "vitest";
import { openai } from "@ai-sdk/openai";
import { ToolLoopAgent } from "ai";
import { A2AAdapter } from "@drew-foxall/a2a-ai-sdk-adapter";
import type { AgentCard } from "@drew-foxall/a2a-js-sdk";
import { createAgentTestSuite, createTestAgentCard } from "../../test-utils/agent-test-helpers";

const agentName = "My Agent";
const agentDescription = "A description of my agent";

function createMyAgent(): {
  adapter: A2AAdapter;
  agentCard: AgentCard;
} {
  const agent = new ToolLoopAgent({
    model: openai(process.env.MODEL_NAME || "gpt-4o-mini"),
    instructions: "Your instructions here",
    tools: {
      // Your tools here
    },
  });

  const adapter = new A2AAdapter(agent, {
    mode: "generate", // or "stream"
  });

  const agentCard = createTestAgentCard({
    name: agentName,
    description: agentDescription,
  });

  return { adapter, agentCard };
}

createAgentTestSuite("My Agent", {
  getAdapter: () => createMyAgent().adapter,
  getAgentCard: () => createMyAgent().agentCard,
  testCases: [
    {
      name: "should handle basic queries",
      message: "Test query",
      expectedPattern: /expected response pattern/i,
    },
  ],
  expectedTools: ["tool1", "tool2"],
});
```

### Testing Streaming Agents

For agents that use `mode: "stream"`, test the streaming functionality:

```typescript
it("should stream responses", async () => {
  const { adapter } = createMyAgent();
  const message = {
    role: "user",
    parts: [{ kind: "text", text: "Generate code" }],
  };

  const stream = await adapter.handleMessageStream(message, {});
  const chunks: string[] = [];
  const reader = stream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  expect(chunks.length).toBeGreaterThan(0);
}, 30000);
```

### Testing Artifacts

For agents that generate artifacts (images, files, etc.):

```typescript
import { validateArtifacts } from "../../test-utils/agent-test-helpers";

it("should generate PNG artifacts", async () => {
  const { adapter } = createMyAgent();
  const response = await adapter.handleMessage(message, {});

  validateArtifacts(response.message.parts, "image/png");
});
```

### Testing Tools Directly

Test tools independently of the agent:

```typescript
import { myTool } from "./tools";

it("should execute tool correctly", async () => {
  const result = await myTool.execute({ param: "value" });

  expect(result).toBeDefined();
  expect(result.output).toBe("expected");
});
```

## Test Utilities

### `createTestAgentCard(config)`

Creates a basic agent card for testing:

```typescript
const agentCard = createTestAgentCard({
  name: "My Agent",
  description: "Description",
  version: "1.0.0", // optional
});
```

### `createAgentTestSuite(name, config)`

Creates a standard test suite with common tests:

```typescript
createAgentTestSuite("My Agent", {
  getAdapter: () => adapter,
  getAgentCard: () => agentCard,
  testCases: [
    {
      name: "test name",
      message: "user message",
      expectedPattern: /pattern/i,
      expectArtifacts: true, // optional
      artifactMimeType: "image/png", // optional
    },
  ],
  expectedTools: ["tool1", "tool2"], // optional
});
```

### `validateAgentCard(agentCard)`

Validates that an agent card has all required A2A protocol fields.

### `validateArtifacts(parts, mimeType?)`

Validates that response parts contain artifacts, optionally matching a specific MIME type.

## Environment Variables

Some tests require API keys:

```bash
# Required for most agents
OPENAI_API_KEY=sk-...

# Required for movie agent tests
TMDB_API_KEY=...

# Required for GitHub agent tests (optional, uses public API)
GITHUB_TOKEN=...
```

## Test Configuration

### Vitest Config (`vitest.config.ts`)

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 30000, // 30s for LLM calls
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true, // Avoid API rate limits
      },
    },
  },
});
```

## Best Practices

1. **Use descriptive test names**: "should handle weather queries for multiple cities"
2. **Test edge cases**: Empty inputs, invalid data, API failures
3. **Mock external APIs when possible**: Use test data instead of real API calls
4. **Set appropriate timeouts**: LLM calls can take 15-30 seconds
5. **Keep tests focused**: One concept per test
6. **Use shared utilities**: Leverage `agent-test-helpers.ts` for common patterns

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Main branch commits
- Manual workflow dispatch

### GitHub Actions Example

```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm build
      - run: pnpm test
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

## Troubleshooting

### Tests timing out

Increase the timeout in individual tests:

```typescript
it("slow test", async () => {
  // test code
}, 60000); // 60 seconds
```

### API rate limits

Run tests sequentially:

```bash
# In vitest.config.ts
poolOptions: {
  forks: {
    singleFork: true,
  },
}
```

### Mock API responses

For external APIs, consider mocking:

```typescript
import { vi } from "vitest";

vi.mock("./api.js", () => ({
  fetchData: vi.fn(() => Promise.resolve({ data: "mock" })),
}));
```

## Coverage

Generate coverage reports:

```bash
pnpm test:coverage
```

View HTML report in `coverage/index.html`.

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [AI SDK Testing Guide](https://sdk.vercel.ai/docs/ai-sdk-core/testing)
- [A2A Protocol Specification](https://a2a.plus/docs)

