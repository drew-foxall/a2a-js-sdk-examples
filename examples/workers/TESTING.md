# Worker E2E Testing Guide

This guide explains the hybrid testing approach for A2A workers, combining AI SDK mocks with network-level mocking for comprehensive coverage without real AI API calls.

## Testing Philosophy

```
                    ╱╲
                   ╱  ╲
                  ╱ E2E╲         ← Real AI calls (optional, CI smoke tests)
                 ╱ Smoke╲
                ╱────────╲
               ╱          ╲
              ╱  Network   ╲     ← MSW intercepts HTTP to AI providers
             ╱   Mocked     ╲
            ╱────────────────╲
           ╱                  ╲
          ╱    AI SDK Mocks    ╲  ← MockLanguageModelV3 replaces model
         ╱  (Unit/Integration)  ╲
        ╱────────────────────────╲
```

### Three Testing Layers

| Layer | Speed | What It Tests | When to Use |
|-------|-------|---------------|-------------|
| **AI SDK Mocks** | ⚡ Fastest | Agent logic, A2A protocol | Unit tests, CI |
| **Network Mocks** | ⚡ Fast | Full HTTP stack, provider code | Integration tests |
| **Real AI Calls** | 🐢 Slow | End-to-end validation | Smoke tests only |

---

## Quick Start

### 1. Add Test Dependencies

```bash
# In your worker directory
pnpm add -D vitest msw
```

### 2. Create Test Files

```
your-worker/
├── src/
│   └── index.ts
├── test/
│   ├── worker.test.ts      # AI SDK mocks (fast)
│   └── worker.e2e.test.ts  # Network mocks (MSW)
├── vitest.config.ts
└── vitest.e2e.config.ts
```

### 3. Run Tests

```bash
# Unit/integration tests (AI SDK mocks)
pnpm test

# E2E tests (network mocks)
pnpm test:e2e
```

---

## Layer 1: AI SDK Mocks

Uses `MockLanguageModelV3` from `ai/test` to replace the language model entirely. No network calls are made.

### Using the Test Suite Factory

```typescript
// test/worker.test.ts
import { createWorkerTestSuite } from "a2a-workers-shared/worker-test-suite";
import app from "../src/index";

createWorkerTestSuite("My Agent", () => app, {
  expectedAgentName: "My Agent",
  expectedSkillCount: 2,
  mockResponse: "This is the mocked AI response",
  streaming: true,
  sampleMessage: "Hello!",
  expectedResponsePattern: /hello|response/i,
});
```

### Manual Mock Model Usage

```typescript
// test/worker.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createMockModel,
  createMockEnv,
  createMessageSendRequest,
  setTestModel,
} from "a2a-workers-shared/test-utils";
import app from "../src/index";

describe("My Agent Worker", () => {
  beforeAll(() => {
    setTestModel(createMockModel({
      response: "Mocked response",
      streaming: true,
    }));
  });

  afterAll(() => {
    setTestModel(null);
  });

  it("should handle messages", async () => {
    const env = createMockEnv();
    const request = createMessageSendRequest("Hello!");
    const response = await app.fetch(request, env);

    expect(response.status).toBe(200);
  });
});
```

### Mock Model Options

```typescript
createMockModel({
  // Text response to return
  response: "Hello from the mock!",

  // Simulate streaming mode
  streaming: true,

  // Simulate tool calls
  toolCalls: [
    { id: "call-1", name: "rollDice", args: { sides: 6 } },
  ],

  // Custom token usage
  usage: { inputTokens: 50, outputTokens: 100 },

  // Simulate an error
  error: new Error("API error"),

  // Add latency (for timeout testing)
  delay: 1000,
});
```

---

## Layer 2: Network Mocks (MSW)

