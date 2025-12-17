# Separation Patterns for A2A Agents

This document defines the architectural patterns for separating agent logic from deployment concerns. All agents and workers in this repository should follow these patterns.

## Core Principle

**Agents should be composable, platform-agnostic, and able to serve on different platforms, compose with different dependencies, or use various storage methods.**

Each worker should only contain the composition necessary to integrate an AI SDK agent into the A2A protocol.

---

## Directory Structure

```
examples/
├── agents/              → Pure, composable logic (a2a-agents package)
│   └── src/
│       ├── agents/      → Agent implementations
│       │   └── {agent-name}/
│       │       ├── agent.ts       → Agent factory function
│       │       ├── prompt.ts      → Agent prompts/instructions
│       │       ├── tools.ts       → Agent-specific tools (if any)
│       │       ├── types.ts       → Type definitions (if needed)
│       │       ├── stores.ts      → Storage abstractions (if stateful)
│       │       └── index.ts       → Exports only (NO server code)
│       │
│       └── tools/       → Shared tool implementations
│           └── {tool-name}/
│               ├── types.ts       → Type definitions & schemas
│               ├── {tool}.ts      → Tool implementation
│               └── index.ts       → Exports only
│
├── workers/             → Cloudflare Worker deployments
│   └── {agent-name}/
│       └── src/index.ts → Hono app + A2A/MCP protocol wiring
│
└── mcp/                 → MCP server deployments (future)
```

---

## Compliance Checklist

### ✅ Agent Package (`examples/agents/src/agents/{name}/`)

| Requirement | Description |
|-------------|-------------|
| **No HTTP frameworks** | No imports from `hono`, `express`, `@hono/*`, etc. |
| **No environment access** | No `process.env`, `c.env`, or similar |
| **No server code** | No `serve()`, `app.listen()`, `new Hono()` |
| **Pure factory functions** | Export `create{Name}Agent(config)` that returns agent |
| **Composable dependencies** | Accept dependencies via config (model, stores, tools) |
| **Type exports** | Export interfaces/types for configuration |
| **Storage abstraction** | If stateful, define store interface and implementations |

#### Example: Compliant Agent Factory

```typescript
// examples/agents/src/agents/hello-world/agent.ts
import { ToolLoopAgent, type LanguageModel } from "ai";
import { getHelloWorldPrompt } from "./prompt.js";

export function createHelloWorldAgent(model: LanguageModel) {
  return new ToolLoopAgent({
    model,
    instructions: getHelloWorldPrompt(),
  });
}
```

#### Example: Compliant Index (Exports Only)

```typescript
// examples/agents/src/agents/hello-world/index.ts
export { createHelloWorldAgent } from "./agent.js";
export { getHelloWorldPrompt } from "./prompt.js";
```

#### Example: Stateful Agent with Store Abstraction

```typescript
// examples/agents/src/agents/game/types.ts
export interface GameState {
  score: number;
  attempts: number;
}

export interface GameStore {
  getState(sessionId: string): Promise<GameState | null>;
  setState(sessionId: string, state: GameState): Promise<void>;
}

// examples/agents/src/agents/game/stores.ts
export class InMemoryGameStore implements GameStore { /* ... */ }
export class RedisGameStore implements GameStore { /* ... */ }

// examples/agents/src/agents/game/agent.ts
export function createGameAgent(config: { store: GameStore }) {
  // Agent uses store abstraction, not concrete Redis/memory
}
```

---

### ✅ Worker Package (`examples/workers/{name}/`)

| Requirement | Description |
|-------------|-------------|
| **Import from a2a-agents** | Use `import { createXAgent } from "a2a-agents"` |
| **No agent logic** | No `ToolLoopAgent`, `instructions:`, `tools:` definitions |
| **Environment handling** | Configure stores/models from `c.env` |
| **A2A protocol wiring** | Set up `AgentCard`, `TaskStore`, `A2AAdapter` |
| **HTTP routing only** | Hono app with A2A routes |

