# Next Phase Implementation Plan

## Executive Summary

This document outlines the next phase of development for our A2A examples, combining three key initiatives:

1. **Task Store Integration** - Replace `InMemoryTaskStore` with `UpstashRedisTaskStore`
2. **Workflow DevKit Integration** - Add durability, observability, and fault tolerance
3. **Platform Portability** - Demonstrate same agent on multiple platforms

### Design Principle: Redis-First

All examples will use **Upstash Redis** as the unified persistence layer:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SAME AGENT LOGIC (a2a-agents)                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
         ┌─────────────────┐ ┌─────────────┐ ┌─────────────┐
         │ Cloudflare      │ │ Vercel Edge │ │ AWS Lambda  │
         │ Workers         │ │             │ │             │
         └─────────────────┘ └─────────────┘ └─────────────┘
                    │               │               │
                    └───────────────┼───────────────┘
                                    ▼
         ┌─────────────────────────────────────────────────────────────────┐
         │                     UPSTASH REDIS                                │
         │  ┌─────────────────────────┐  ┌─────────────────────────────┐  │
         │  │ Task Store (a2a:*)      │  │ Workflow DevKit (workflow:*) │  │
         │  │ - Task state            │  │ - Workflow runs              │  │
         │  │ - Message history       │  │ - Step results               │  │
         │  │ - Push configs          │  │ - Job queue                  │  │
         │  └─────────────────────────┘  └─────────────────────────────┘  │
         └─────────────────────────────────────────────────────────────────┘
```

---

## Current State

### Completed Work (Waves 1-3)

| Category | Count | Status |
|----------|-------|--------|
| Python examples evaluated | 23 | ✅ Complete |
| Local agents implemented | 17 | ✅ Complete |
| Cloudflare workers implemented | 17 | ✅ Complete |

### Current Limitations

All workers currently use `InMemoryTaskStore`:
- ❌ Tasks lost on worker restart
- ❌ No multi-turn persistence
- ❌ No task history/observability
- ❌ No push notification persistence
- ❌ No workflow durability

---

## Implementation Phases

### Phase 1: Task Store Foundation (Week 1)

**Goal**: Replace `InMemoryTaskStore` with `UpstashRedisTaskStore` in all workers

#### Step 1.1: Prerequisites

- [ ] Create Upstash Redis account (free tier)
- [ ] Create Redis database for examples
- [ ] Document credentials setup

#### Step 1.2: Update dice-agent (Proof of Concept)

Transform:

```typescript
// BEFORE: examples/workers/dice-agent/src/index.ts
import { InMemoryTaskStore } from "@drew-foxall/a2a-js-sdk/server";

const taskStore: TaskStore = new InMemoryTaskStore();
```

Into:

```typescript
// AFTER: examples/workers/dice-agent/src/index.ts
import { Redis } from "@upstash/redis";
import { UpstashRedisTaskStore } from "@drew-foxall/a2a-js-taskstore-upstash-redis";

const redis = new Redis({
  url: c.env.UPSTASH_REDIS_REST_URL,
  token: c.env.UPSTASH_REDIS_REST_TOKEN,
});