Uses [MSW (Mock Service Worker)](https://mswjs.io/) to intercept HTTP requests to AI providers. This tests the actual AI SDK provider code without real API calls.

### Basic Setup

```typescript
// test/worker.e2e.test.ts
import { setupServer } from "msw/node";
import { beforeAll, afterAll, afterEach, describe, it, expect } from "vitest";
import { createOpenAIHandlers } from "a2a-workers-shared/msw-handlers";
import { createMockEnv, createMessageSendRequest } from "a2a-workers-shared/test-utils";
import app from "../src/index";

const server = setupServer(
  ...createOpenAIHandlers({
    defaultResponse: "Hello from the mocked OpenAI!",
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("My Agent E2E", () => {
  it("should handle messages via OpenAI", async () => {
    const env = createMockEnv();
    const request = createMessageSendRequest("Hello!");
    const response = await app.fetch(request, env);

    expect(response.status).toBe(200);
  });
});
```

### Custom Response Mapping

```typescript
const server = setupServer(
  ...createOpenAIHandlers({
    defaultResponse: "Default response",
    responseMap: {
      // Pattern matching (case-insensitive, partial match)
      "roll a die": "I rolled a 6!",
      "weather": "It's sunny and 72°F",
      "hello": "Hello there! How can I help?",
    },
  })
);
```

### Multiple Providers

```typescript
import {
  createOpenAIHandlers,
  createAnthropicHandlers,
  createGoogleAIHandlers,
  createAllAIHandlers,
} from "a2a-workers-shared/msw-handlers";

// All providers with same config
const server = setupServer(
  ...createAllAIHandlers({
    defaultResponse: "Hello from any AI!",
  })
);

// Or specific providers
const server = setupServer(
  ...createOpenAIHandlers({ defaultResponse: "Hello from OpenAI!" }),
  ...createAnthropicHandlers({ defaultResponse: "Hello from Claude!" }),
);
```

### Scenario Testing

```typescript
import { scenarioHandlers } from "a2a-workers-shared/msw-handlers";

describe("Error Scenarios", () => {
  it("should handle rate limiting", async () => {
    server.use(...scenarioHandlers.rateLimited());

    const response = await app.fetch(request, env);
    // Assert error handling
  });

  it("should handle auth errors", async () => {
    server.use(...scenarioHandlers.unauthorized());
    // ...
  });

  it("should handle slow responses", async () => {
    server.use(...scenarioHandlers.slowResponse(5000));
    // ...
  });
});
```

---

## Layer 3: Real AI Calls (Smoke Tests)

For final validation, run a small set of tests against real AI APIs. These should be:
- **Few in number** (1-3 per worker)
- **Run only in CI** (not local development)
- **Skipped if API key not available**

```typescript
// test/smoke.test.ts
import { describe, it, expect } from "vitest";

const SKIP_SMOKE = !process.env.OPENAI_API_KEY || process.env.CI !== "true";

describe.skipIf(SKIP_SMOKE)("Smoke Tests", () => {
  it("should work with real OpenAI", async () => {
    const env = {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      AI_PROVIDER: "openai",
      AI_MODEL: "gpt-4o-mini",
    };

    const response = await app.fetch(createMessageSendRequest("Say hello"), env);
    expect(response.status).toBe(200);
  }, 30000); // Long timeout for real API
});
```

---

## Test Utilities Reference

### Request Builders

```typescript
import {
  createA2ARequest,
  createMessageSendRequest,
  createTasksGetRequest,
  createTasksCancelRequest,
  createAgentCardRequest,
  createHealthCheckRequest,
} from "a2a-workers-shared/test-utils";

// Generic A2A request
createA2ARequest("message/send", { message: {...} });

// Message send with options
createMessageSendRequest("Hello!", {
  messageId: "msg-123",
  contextId: "ctx-456",
  taskId: "task-789",
});

// Other endpoints
createAgentCardRequest();
createHealthCheckRequest();
createTasksGetRequest("task-id");
createTasksCancelRequest("task-id");
```

### Response Helpers

```typescript
import {
  parseA2AResponse,
  extractTextFromResponse,
  assertA2ASuccess,
  assertA2AError,
} from "a2a-workers-shared/test-utils";

// Parse JSON-RPC response
const result = await parseA2AResponse<{ id: string; status: string }>(response);

// Extract text from response
const text = extractTextFromResponse(result);

// Assertions
await assertA2ASuccess(response);
await assertA2AError(response, -32600); // Invalid Request
```

### Environment Helpers

```typescript
import { createMockEnv } from "a2a-workers-shared/test-utils";

// Default (OpenAI)
const env = createMockEnv();

// Anthropic
const env = createMockEnv({
  provider: "anthropic",
  model: "claude-3-5-sonnet-20241022",
});

// With extras
const env = createMockEnv({
  extras: {
    GITHUB_TOKEN: "test-token",
    CUSTOM_VAR: "value",
  },
});
```

---

## Vitest Configuration

### Unit Tests (vitest.config.ts)

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"],
    exclude: ["test/**/*.e2e.test.ts"],
    testTimeout: 10000,
  },
});
```

### E2E Tests (vitest.e2e.config.ts)

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.e2e.test.ts"],
    testTimeout: 30000,
    // Run sequentially to avoid port conflicts
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Worker Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"

      - run: pnpm install

      # Unit tests (no API keys needed)
      - name: Run unit tests
        run: pnpm --filter "./examples/workers/*" test

      # E2E tests with network mocks (no API keys needed)
      - name: Run E2E tests
        run: pnpm --filter "./examples/workers/*" test:e2e

      # Optional: Smoke tests with real AI (requires secrets)
      - name: Run smoke tests
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        run: pnpm --filter "./examples/workers/*" test:smoke
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          CI: true
```

