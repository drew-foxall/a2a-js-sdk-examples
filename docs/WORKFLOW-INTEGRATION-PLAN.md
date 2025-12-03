# Workflow DevKit Integration Plan

## Executive Summary

This document outlines a comprehensive plan for integrating [Workflow DevKit](https://useworkflow.dev) into our A2A examples to provide durability, observability, and fault tolerance. The key insight is **separation of concerns**:

- **Agents**: Core logic and decision-making (framework-agnostic)
- **Tools**: Individual operations that can be made durable (steps)
- **Workflows**: Orchestration of agents and tools with durability guarantees
- **Worlds**: Infrastructure-specific persistence and execution backends

This separation enables the **same agent code** to run across different deployment targets (Cloudflare, Vercel, AWS, Railway) by swapping only the World configuration.

### Design Decision: Redis-First Approach

**All examples will use Upstash Redis as the unified persistence layer** for both:
- **Task Stores** (A2A protocol persistence) - via `@drew-foxall/a2a-js-taskstore-upstash-redis`
- **Workflow DevKit** (execution durability) - via `@workflow-worlds/redis`

This enables:
- **Platform portability** - Same Redis works on Cloudflare, Vercel, AWS, Deno
- **Simplified setup** - One service, one set of credentials
- **Focus on worker configurations** - Demonstrate different platforms, not different storage backends

See [Task Store Integration Analysis](./TASKSTORE-INTEGRATION-ANALYSIS.md) for details on the unified Redis architecture.

---

## Architecture Overview

### Current Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        examples/agents/                              │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  Agent (ToolLoopAgent)                                          ││
│  │  ├── prompt.ts          (instructions)                          ││
│  │  ├── tools.ts           (pure functions)                        ││
│  │  └── agent.ts           (ToolLoopAgent factory)                 ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
                                │
                                │ import
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        examples/workers/                             │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  Worker (Cloudflare)                                            ││
│  │  ├── index.ts           (Hono + A2A adapter)                    ││
│  │  └── wrangler.toml      (deployment config)                     ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

### Target Architecture with Workflow DevKit

```
┌─────────────────────────────────────────────────────────────────────┐
│                        examples/agents/                              │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  Agent (Protocol-Agnostic)                                      ││
│  │  ├── prompt.ts          (instructions)                          ││
│  │  ├── tools.ts           (pure functions - NO "use step")        ││
│  │  ├── agent.ts           (ToolLoopAgent factory)                 ││
│  │  └── workflow.ts        (DurableAgent + "use workflow")   NEW   ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  Steps (Durable Tool Wrappers)                            NEW   ││
│  │  └── steps.ts           (tools wrapped with "use step")         ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
                                │
                                │ import
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        examples/workers/                             │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  Worker (Any Platform)                                          ││
│  │  ├── index.ts           (Hono + workflow/api start())           ││
│  │  └── config             (platform-specific)                     ││
│  │      ├── wrangler.toml  (Cloudflare)                            ││
│  │      ├── vercel.json    (Vercel)                                ││
│  │      └── .env           (World selection)                       ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
                                │
                                │ WORKFLOW_TARGET_WORLD
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           World (Pluggable)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │ Local World │  │ Vercel World│  │ Redis World │  │Postgres World│ │
│  │ (dev)       │  │ (Vercel)    │  │ (Upstash)   │  │ (Railway)    │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Separation of Concerns

### Layer 1: Pure Tools (No Directives)

Tools remain pure functions with no Workflow DevKit dependencies. This ensures they can be:
- Unit tested in isolation
- Used without Workflow DevKit
- Reused across different agent implementations

```typescript
// examples/agents/src/agents/dice-agent/tools.ts
// NO "use step" here - pure functions

export function rollDice(sides: number = 6): number {
  return Math.floor(Math.random() * sides) + 1;
}

export function checkPrime(numbers: number[]): string {
  const primes = numbers.filter(isPrime);
  return primes.length === 0 
    ? "No prime numbers found." 
    : `${primes.join(", ")} are prime numbers.`;
}
```

### Layer 2: Durable Steps (Tool Wrappers)

Steps wrap pure tools with the `"use step"` directive for durability:

```typescript
// examples/agents/src/agents/dice-agent/steps.ts
// Durable wrappers around pure tools

import { rollDice as rollDicePure, checkPrime as checkPrimePure } from "./tools";

export async function rollDice(sides: number = 6): Promise<number> {
  "use step";
  
  // Automatic retry on failure
  // Result cached if workflow restarts
  return rollDicePure(sides);
}

export async function checkPrime(numbers: number[]): Promise<string> {
  "use step";
  
  return checkPrimePure(numbers);
}
```

### Layer 3: Agent (Protocol-Agnostic)

The agent factory remains unchanged for non-durable use cases:

```typescript
// examples/agents/src/agents/dice-agent/agent.ts
// Protocol-agnostic agent (existing)

import { type LanguageModel, ToolLoopAgent } from "ai";
import { rollDice, checkPrime } from "./tools"; // Pure tools

export function createDiceAgent(model: LanguageModel) {
  return new ToolLoopAgent({
    model,
    instructions: getDiceAgentPrompt(),
    tools: {
      rollDice: {
        description: "Rolls an N-sided dice",
        inputSchema: rollDiceSchema,
        execute: async (params) => rollDice(params.sides),
      },
      checkPrime: {
        description: "Checks if numbers are prime",
        inputSchema: checkPrimeSchema,
        execute: async (params) => checkPrime(params.numbers),
      },
    },
  });
}
```

### Layer 4: Durable Workflow (NEW)

A new workflow file adds durability:

```typescript
// examples/agents/src/agents/dice-agent/workflow.ts
// Durable workflow version of the agent

import { DurableAgent } from "@workflow/ai/agent";
import { getWritable } from "workflow";
import type { UIMessageChunk, ModelMessage } from "ai";
import { getDiceAgentPrompt } from "./prompt";
import { rollDice, checkPrime } from "./steps"; // Durable steps!

export async function diceAgentWorkflow(messages: ModelMessage[]) {
  "use workflow";
  
  const writable = getWritable<UIMessageChunk>();
  
  const agent = new DurableAgent({
    model: "openai/gpt-4o-mini",
    system: getDiceAgentPrompt(),
    tools: {
      rollDice: {
        description: "Rolls an N-sided dice",
        inputSchema: rollDiceSchema,
        execute: rollDice, // Uses durable step
      },
      checkPrime: {
        description: "Checks if numbers are prime",
        inputSchema: checkPrimeSchema,
        execute: checkPrime, // Uses durable step
      },
    },
  });
  
  await agent.stream({ messages, writable });
}
```

### Layer 5: Worker Entry Point

Workers import the workflow and configure the World via environment:

```typescript
// examples/workers/dice-agent-durable/src/index.ts

import { Hono } from "hono";
import { start } from "workflow/api";
import { diceAgentWorkflow } from "a2a-agents/dice-agent/workflow";
import { convertToModelMessages, createUIMessageStreamResponse } from "ai";

const app = new Hono<{ Bindings: Env }>();

app.post("/", async (c) => {
  const { messages } = await c.req.json();
  const modelMessages = convertToModelMessages(messages);
  
  // Start durable workflow - World selected via WORKFLOW_TARGET_WORLD env var
  const run = await start(diceAgentWorkflow, [modelMessages]);
  
  return createUIMessageStreamResponse({
    stream: run.readable,
  });
});

export default app;
```

### Layer 6: World Configuration (Redis-First)

All examples use Redis World via environment variables:

```bash
# Local development
# Uses Local World by default, or Redis World if configured

# All deployed environments (Cloudflare, Vercel, AWS, etc.)
WORKFLOW_TARGET_WORLD=@workflow-worlds/redis
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
```

The same Redis instance serves both **Task Store** and **Workflow DevKit**:

```typescript
// Shared Upstash Redis configuration
const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

// Task Store (A2A protocol persistence)
const taskStore = new UpstashRedisTaskStore({
  client: redis,
  prefix: 'a2a:dice:',  // Namespaced by agent
});

// Workflow DevKit (execution durability)
// Uses prefix: 'workflow:' automatically
```

---

## File Structure

### Proposed Directory Structure

```
examples/
├── agents/src/agents/
│   └── dice-agent/
│       ├── tools.ts           # Pure functions (existing)
│       ├── tools.test.ts      # Unit tests (existing)
│       ├── steps.ts           # Durable wrappers (NEW)
│       ├── steps.test.ts      # Step tests (NEW)
│       ├── prompt.ts          # Instructions (existing)
│       ├── agent.ts           # ToolLoopAgent (existing)
│       ├── workflow.ts        # DurableAgent workflow (NEW)
│       ├── index.ts           # Exports both (updated)
│       └── README.md          # Documentation (updated)
│
└── workers/
    ├── dice-agent/            # Non-durable (existing)
    │   ├── src/index.ts
    │   └── wrangler.toml
    │
    └── dice-agent-durable/    # Durable version (NEW)
        ├── src/index.ts       # Uses workflow/api
        ├── wrangler.toml      # Cloudflare config
        └── .env.example       # World config examples
```

### Export Strategy

```typescript
// examples/agents/src/agents/dice-agent/index.ts

// Non-durable exports (existing)
export { createDiceAgent } from "./agent";
export { rollDice, checkPrime } from "./tools";
export { getDiceAgentPrompt } from "./prompt";

// Durable exports (NEW)
export { diceAgentWorkflow } from "./workflow";
export * as steps from "./steps";
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)

