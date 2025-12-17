# CLAUDE.md - AI Assistant Context for a2a-js-sdk-examples

This file provides essential context for AI assistants (Claude, Cursor, Copilot) working on this codebase.

## ⚠️ Critical: SDK Versions

### Vercel AI SDK - Version 6 (Beta)

**This project uses AI SDK v6, NOT v4 or earlier.**

```json
{
  "ai": "6.0.0-beta.99",
  "@ai-sdk/openai": "3.0.0-beta.61",
  "@ai-sdk/anthropic": "3.0.0-beta.54",
  "@ai-sdk/google": "3.0.0-beta.48"
}
```

### ToolLoopAgent API

The `ToolLoopAgent` class API changed significantly in v6:

| Method | v4 (OLD) | v6 (CURRENT) |
|--------|----------|--------------|
| Non-streaming | N/A | `agent.generate({ prompt })` |
| Streaming | N/A | `agent.stream({ prompt })` |

**Methods that DO NOT exist:**
- ❌ `agent.run()` - Does not exist
- ❌ `agent.execute()` - Does not exist
- ❌ `agent.invoke()` - Does not exist

**Correct usage:**

```typescript
import { ToolLoopAgent } from "ai";

const agent = new ToolLoopAgent({ model, instructions, tools });

// Non-streaming
const result = await agent.generate({ prompt: "Hello" });
console.log(result.text);

// Streaming
const stream = await agent.stream({ prompt: "Hello" });
for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}
```

### Tool Definition Pattern

Tools must have explicit types on execute functions:

```typescript
import { z } from "zod";

const mySchema = z.object({
  query: z.string().describe("Search query"),
});

const tools = {
  search: {
    description: "Search for information",
    inputSchema: mySchema,
    // ✅ Explicit type annotation required
    execute: async (params: z.infer<typeof mySchema>) => {
      return { results: [] };
    },
  },
};
```

## A2A Protocol SDK

### @drew-foxall/a2a-js-sdk (v0.4.2)

Key types and their correct usage:

#### RequestContext

`RequestContext` is a **class**, not an interface:

```typescript
// ✅ Correct
import { RequestContext } from "@drew-foxall/a2a-js-sdk/server";
const ctx = new RequestContext(userMessage, taskId, contextId, task);

// ❌ Wrong - plain object
const ctx = { userMessage, taskId, contextId };
```

#### ExecutionEventBus

Uses **EventEmitter pattern**, not subscribe/unsubscribe:

```typescript
// ✅ Correct
eventBus.on("event", handler);
eventBus.off("event", handler);
eventBus.once("event", handler);
eventBus.removeAllListeners();
eventBus.finished();

// ❌ Wrong - these don't exist
eventBus.subscribe(handler);
eventBus.unsubscribe(handler);
```

## Workflow DevKit

### workflow (v4.0.1-beta.24)

The `Run` class from `workflow/api`:

```typescript
interface Run<T> {
  runId: string;
  returnValue: Promise<T>;
  // ... other properties
}
```

## Project Architecture

```
a2a-js-sdk-examples/
├── packages/                    # Published npm packages
│   ├── a2a-ai-sdk-adapter/     # Bridges AI SDK with A2A
│   └── a2a-ai-provider-v3/     # A2A as AI SDK provider
├── examples/
│   ├── agents/                  # Agent implementations (Node.js)
│   │   └── src/agents/*/       # Individual agents
│   ├── workers/                 # Cloudflare Workers
│   │   ├── shared/             # Shared worker utilities
│   │   └── */                  # Individual workers
│   └── vercel/                  # Vercel deployments
└── scripts/                     # Development scripts
```

## TypeScript Configuration

### Workers

Workers use special tsconfig for Cloudflare compatibility:

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "types": ["@cloudflare/workers-types", "node"]
  }
}
```

The `node` types are needed because workspace packages (`a2a-agents`, `a2a-workers-shared`) use Node.js types internally.

### Strict Mode

All packages use strict TypeScript. Common issues:

1. **Array access** - Use non-null assertion or check: `arr[0]!` or `if (arr[0])`
2. **Optional properties** - Check before access: `obj.prop?.nested`
3. **Implicit any** - Always provide explicit types for function parameters

## Testing Patterns

### Mocking SDK Types

When mocking SDK types in tests, ensure mocks match actual interfaces:

```typescript
// ✅ Correct mock for ExecutionEventBus
const mockBus = {
  publish: vi.fn(),
  on: vi.fn().mockReturnThis(),
  off: vi.fn().mockReturnThis(),
  once: vi.fn().mockReturnThis(),
  removeAllListeners: vi.fn().mockReturnThis(),
  finished: vi.fn(),
};

// ✅ Correct mock for RequestContext
const mockContext = new RequestContext(
  userMessage,
  "task-123",
  "context-123",
  task
);
```

## Commands

```bash
# Type check all packages
pnpm run typecheck

# Run tests
pnpm run test

# Lint and fix
pnpm run lint:fix

# Start a worker locally
pnpm worker:dice
```

## Common Pitfalls

1. **AI SDK v6 API** - Don't assume v4 methods exist
2. **RequestContext** - It's a class, instantiate with `new`
3. **EventBus** - Uses `on/off`, not `subscribe/unsubscribe`
4. **Tool types** - Always use `z.infer<typeof schema>` for execute params
5. **Worker types** - Need both Cloudflare and Node types
6. **Array access** - TypeScript strict mode requires null checks

## Related Documentation

- [AI SDK v6 Docs](https://sdk.vercel.ai/docs)
- [A2A Protocol Spec](https://a2a-protocol.org/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)