---

## Best Practices

### 1. Test Behavior, Not Implementation

```typescript
// ✅ Good: Test observable behavior
it("should return greeting response", async () => {
  const response = await app.fetch(createMessageSendRequest("Hello!"), env);
  const result = await parseA2AResponse(response);
  expect(result.result?.status).toBeDefined();
});

// ❌ Bad: Test internal implementation
it("should call OpenAI with correct parameters", async () => {
  // Don't test internal API calls
});
```

### 2. Use Descriptive Test Names

```typescript
// ✅ Good
it("should return 404 for unknown endpoints");
it("should include CORS headers on responses");
it("should handle rate limiting gracefully");

// ❌ Bad
it("test 1");
it("works");
it("should work");
```

### 3. Keep Tests Fast

```typescript
// ✅ Good: Use mocks for speed
const model = createMockModel({ response: "Fast!" });

// ❌ Bad: Real API calls in unit tests
const model = openai("gpt-4"); // Slow, costs money
```

### 4. Test Error Cases

```typescript
describe("Error Handling", () => {
  it("should handle invalid JSON-RPC");
  it("should handle missing required fields");
  it("should handle API errors gracefully");
  it("should return proper error codes");
});
```

### 5. Isolate Tests

```typescript
// ✅ Good: Each test is independent
beforeEach(() => {
  server.resetHandlers();
});

// ❌ Bad: Tests depend on each other
let sharedTaskId; // Don't share state between tests
```

---

## Troubleshooting

### Tests Hang or Timeout

- Check if MSW server is properly closed in `afterAll`
- Ensure `onUnhandledRequest: "bypass"` is set for non-AI requests
- Increase timeout for slow operations

### Mock Not Working

- Verify the mock model is set before tests run
- Check that `setTestModel(null)` is called in `afterAll`
- Ensure MSW handlers match the actual API URLs

### Port Conflicts

- Use `singleFork: true` in vitest config
- Don't run multiple test suites in parallel

### Type Errors

- Import types from `a2a-workers-shared/test-utils`
- Use `parseA2AResponse<T>` with proper type parameter

---

## Reference Implementation

See the `hello-world` worker for a complete example:

```
examples/workers/hello-world/
├── src/
│   └── index.ts
├── test/
│   ├── worker.test.ts      # AI SDK mocks
│   └── worker.e2e.test.ts  # Network mocks
├── vitest.config.ts
├── vitest.e2e.config.ts
└── package.json
```

---

## Related Documentation

- [AI SDK Testing Guide](https://ai-sdk.dev/docs/ai-sdk-core/testing)
- [MSW Documentation](https://mswjs.io/docs)
- [Vitest Documentation](https://vitest.dev/)
- [Agent Test Principles](../agents/AGENT_TEST_PRINCIPLES.md)