#### Example: Compliant Worker

```typescript
// examples/workers/hello-world/src/index.ts
import { Hono } from "hono";
import { A2AAdapter } from "@drew-foxall/a2a-ai-sdk-adapter";
import type { AgentCard } from "@drew-foxall/a2a-js-sdk";
import { DefaultRequestHandler, InMemoryTaskStore } from "@drew-foxall/a2a-js-sdk/server";
import { A2AHonoApp } from "@drew-foxall/a2a-js-sdk/server/hono";

// ✅ Import agent from a2a-agents package
import { createHelloWorldAgent } from "a2a-agents";

// ✅ Worker-specific: environment types
interface Env {
  AI_GATEWAY_URL: string;
  OPENAI_API_KEY: string;
}

// ✅ Worker-specific: model configuration
function getModel(env: Env) {
  return createOpenAI({ apiKey: env.OPENAI_API_KEY });
}

// ✅ Worker-specific: agent card (deployment metadata)
function createAgentCard(baseUrl: string): AgentCard {
  return {
    name: "Hello World Agent",
    description: "A simple greeting agent",
    url: baseUrl,
    protocolVersion: "0.3.0",
    // ... other A2A protocol fields
  };
}

const app = new Hono<{ Bindings: Env }>();

app.post("/", async (c) => {
  const baseUrl = new URL(c.req.url).origin;
  
  // ✅ Compose: model from environment
  const model = getModel(c.env);
  
  // ✅ Compose: agent from a2a-agents
  const agent = createHelloWorldAgent(model);
  
  // ✅ A2A protocol wiring
  const agentCard = createAgentCard(baseUrl);
  const taskStore = new InMemoryTaskStore();
  const executor = new A2AAdapter(agent, { mode: "stream" });
  const handler = new DefaultRequestHandler(agentCard, taskStore, executor);
  
  // ... handle request
});

export default app;
```

#### Example: Stateful Worker with Redis

```typescript
// examples/workers/game-agent/src/index.ts
import { Redis } from "@upstash/redis/cloudflare";
import { createGameAgent, createRedisGameStore } from "a2a-agents";

interface Env {
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
}

app.post("/", async (c) => {
  // ✅ Worker creates Redis client from environment
  const redis = new Redis({
    url: c.env.UPSTASH_REDIS_REST_URL,
    token: c.env.UPSTASH_REDIS_REST_TOKEN,
  });
  
  // ✅ Worker creates store with Redis client
  const store = createRedisGameStore(redis);
  
  // ✅ Agent receives store abstraction
  const agent = createGameAgent({ store });
  
  // ... A2A protocol wiring
});
```

---

## Anti-Patterns

### ❌ Agent with HTTP Framework

```typescript
// BAD: examples/agents/src/agents/hello-world/index.ts
import { Hono } from "hono";  // ❌ HTTP framework in agent package
import { serve } from "@hono/node-server";

const app = new Hono();
app.post("/", async (c) => { /* ... */ });
serve({ fetch: app.fetch, port: 3000 });  // ❌ Server code in agent
```

### ❌ Agent with Direct Environment Access

```typescript
// BAD: examples/agents/src/agents/weather/agent.ts
export function createWeatherAgent() {
  const apiKey = process.env.WEATHER_API_KEY;  // ❌ Direct env access
  // ...
}
```

### ❌ Worker Defining Agent Logic

```typescript
// BAD: examples/workers/weather-agent/src/index.ts
import { ToolLoopAgent } from "ai";

// ❌ Agent logic defined in worker
const agent = new ToolLoopAgent({
  model,
  instructions: "You are a weather agent...",
  tools: {
    getWeather: { /* ... */ }
  }
});
```

### ❌ Agent with Concrete Storage Implementation

