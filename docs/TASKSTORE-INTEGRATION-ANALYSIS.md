# Task Store Integration Analysis

## Executive Summary

The `a2a-js-taskstores` repository provides **edge-compatible persistent task storage adapters** for the A2A JavaScript SDK. These adapters are a critical piece of our worker infrastructure, addressing the fundamental limitation of our current examples: **in-memory task storage**.

### Design Decision: Redis-First Approach

**For simplicity of demonstration, all examples will use Upstash Redis as the common persistence layer.**

This decision enables us to:
- **Focus on worker configurations** - Different platforms (Cloudflare, Vercel, AWS) with the same storage
- **Maximize portability** - Upstash Redis works everywhere via HTTP (no TCP required)
- **Unify persistence** - Same backend for Task Stores AND Workflow DevKit (Redis World)
- **Simplify setup** - One service, one set of credentials across all examples

### Current State

Our worker examples (e.g., `dice-agent`) use `InMemoryTaskStore`:

```typescript
// examples/workers/dice-agent/src/index.ts
const taskStore: TaskStore = new InMemoryTaskStore();
const requestHandler = new DefaultRequestHandler(agentCard, taskStore, agentExecutor);
```

This means:
- **Tasks are lost** when the worker restarts
- **No multi-turn conversations** can persist across requests
- **No task history** is maintained for observability
- **Push notifications** cannot be configured persistently

### Solution: Upstash Redis Task Store

All examples will use `@drew-foxall/a2a-js-taskstore-upstash-redis`:

```typescript
import { Redis } from "@upstash/redis";
import { UpstashRedisTaskStore } from "@drew-foxall/a2a-js-taskstore-upstash-redis";

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

const taskStore = new UpstashRedisTaskStore({
  client: redis,
  prefix: 'a2a:dice:',
  ttlSeconds: 86400 * 7, // 7 days
});
```

### Available Adapters (Reference)

While we standardize on Redis, other adapters exist for specific use cases:

| Adapter | Backend | Use Case |
|---------|---------|----------|
| `upstash-redis` | Upstash Redis (HTTP) | **Our default** - portable, edge-compatible |
| `cloudflare-kv` | Cloudflare KV | Cloudflare-only, eventual consistency |
| `cloudflare-d1` | Cloudflare D1 (SQLite) | Cloudflare-only, complex queries |
| `dynamodb` | AWS DynamoDB | AWS-only deployments |
| `drizzle` | PostgreSQL/MySQL/SQLite | Existing database infrastructure |

---

## Relationship to Python Examples

### Python Task Persistence Patterns

From our [Python examples reference](./python-examples-reference/), the Python A2A samples demonstrate:

1. **Session Management** (Examples 03, 09): Multi-turn conversations track `session_id` or `context_id`
2. **Task State Transitions** (All examples): `submitted → working → completed`
3. **Push Notifications** (Example 19): Telemetry and webhook callbacks
4. **History Tracking** (Examples 04, 22): Multi-agent orchestration requires task history

### Mapping to Our Implementation

| Python Pattern | Current JS Implementation | With Task Stores |
|----------------|---------------------------|------------------|
| Session persistence | ❌ Lost on restart | ✅ Persisted |
| Task state queries | ❌ Not available | ✅ `loadByStatus()` |
| Context grouping | ❌ Not available | ✅ `loadByContextId()` |
| Push notifications | ❌ In-memory only | ✅ `PushNotificationStore` |

### Examples That Benefit Most

| # | Example | Why Task Stores Help |
|---|---------|---------------------|
| 09 | LangGraph Currency | Multi-turn requires session persistence |
| 04 | Multi-Agent Travel | Task history for orchestration |
| 19 | Telemetry | Push notification configs must persist |
| 22 | Adversarial | Conversation history for security testing |
| 13 | File Chat | Large file context needs persistence |

---

## Relationship to Workflow DevKit

The [Workflow Integration Plan](./WORKFLOW-INTEGRATION-PLAN.md) introduces **durability at the workflow level**. Task stores and Workflow DevKit serve **complementary purposes**:

### Layer Comparison

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        WORKFLOW DEVKIT                                   │
│  - Workflow execution durability                                         │
│  - Step retry and caching                                               │
│  - Observability via traces                                             │
│  - Uses "World" for persistence (Redis, Postgres, Vercel)               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Orchestrates
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        A2A TASK STORES                                   │
│  - A2A protocol task persistence                                         │
│  - Task state and history                                               │
│  - Push notification configs                                            │
│  - Uses storage adapters (KV, D1, Redis, DynamoDB)                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Stores
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        STORAGE BACKEND                                   │
│  Cloudflare KV | D1 | Upstash Redis | DynamoDB | PostgreSQL             │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Insight: Shared Redis Backend

Both Workflow DevKit (via Redis World) and Task Stores (via Upstash Redis) can use **the same Upstash Redis instance**:

```typescript
// Shared Redis client
const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

// Task Store uses Redis for A2A tasks
const taskStore = new UpstashRedisTaskStore({
  client: redis,
  prefix: 'a2a:',
  ttlSeconds: 86400 * 7,
});

// Workflow DevKit uses Redis World for workflow state
// Configured via WORKFLOW_TARGET_WORLD=@workflow-worlds/redis
```

This means:
- **One Redis instance** serves both purposes
- **Different key prefixes** prevent collisions (`a2a:` vs `workflow:`)
- **Cost-effective** for examples and small deployments

---

## Integration Approach

### Unified Redis Architecture

All examples use the same pattern - Upstash Redis for both Task Store and Workflow DevKit:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         WORKER (Any Platform)                            │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  Cloudflare Worker | Vercel Edge | AWS Lambda | Deno Deploy         ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP (REST API)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         UPSTASH REDIS                                    │
│  ┌─────────────────────────┐  ┌─────────────────────────────────────┐  │
│  │  Task Store             │  │  Workflow DevKit (Redis World)      │  │
│  │  prefix: a2a:{agent}:   │  │  prefix: workflow:                  │  │
│  │  - Task state           │  │  - Workflow runs                    │  │
│  │  - Message history      │  │  - Step results                     │  │
│  │  - Push configs         │  │  - Job queue (BullMQ)               │  │
│  └─────────────────────────┘  └─────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Phase 1: Replace InMemoryTaskStore

Update all workers to use Upstash Redis:

```typescript
// Before (current)
import { InMemoryTaskStore } from "@drew-foxall/a2a-js-sdk/server";
const taskStore = new InMemoryTaskStore();

// After (with Upstash Redis)
import { Redis } from "@upstash/redis";
import { UpstashRedisTaskStore } from "@drew-foxall/a2a-js-taskstore-upstash-redis";

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

const taskStore = new UpstashRedisTaskStore({
  client: redis,
  prefix: 'a2a:dice:',
  ttlSeconds: 86400 * 7, // 7 days
});
```

### Phase 2: Add Workflow DevKit

Same Redis instance, different prefix:

```typescript
// examples/workers/dice-agent-durable/src/index.ts

import { Hono } from "hono";
import { Redis } from "@upstash/redis";
import { start } from "workflow/api";
import { UpstashRedisTaskStore } from "@drew-foxall/a2a-js-taskstore-upstash-redis";
import { diceAgentWorkflow } from "a2a-agents/dice-agent/workflow";

const app = new Hono<{ Bindings: Env }>();

app.all("/*", async (c, next) => {
  // Single Redis client for both purposes
  const redis = new Redis({
    url: c.env.UPSTASH_REDIS_REST_URL,
    token: c.env.UPSTASH_REDIS_REST_TOKEN,
  });

  // A2A Task Store (protocol-level persistence)
  const taskStore = new UpstashRedisTaskStore({
    client: redis,
    prefix: 'a2a:dice:',
    ttlSeconds: 86400 * 7,
  });

  // Workflow DevKit (execution durability)
  // Uses same Redis via WORKFLOW_TARGET_WORLD=@workflow-worlds/redis
  
  // ... A2A handler that uses taskStore and triggers workflow
});
```

### Phase 3: Demonstrate Platform Portability

The same agent code deploys to multiple platforms with identical Redis config:

| Platform | Worker Config | Redis Config |
|----------|---------------|--------------|
| Cloudflare Workers | `wrangler.toml` | Same Upstash credentials |
| Vercel Edge | `vercel.json` | Same Upstash credentials |
| AWS Lambda | `template.yaml` | Same Upstash credentials |
| Deno Deploy | `deno.json` | Same Upstash credentials |

This is the **key demonstration**: agent logic is portable, only worker configuration changes.

---

## Implementation Checklist

### Prerequisites

