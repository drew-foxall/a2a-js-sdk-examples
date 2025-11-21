# A2A Integration Pattern Guide

This document describes the **correct** pattern for integrating AI SDK agents with the A2A protocol using the `@drew-foxall/a2a-js-sdk`.

## ⚠️ Common Pitfall: Wrong Import Path

**DON'T DO THIS** ❌:

```typescript
// WRONG - This path doesn't exist!
import { A2AHonoApp } from "@drew-foxall/a2a-js-sdk/hono";
```

**DO THIS INSTEAD** ✅:

```typescript
// CORRECT - Server components are in /server path
import { A2AHonoApp } from "@drew-foxall/a2a-js-sdk/server/hono";
```

## The Correct Pattern

### 1. Imports

```typescript
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { AgentCard, AgentSkill } from "@drew-foxall/a2a-js-sdk";
import {
  InMemoryTaskStore,
  TaskStore,
  AgentExecutor,
  DefaultRequestHandler,
} from "@drew-foxall/a2a-js-sdk/server";
import { A2AHonoApp } from "@drew-foxall/a2a-js-sdk/server/hono";
import { A2AAdapter } from "../../shared/a2a-adapter.js";
```

**Key Points:**
- `AgentCard`, `AgentSkill` come from the main package
- Server components (`DefaultRequestHandler`, `InMemoryTaskStore`, etc.) come from `/server`
- `A2AHonoApp` comes from `/server/hono` (NOT just `/hono`)

### 2. AgentCard Definition

```typescript
const agentCard: AgentCard = {
  name: "Your Agent Name",
  description: "Your agent description",
  url: `${BASE_URL}/.well-known/agent-card.json`,
  protocolVersion: "0.3.0",  // REQUIRED field
  version: "1.0.0",
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
  capabilities: {
    // Plain object (NOT new AgentCapabilities())
    streaming: true,
    pushNotifications: false,
    stateTransitionHistory: true,
  },
  skills: [yourSkill],
};
```

**Key Points:**
- `protocolVersion` is **required** (set to `"0.3.0"`)
- `capabilities` is a **plain object**, not `new AgentCapabilities()`
- Don't include `statefulness` in capabilities (not a valid field)

### 3. A2AAdapter (Agent Executor)

```typescript
// Create your AI SDK agent
const model = getModel();
const agent = createYourAgent(model);

// A2AAdapter IS the AgentExecutor - don't call createAgentExecutor()
const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
  workingMessage: "Processing...",
  includeHistory: true,
  debug: false,
});
```

**Key Points:**
- `A2AAdapter` **directly implements** `AgentExecutor`
- First parameter is the `agent` (ToolLoopAgent), second is optional config
- **WRONG**: `new A2AAdapter({ agent, agentCard })` - this signature doesn't exist!
- **WRONG**: `adapter.createAgentExecutor()` - this method doesn't exist!

### 4. Server Setup (Inside `main()` function)

```typescript
async function main() {
  // 1. Create task store
  const taskStore: TaskStore = new InMemoryTaskStore();

  // 2. Create request handler (combines agentCard, taskStore, executor)
  const requestHandler = new DefaultRequestHandler(
    agentCard,
    taskStore,
    agentExecutor
  );

  // 3. Create Hono app and set up A2A routes
  const app = new Hono();
  const appBuilder = new A2AHonoApp(requestHandler);
  appBuilder.setupRoutes(app);

  // 4. Start server
  serve({
    fetch: app.fetch,  // Use app.fetch (NOT appBuilder.fetch)
    port: PORT,
    hostname: HOST,
  });
}

main().catch(console.error);
```

**Key Points:**
- **WRONG**: `new A2AHonoApp({ agentCard, agentExecutor })` - this signature doesn't exist!
- **CORRECT**: `new A2AHonoApp(requestHandler)` - takes a single `DefaultRequestHandler`
- Call `appBuilder.setupRoutes(app)` to register A2A endpoints
- Use `app.fetch` in `serve()`, not `appBuilder.fetch`