```typescript
// BAD: examples/agents/src/agents/game/agent.ts
import { Redis } from "@upstash/redis";  // ❌ Concrete implementation

export function createGameAgent() {
  const redis = new Redis({ /* ... */ });  // ❌ Creates own Redis
  // ...
}
```

---

## Assessment Template

Use this template to assess compliance:

```markdown
## Agent: {name}

### Location
- Agent: `examples/agents/src/agents/{name}/`
- Worker: `examples/workers/{name}/`

### Agent Package Compliance

| Check | Status | Notes |
|-------|--------|-------|
| No HTTP framework imports | ⬜ | |
| No environment access | ⬜ | |
| No server code | ⬜ | |
| Pure factory function | ⬜ | |
| Composable dependencies | ⬜ | |
| Store abstraction (if stateful) | ⬜ | |
| Index exports only | ⬜ | |

### Worker Package Compliance

| Check | Status | Notes |
|-------|--------|-------|
| Imports from a2a-agents | ⬜ | |
| No inline agent logic | ⬜ | |
| Environment handling | ⬜ | |
| A2A protocol wiring | ⬜ | |

### Verdict
- [ ] ✅ Compliant
- [ ] ⚠️ Partially Compliant (list issues)
- [ ] ❌ Non-Compliant (list issues)
```

---

## Migration Guide

When refactoring a non-compliant agent:

1. **Extract agent logic** to `examples/agents/src/agents/{name}/agent.ts`
2. **Extract prompts** to `prompt.ts`
3. **Extract tools** to `tools.ts` (if any)
4. **Create store abstraction** in `types.ts` and `stores.ts` (if stateful)
5. **Update index.ts** to export only (remove server code)
6. **Update worker** to import from `a2a-agents` and compose

---

## Shared Tools Pattern

For tools that can be used across multiple agents or MCP servers, extract them to `examples/agents/src/tools/`:

### Example: Airbnb Scraper Tool

```typescript
// examples/agents/src/tools/airbnb-scraper/types.ts
export interface AirbnbSearchParams {
  location: string;
  checkin?: string;
  checkout?: string;
  // ...
}

export interface Fetcher {
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
}

// examples/agents/src/tools/airbnb-scraper/scraper.ts
export interface AirbnbScraperConfig {
  fetcher?: Fetcher;  // Dependency injection
  cheerioLoad: (html: string) => CheerioAPI;  // Injected - no cheerio import
}

export function createAirbnbScraper(config: AirbnbScraperConfig): AirbnbScraper {
  return new AirbnbScraper(config);
}
```

### Using in a Worker (MCP Server)

```typescript
// examples/workers/airbnb-mcp-server/src/index.ts
import * as cheerio from "cheerio";
import { createAirbnbScraper } from "a2a-agents/tools/airbnb-scraper";

// Worker injects cheerio
const scraper = createAirbnbScraper({
  cheerioLoad: cheerio.load,
});

// Use in MCP tool handler
const results = await scraper.search({ location: "Paris" });
```

### Using in an Agent

```typescript
// examples/agents/src/agents/travel-agent/agent.ts
import { createAirbnbScraper } from "../tools/airbnb-scraper/index.js";

export function createTravelAgent(config: { cheerioLoad: CheerioLoad }) {
  const scraper = createAirbnbScraper({ cheerioLoad: config.cheerioLoad });
  
  return new ToolLoopAgent({
    model: config.model,
    tools: {
      searchAccommodations: {
        execute: async (params) => scraper.search(params),
      },
    },
  });
}
```

---

## Rationale

This separation enables:

1. **Multi-platform deployment** - Same agent logic on Workers, Node.js, Deno, etc.
2. **Testing** - Agents can be unit tested without HTTP/environment mocking
3. **Composition** - Mix and match storage backends, models, tools
4. **Maintainability** - Clear boundaries between concerns
5. **Reusability** - Agents and tools can be composed into larger systems
6. **Tool sharing** - Same tool logic across agents and MCP servers