**Goal**: Establish the pattern with one agent

1. **Add Workflow DevKit to monorepo**
   ```bash
   pnpm add workflow @workflow/ai -w
   pnpm add @workflow-worlds/redis -w  # For cross-platform support
   ```

2. **Create dice-agent workflow**
   - Add `steps.ts` with durable wrappers
   - Add `workflow.ts` with DurableAgent
   - Update `index.ts` exports

3. **Create durable worker example**
   - New `workers/dice-agent-durable/`
   - Document World configuration

4. **Test with Local World**
   ```bash
   cd examples/workers/dice-agent-durable
   pnpm dev
   npx workflow web  # Verify observability
   ```

### Phase 2: Redis World Integration (Week 2)

**Goal**: Prove cross-platform deployment

1. **Set up Upstash Redis**
   - Create free Upstash account
   - Configure Redis World

2. **Test on Cloudflare Workers**
   ```bash
   wrangler secret put UPSTASH_REDIS_REST_URL
   wrangler secret put UPSTASH_REDIS_REST_TOKEN
   wrangler deploy
   ```

3. **Document deployment patterns**
   - Cloudflare Workers + Upstash
   - Vercel (auto World)
   - Railway + Postgres World

### Phase 3: High-Value Agents (Week 3-4)

**Goal**: Apply pattern to complex agents