const taskStore = new UpstashRedisTaskStore({
  client: redis,
  prefix: 'a2a:dice:',
  ttlSeconds: 86400 * 7, // 7 days
});
```

#### Step 1.3: Update All Workers

Apply same pattern to all 17 workers:

| Worker | Prefix | Priority |
|--------|--------|----------|
| `dice-agent` | `a2a:dice:` | 🔴 High (PoC) |
| `hello-world` | `a2a:hello:` | 🟡 Medium |
| `currency-agent` | `a2a:currency:` | 🟡 Medium |
| `travel-planner` | `a2a:travel:` | 🔴 High (multi-agent) |
| `weather-agent` | `a2a:weather:` | 🟡 Medium |
| `airbnb-agent` | `a2a:airbnb:` | 🟡 Medium |
| `github-agent` | `a2a:github:` | 🟡 Medium |
| `analytics-agent` | `a2a:analytics:` | 🟡 Medium |
| `content-planner` | `a2a:content:` | 🟡 Medium |
| `contact-extractor` | `a2a:contact:` | 🟡 Medium |
| `expense-agent` | `a2a:expense:` | 🟡 Medium |
| `number-game-alice` | `a2a:alice:` | 🔴 High (multi-turn) |
| `number-game-carol` | `a2a:carol:` | 🔴 High (multi-turn) |
| `image-generator` | `a2a:image:` | 🟡 Medium |
| `code-review` | `a2a:code:` | 🟡 Medium |
| `local-llm-chat` | `a2a:llm:` | 🟡 Medium |
| `adversarial-defender` | `a2a:adversarial:` | 🟡 Medium |

#### Step 1.4: Shared Utilities

Create shared Redis setup in `examples/workers/shared/`:

```typescript
// examples/workers/shared/redis.ts
import { Redis } from "@upstash/redis";
import { UpstashRedisTaskStore } from "@drew-foxall/a2a-js-taskstore-upstash-redis";

export interface RedisEnv {
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
}

export function createRedisClient(env: RedisEnv): Redis {
  return new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
}

export function createTaskStore(
  redis: Redis,
  prefix: string,
  ttlSeconds: number = 86400 * 7
): UpstashRedisTaskStore {
  return new UpstashRedisTaskStore({
    client: redis,
    prefix,
    ttlSeconds,
  });
}
```

#### Step 1.5: Documentation

- [ ] Update `examples/workers/README.md` with Upstash setup
- [ ] Add `.env.example` to each worker
- [ ] Document wrangler secret commands

**Deliverables**:
- [ ] All 17 workers use `UpstashRedisTaskStore`
- [ ] Shared Redis utilities
- [ ] Documentation for Upstash setup

---

### Phase 2: Workflow DevKit Foundation (Week 2)

**Goal**: Add Workflow DevKit to dice-agent as proof of concept

#### Step 2.1: Add Dependencies

```bash
# In examples/agents/
pnpm add workflow @workflow/ai
pnpm add @workflow-worlds/redis
```

#### Step 2.2: Create Durable Steps

```typescript
// examples/agents/src/agents/dice-agent/steps.ts
import { rollDice as rollDicePure, checkPrime as checkPrimePure } from "./tools";

export async function rollDice(sides: number = 6): Promise<number> {
  "use step";
  return rollDicePure(sides);
}

export async function checkPrime(numbers: number[]): Promise<string> {
  "use step";
  return checkPrimePure(numbers);
}
```

#### Step 2.3: Create Workflow

```typescript
// examples/agents/src/agents/dice-agent/workflow.ts
import { DurableAgent } from "@workflow/ai/agent";
import { getWritable } from "workflow";
import type { UIMessageChunk, ModelMessage } from "ai";
import { getDiceAgentPrompt } from "./prompt";
import { rollDice, checkPrime } from "./steps";

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
        execute: rollDice,
      },
      checkPrime: {
        description: "Checks if numbers are prime",
        inputSchema: checkPrimeSchema,
        execute: checkPrime,
      },
    },
  });
  
  await agent.stream({ messages, writable });
}
```

#### Step 2.4: Create Durable Worker

```typescript
// examples/workers/dice-agent-durable/src/index.ts
import { Hono } from "hono";
import { start } from "workflow/api";
import { diceAgentWorkflow } from "a2a-agents/dice-agent/workflow";

const app = new Hono<{ Bindings: Env }>();