- [ ] Create Upstash Redis instance (free tier available)
- [ ] Add `@drew-foxall/a2a-js-taskstore-upstash-redis` to worker dependencies
- [ ] Add `@upstash/redis` to worker dependencies
- [ ] Configure environment variables for all platforms

### Environment Variables (All Platforms)

```bash
# Required for Task Store
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxx...

# Required for Workflow DevKit (when enabled)
WORKFLOW_TARGET_WORLD=@workflow-worlds/redis
```

### Worker Updates

For each worker:

1. [ ] Replace `InMemoryTaskStore` with `UpstashRedisTaskStore`
2. [ ] Add Redis environment variables
3. [ ] Update environment type definitions
4. [ ] Test task persistence across restarts
5. [ ] Document Upstash setup in worker README

### Example: dice-agent Update

```toml
# wrangler.toml (Cloudflare)
[vars]
# Non-secret config here

# Secrets via: wrangler secret put UPSTASH_REDIS_REST_URL
# Secrets via: wrangler secret put UPSTASH_REDIS_REST_TOKEN
```

```typescript
// src/index.ts
import { Redis } from "@upstash/redis";
import { UpstashRedisTaskStore } from "@drew-foxall/a2a-js-taskstore-upstash-redis";

type Bindings = {
  OPENAI_API_KEY: string;
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
};

app.all("/*", async (c, next) => {
  const redis = new Redis({
    url: c.env.UPSTASH_REDIS_REST_URL,
    token: c.env.UPSTASH_REDIS_REST_TOKEN,
  });

  const taskStore = new UpstashRedisTaskStore({
    client: redis,
    prefix: 'a2a:dice:',
    ttlSeconds: 86400 * 7,
  });
  
  const requestHandler = new DefaultRequestHandler(agentCard, taskStore, agentExecutor);
  // ...
});
```

---

## Type Safety & Validation

The task stores use Zod schemas for runtime validation, matching our project's approach:

```typescript
// From @drew-foxall/a2a-js-taskstore-core
import { TaskSchema, parseTask, safeParseTask } from '@drew-foxall/a2a-js-taskstore-core';

// Safe parsing (returns undefined on failure)
const task = safeParseTask(jsonString);

// Strict parsing (throws on invalid)
const task = parseTask(jsonString);

// Direct schema access
const isValid = TaskSchema.safeParse(unknownData).success;
```

This aligns with our "no unsafe casting" principle - all data from storage is validated at runtime.

---

## Summary

The `a2a-js-taskstores` repository provides the **missing persistence layer** for our A2A worker examples. Combined with Workflow DevKit:

| Layer | Purpose | Repository |
|-------|---------|------------|
| **Workflow DevKit** | Execution durability, retries, observability | `workflow-examples` |
| **Task Stores** | A2A protocol persistence, task history | `a2a-js-taskstores` |
| **A2A SDK** | Protocol implementation, message handling | `a2a-js` |
| **AI SDK** | Agent logic, tool execution | `ai` |

Together, these form a complete stack for building production-ready A2A agents on edge platforms.

---

## Next Steps

1. **Immediate**: Update `dice-agent` worker to use `UpstashRedisTaskStore`
2. **Short-term**: Update all remaining workers to use Redis
3. **Medium-term**: Add Workflow DevKit with shared Redis World
4. **Long-term**: Demonstrate same agent on multiple platforms (Cloudflare, Vercel, AWS)

---

## Platform-Specific Examples (Future)

Once Redis is integrated, we can demonstrate the same agent on different platforms:

```
examples/workers/
├── dice-agent/                    # Current (Cloudflare)
├── dice-agent-vercel/             # Same agent, Vercel Edge
├── dice-agent-aws/                # Same agent, AWS Lambda
└── dice-agent-deno/               # Same agent, Deno Deploy
```

Each uses:
- Same agent logic from `a2a-agents`
- Same Upstash Redis for persistence
- Different platform-specific configuration

This demonstrates the **portability** of the A2A + AI SDK + Redis stack.

---

## References

- [a2a-js-taskstores Repository](../../../a2a-js-taskstores/)
- [Workflow Integration Plan](./WORKFLOW-INTEGRATION-PLAN.md)
- [Python Examples Reference](./python-examples-reference/)
- [A2A JS SDK Issue #114](https://github.com/a2aproject/a2a-js/issues/114)
- [Upstash Redis](https://upstash.com/redis)