| Agent | Priority | Why Workflow Helps |
|-------|----------|-------------------|
| `travel-planner-multiagent` | 🔴 High | Parallel A2A calls with retry |
| `image-generator` | 🔴 High | Long-running generation |
| `adversarial` | 🟡 Medium | Conversation persistence |
| `code-review` | 🟡 Medium | External tool retries |

### Phase 4: Unlock Deferred Examples (Week 5-6)

**Goal**: Implement previously impossible examples

| Example | Blocker | Workflow Solution |
|---------|---------|-------------------|
| File Chat (13) | Size limits | Steps run in workers |
| Telemetry (19) | No OTEL | Built-in observability |
| Auth Flows (18) | CIBA polling | Durable sleep |
| MCP Registry (06) | Re-planning | State persistence |

---

## World Selection: Redis-First

### Why Redis World for All Examples

| Benefit | Description |
|---------|-------------|
| **Portability** | HTTP-based, works on any edge runtime |
| **Unified Stack** | Same Redis for Task Store + Workflow DevKit |
| **Simple Setup** | One Upstash account, one set of credentials |
| **Focus** | Demonstrate platform differences, not storage differences |

### Redis World Benefits

From the [workflow-worlds/redis](https://github.com/mizzle-dev/workflow-worlds/tree/main/packages/redis) package:

- **BullMQ** for reliable job queuing
- **Redis Streams** for output streaming
- **Upstash** provides HTTP-based Redis (edge-compatible)
- Works with Cloudflare Workers, Vercel Edge, AWS Lambda, Deno Deploy

### Configuration (All Platforms)

```bash
# Environment variables (same for all platforms)
WORKFLOW_TARGET_WORLD=@workflow-worlds/redis
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
```

Platform-specific setup:

```toml
# Cloudflare Workers (wrangler.toml)
[vars]
WORKFLOW_TARGET_WORLD = "@workflow-worlds/redis"

# Secrets via: wrangler secret put UPSTASH_REDIS_REST_URL
# Secrets via: wrangler secret put UPSTASH_REDIS_REST_TOKEN
```

```json
// Vercel (vercel.json or dashboard)
{
  "env": {
    "WORKFLOW_TARGET_WORLD": "@workflow-worlds/redis",
    "UPSTASH_REDIS_REST_URL": "@upstash-redis-url",
    "UPSTASH_REDIS_REST_TOKEN": "@upstash-redis-token"
  }
}
```

```yaml
# AWS Lambda (template.yaml)
Environment:
  Variables:
    WORKFLOW_TARGET_WORLD: "@workflow-worlds/redis"
    UPSTASH_REDIS_REST_URL: !Ref UpstashRedisUrl
    UPSTASH_REDIS_REST_TOKEN: !Ref UpstashRedisToken
```

### Alternative Worlds (Reference Only)

For users with specific requirements, other Worlds are available:

| World | Use Case |
|-------|----------|
| Local World | Development only (default) |
| Vercel World | Vercel-native deployments |
| Postgres World | Long-running processes, existing Postgres |
| Turso World | SQLite at the edge |
| MongoDB World | Existing MongoDB infrastructure |

---

## Observability

### Built-in Dashboard

```bash
# Open observability UI
npx workflow web
```

Features:
- All workflow runs and status
- Trace viewer for step-by-step inspection
- Retry attempts visible
- Data flow between steps

### Trace Structure

```
dice-agent-workflow
└── agent_execution (task_id: abc123)
    ├── llm_call (model: gpt-4o-mini)
    │   └── tool_call: rollDice
    │       └── step: rollDice (sides: 20)
    └── llm_call (model: gpt-4o-mini)
        └── response: "You rolled a 17!"
```

---

## Testing Strategy

### Unit Tests (Pure Tools)

```typescript
// tools.test.ts - No Workflow DevKit needed
import { rollDice, checkPrime } from "./tools";

test("rollDice returns number in range", () => {
  const result = rollDice(6);
  expect(result).toBeGreaterThanOrEqual(1);
  expect(result).toBeLessThanOrEqual(6);
});
```

### Integration Tests (Workflows)

```typescript
// workflow.test.ts - Tests durable execution
import { start } from "workflow/api";
import { diceAgentWorkflow } from "./workflow";

test("workflow completes successfully", async () => {
  const run = await start(diceAgentWorkflow, [
    [{ role: "user", content: "Roll a d20" }]
  ]);
  
  // Read stream to completion
  const reader = run.readable.getReader();
  // ... assert on output
});
```

### E2E Tests (Full Stack)

```typescript
// e2e.test.ts - Tests deployed worker
test("durable agent responds", async () => {
  const response = await fetch("https://dice-agent.workers.dev/", {
    method: "POST",
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "message/send",
      params: { message: { parts: [{ text: "Roll a d20" }] } }
    })
  });
  
  expect(response.ok).toBe(true);
});
```

---

## Migration Path

### For Existing Agents

1. **Keep existing agent.ts** - Non-durable version still works
2. **Add workflow.ts** - Durable version alongside
3. **Export both** - Let consumers choose
4. **Update workers** - Point to workflow when durability needed

### Backwards Compatibility

```typescript
// index.ts exports both
export { createDiceAgent } from "./agent";      // Non-durable
export { diceAgentWorkflow } from "./workflow"; // Durable
```

Workers can choose:
```typescript
// Non-durable (existing)
import { createDiceAgent } from "a2a-agents";
const agent = createDiceAgent(model);

// Durable (new)
import { diceAgentWorkflow } from "a2a-agents";
const run = await start(diceAgentWorkflow, [messages]);
```

---

## Success Criteria

### Phase 1 Complete When:
- [ ] dice-agent has workflow.ts
- [ ] Local World works in development
- [ ] `npx workflow web` shows traces

### Phase 2 Complete When:
- [ ] Redis World works with Upstash
- [ ] Cloudflare Worker deployment succeeds
- [ ] Workflow survives Worker restart

### Phase 3 Complete When:
- [ ] travel-planner-multiagent is durable
- [ ] image-generator handles timeouts
- [ ] Observability shows multi-agent traces

### Phase 4 Complete When:
- [ ] File Chat (13) implemented
- [ ] Telemetry (19) via built-in observability
- [ ] Auth Flows (18) with durable CIBA

---

## References

- [Workflow DevKit Documentation](https://useworkflow.dev)
- [Building Durable AI Agents](https://useworkflow.dev/docs/ai)
- [Worlds Overview](https://useworkflow.dev/docs/deploying/world)
- [Redis World](https://github.com/mizzle-dev/workflow-worlds/tree/main/packages/redis)
- [Hono Integration](https://useworkflow.dev/docs/getting-started/hono)
- [Flight Booking Example](https://github.com/vercel/workflow-examples/tree/main/flight-booking-app)