// ... A2A routes that trigger workflow
```

#### Step 2.5: Test Observability

```bash
npx workflow web  # Open observability UI
```

**Deliverables**:
- [ ] `dice-agent` has `steps.ts` and `workflow.ts`
- [ ] New `dice-agent-durable` worker
- [ ] Observability dashboard working

---

### Phase 3: High-Value Workflows (Week 3)

**Goal**: Apply Workflow DevKit to agents that benefit most

#### Priority Agents

| Agent | Why Workflow Helps | Effort |
|-------|-------------------|--------|
| `travel-planner-multiagent` | Parallel A2A calls with retry | High |
| `image-generator` | Long-running generation | Medium |
| `adversarial` | Conversation persistence | Medium |
| `code-review` | External tool retries | Medium |

#### Step 3.1: Travel Planner Workflow

The multi-agent travel planner makes parallel calls to weather and Airbnb agents. Workflow DevKit provides:
- Automatic retry on agent failures
- Parallel execution with `Promise.all` durability
- Trace visibility for debugging

```typescript
// examples/agents/src/agents/travel-planner-multiagent/planner/workflow.ts
export async function travelPlannerWorkflow(destination: string, dates: string) {
  "use workflow";
  
  // Parallel durable calls
  const [weather, accommodations] = await Promise.all([
    callWeatherAgent(destination, dates),  // "use step"
    callAirbnbAgent(destination, dates),   // "use step"
  ]);
  
  // LLM synthesis
  return synthesizePlan(destination, weather, accommodations);
}
```

#### Step 3.2: Image Generator Workflow

Long-running DALL-E calls benefit from durability:

```typescript
// examples/agents/src/agents/image-generator/workflow.ts
export async function imageGeneratorWorkflow(prompt: string) {
  "use workflow";
  
  // Durable step with automatic retry
  const imageUrl = await generateImage(prompt);  // "use step"
  
  return imageUrl;
}
```

**Deliverables**:
- [ ] `travel-planner-multiagent` has workflow
- [ ] `image-generator` has workflow
- [ ] Corresponding durable workers

---

### Phase 4: Platform Portability (Week 4)

**Goal**: Demonstrate same agent on multiple platforms

#### Target Structure

```
examples/workers/
├── dice-agent/                    # Cloudflare Workers
├── dice-agent-vercel/             # Vercel Edge Functions
├── dice-agent-aws/                # AWS Lambda (optional)
└── dice-agent-deno/               # Deno Deploy (optional)
```

#### Step 4.1: Vercel Edge Example

```typescript
// examples/workers/dice-agent-vercel/api/index.ts
import { Redis } from "@upstash/redis";
import { UpstashRedisTaskStore } from "@drew-foxall/a2a-js-taskstore-upstash-redis";
import { createDiceAgent } from "a2a-agents";

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  const taskStore = new UpstashRedisTaskStore({
    client: redis,
    prefix: 'a2a:dice:',
  });

  // Same agent logic, same Redis
  // ...
}
```

#### Step 4.2: Documentation

Create comparison documentation showing:
- Same agent logic
- Same Redis configuration
- Different platform boilerplate

**Deliverables**:
- [ ] `dice-agent-vercel` example
- [ ] Platform comparison documentation
- [ ] Deployment guides for each platform

---

### Phase 5: Unlock Deferred Examples (Week 5-6)

**Goal**: Implement previously impossible examples using Workflow DevKit

#### Telemetry (Example 19)

Workflow DevKit provides built-in observability:

```bash
npx workflow web
```

Features:
- All workflow runs and status
- Trace viewer for step-by-step inspection
- Retry attempts visible
- Data flow between steps

This replaces the need for custom OpenTelemetry integration.

#### Auth Flows (Example 18)

Durable `sleep()` enables CIBA polling:

```typescript
export async function authWorkflow(authRequest: AuthRequest) {
  "use workflow";
  
  // Start auth flow
  const authCode = await initiateAuth(authRequest);
  
  // Durable polling with backoff
  for (let i = 0; i < 10; i++) {
    const result = await checkAuthStatus(authCode);
    if (result.status === 'completed') {
      return result.token;
    }
    await sleep(5000 * (i + 1)); // Durable sleep with backoff
  }
  
  throw new FatalError('Auth timeout');
}
```

#### MCP Registry (Example 06)

State persistence enables re-planning:

```typescript
export async function mcpRegistryWorkflow(query: string) {
  "use workflow";
  
  // Discover available MCP servers
  const servers = await discoverMcpServers();
  
  // Plan tool calls
  const plan = await planToolCalls(query, servers);
  
  // Execute with retry
  for (const step of plan.steps) {
    await executeToolCall(step);  // "use step" with retry
  }
}
```

**Deliverables**:
- [ ] Telemetry via Workflow DevKit observability
- [ ] Auth flow example with durable sleep
- [ ] MCP Registry with state persistence

---

## Implementation Checklist

### Phase 1: Task Store Foundation
- [ ] Create Upstash Redis account
- [ ] Update `dice-agent` worker with Redis task store
- [ ] Create shared Redis utilities
- [ ] Update all 17 workers
- [ ] Add documentation

### Phase 2: Workflow DevKit Foundation
- [ ] Add Workflow DevKit dependencies
- [ ] Create `dice-agent/steps.ts`
- [ ] Create `dice-agent/workflow.ts`
- [ ] Create `dice-agent-durable` worker
- [ ] Verify observability dashboard

### Phase 3: High-Value Workflows
- [ ] Add workflow to `travel-planner-multiagent`
- [ ] Add workflow to `image-generator`
- [ ] Add workflow to `adversarial`
- [ ] Add workflow to `code-review`

### Phase 4: Platform Portability
- [ ] Create `dice-agent-vercel` example
- [ ] Document platform comparison
- [ ] Add deployment guides

### Phase 5: Unlock Deferred Examples
- [ ] Implement telemetry via observability
- [ ] Implement auth flow with durable sleep
- [ ] Implement MCP registry with state persistence

---

## Success Criteria

### Phase 1 Complete When:
- [ ] All workers use `UpstashRedisTaskStore`
- [ ] Tasks persist across worker restarts
- [ ] Multi-turn conversations work

### Phase 2 Complete When:
- [ ] `dice-agent` has durable workflow
- [ ] `npx workflow web` shows traces
- [ ] Workflow survives worker restart

### Phase 3 Complete When:
- [ ] Multi-agent travel planner is durable
- [ ] Image generator handles timeouts
- [ ] Observability shows multi-agent traces

### Phase 4 Complete When:
- [ ] Same agent runs on Cloudflare + Vercel
- [ ] Same Redis backend for both
- [ ] Documentation shows comparison

### Phase 5 Complete When:
- [ ] Telemetry example works via observability
- [ ] Auth flow example with CIBA
- [ ] MCP Registry with re-planning

---

## Risk Mitigation

### Upstash Rate Limits

Free tier: 10,000 commands/day

Mitigation:
- Use appropriate TTLs
- Batch operations where possible
- Monitor usage

### Workflow DevKit Compatibility

Redis World requires BullMQ which uses TCP Redis.

Mitigation:
- Upstash provides HTTP REST API
- Test thoroughly on Cloudflare Workers
- Have fallback to Local World for development

### Breaking Changes

Task store migration could affect existing data.

Mitigation:
- Use different prefixes per agent
- Document migration path
- Keep `InMemoryTaskStore` as fallback

---

## Timeline

| Week | Phase | Deliverables |
|------|-------|--------------|
| 1 | Task Store Foundation | All workers use Redis task store |
| 2 | Workflow Foundation | dice-agent has durable workflow |
| 3 | High-Value Workflows | 4 agents have workflows |
| 4 | Platform Portability | Vercel example + docs |
| 5-6 | Unlock Deferred | 3 previously impossible examples |

---

## References

- [Task Store Integration Analysis](./TASKSTORE-INTEGRATION-ANALYSIS.md)
- [Workflow DevKit Integration Plan](./WORKFLOW-INTEGRATION-PLAN.md)
- [Python Examples Reference](./python-examples-reference/)
- [a2a-js-taskstores Repository](../../a2a-js-taskstores/)
- [Workflow DevKit Documentation](https://useworkflow.dev)
- [Upstash Redis](https://upstash.com/redis)