## Complete Example

See [`examples/agents/src/agents/movie-agent/index.ts`](./examples/agents/src/agents/movie-agent/index.ts) for a working reference implementation.

```typescript
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { AgentCard, AgentSkill } from "@drew-foxall/a2a-js-sdk";
import {
  InMemoryTaskStore,
  TaskStore,
  AgentExecutor,
  DefaultRequestHandler,
} from "@drew-foxall/a2a-js-sdk/server";
import { A2AHonoApp } from "@drew-foxall/a2a-js-sdk/server/hono";
import { A2AAdapter } from "../../shared/a2a-adapter.js";
import { createYourAgent } from "./agent.js";
import { getModel } from "../../shared/utils.js";

const PORT = 41240;
const HOST = "0.0.0.0";
const BASE_URL = `http://localhost:${PORT}`;

const yourSkill: AgentSkill = {
  id: "your_skill",
  name: "Your Skill",
  description: "What your agent does",
  tags: ["tag1", "tag2"],
  examples: ["example 1", "example 2"],
};

const agentCard: AgentCard = {
  name: "Your Agent",
  description: "Your agent description",
  url: `${BASE_URL}/.well-known/agent-card.json`,
  protocolVersion: "0.3.0",
  version: "1.0.0",
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
  capabilities: {
    streaming: true,
    pushNotifications: false,
    stateTransitionHistory: true,
  },
  skills: [yourSkill],
};

const model = getModel();
const agent = createYourAgent(model);

const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
  workingMessage: "Processing...",
  includeHistory: true,
  debug: false,
});

async function main() {
  const taskStore: TaskStore = new InMemoryTaskStore();

  const requestHandler = new DefaultRequestHandler(
    agentCard,
    taskStore,
    agentExecutor
  );

  const app = new Hono();
  const appBuilder = new A2AHonoApp(requestHandler);
  appBuilder.setupRoutes(app);

  console.log(`🚀 Your Agent running on ${BASE_URL}`);

  serve({
    fetch: app.fetch,
    port: PORT,
    hostname: HOST,
  });
}

main().catch(console.error);
```

## Why This Pattern?

1. **Separation of Concerns**: `DefaultRequestHandler` encapsulates the A2A request handling logic
2. **Task Management**: `TaskStore` handles task persistence independently
3. **Type Safety**: Proper interfaces ensure compile-time checking
4. **Flexibility**: Easy to swap implementations (e.g., different task stores)

## Troubleshooting

### Error: "Cannot find module '@drew-foxall/a2a-js-sdk/hono'"

**Fix**: Change to `@drew-foxall/a2a-js-sdk/server/hono`

### Error: "Property 'protocolVersion' is missing"

**Fix**: Add `protocolVersion: "0.3.0"` to your `AgentCard`

### Error: "'AgentCapabilities' only refers to a type"

**Fix**: Use a plain object for `capabilities`, not `new AgentCapabilities()`

### Error: "Object literal may only specify known properties, and 'statefulness' does not exist"

**Fix**: Remove `statefulness` from the capabilities object

### Error: "Property 'createAgentExecutor' does not exist"

**Fix**: `A2AAdapter` IS the executor. Use it directly:

```typescript
const agentExecutor: AgentExecutor = new A2AAdapter(agent, config);
```

### Error: "Property 'fetch' does not exist on type 'A2AHonoApp'"

**Fix**: Use `app.fetch` (the Hono app), not `appBuilder.fetch`:

```typescript
const app = new Hono();
const appBuilder = new A2AHonoApp(requestHandler);
appBuilder.setupRoutes(app);

serve({
  fetch: app.fetch,  // ✅ Correct
  port: PORT,
});
```

## Reference Implementation

The **canonical reference** is [`movie-agent/index.ts`](./examples/agents/src/agents/movie-agent/index.ts) - all agents should follow this pattern.

