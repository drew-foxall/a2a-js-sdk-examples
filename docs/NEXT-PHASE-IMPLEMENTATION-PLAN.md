# Next Phase Implementation Plan

## Executive Summary

This document outlines the next phase of development for our A2A examples, combining three key initiatives:

1. **Task Store Integration** - Replace `InMemoryTaskStore` with `UpstashRedisTaskStore` **where appropriate**
2. **Workflow DevKit Integration** - Add durability, observability, and fault tolerance
3. **Platform Portability** - Demonstrate same agent on multiple platforms

### Design Principle: Redis Where It Matters

**Not all workers need persistent task storage.** Simple, stateless agents work fine with `InMemoryTaskStore`. We use Redis selectively for agents that benefit from:
- Multi-turn conversation persistence
- Task history and observability  
- Multi-agent coordination
- Long-running operations

Examples that use **Upstash Redis** as the unified persistence layer:

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

### Current State: InMemoryTaskStore

All workers currently use `InMemoryTaskStore`, which is **fine for simple, stateless agents**:
- ✅ Simple request/response agents (hello-world, dice-agent)
- ✅ Single-turn interactions
- ✅ No external coordination required

However, some agents would benefit from persistent storage:
- ❌ Multi-turn conversations lost on restart
- ❌ Multi-agent coordination has no shared state
- ❌ Long-running operations can't be resumed
- ❌ No task history for observability

---

## Implementation Phases

### Phase 1: Task Store Foundation (Week 1) ✅ COMPLETE

**Goal**: Add `UpstashRedisTaskStore` to workers that **benefit from persistence**

#### Task Store Selection Criteria

| Criteria | Needs Redis | Keep InMemory |
|----------|-------------|---------------|
| Multi-turn conversations | ✅ | |
| Multi-agent coordination | ✅ | |
| Long-running operations | ✅ | |
| Task history/observability | ✅ | |
| Simple request/response | | ✅ |
| Single-turn interactions | | ✅ |
| Stateless operations | | ✅ |

#### Worker Classification

| Worker | Task Store | Status | Reason |
|--------|------------|--------|--------|
| `hello-world` | 🟢 InMemory | ✅ | Simple, stateless greeting |
| `dice-agent` | 🟢 InMemory | ✅ | Single-turn, no state needed |
| `currency-agent` | 🟢 InMemory | ✅ | Single-turn API call |
| `weather-agent` | 🟢 InMemory | ✅ | Single-turn API call |
| `github-agent` | 🟢 InMemory | ✅ | Single-turn API call |
| `analytics-agent` | 🟢 InMemory | ✅ | Single-turn chart generation |
| `content-planner` | 🟢 InMemory | ✅ | Single-turn outline generation |
| `contact-extractor` | 🟢 InMemory | ✅ | Single-turn extraction |
| `code-review` | 🟢 InMemory | ✅ | Single-turn analysis |
| **`travel-planner`** | 🔴 **Redis** | ✅ | Multi-agent orchestration, needs coordination |
| **`airbnb-agent`** | 🔴 **Redis** | ✅ | Part of multi-agent system |
| `number-game-alice` | 🟢 InMemory | ✅ | Custom JSON-RPC (no SDK task store) |
| `number-game-carol` | 🟢 InMemory | ✅ | Custom JSON-RPC (no SDK task store) |
| **`adversarial-defender`** | 🔴 **Redis** | ✅ | Conversation history for security testing |
| **`image-generator`** | 🔴 **Redis** | ✅ | Long-running DALL-E operations |
| **`expense-agent`** | 🔴 **Redis** | ✅ | Multi-step form handling |
| **`local-llm-chat`** | 🔴 **Redis** | ✅ | Chat history persistence |

**Summary**: 6 workers use Redis (with InMemory fallback), 11 workers stay with InMemory

#### Step 1.1: Prerequisites ✅ COMPLETE

- [x] Create Upstash Redis account (free tier)
- [x] Create Redis database for examples
- [x] Document credentials setup

#### Step 1.2: Update travel-planner (Proof of Concept) ✅ COMPLETE

The travel planner was the first proof of concept because it:
- Orchestrates multiple agents (weather, airbnb)
- Benefits from task coordination
- Demonstrates the full value of persistence

**Implementation Pattern** (used across all Redis-enabled workers):

```typescript
// examples/workers/travel-planner/src/index.ts
import { Redis } from "@upstash/redis";
import { UpstashRedisTaskStore } from "@drew-foxall/a2a-js-taskstore-upstash-redis";

function createTaskStore(env: PlannerEnv): TaskStore {
  // Use Redis if configured
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    const redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });

    return new UpstashRedisTaskStore({
      client: redis,
      prefix: "a2a:travel:",
      ttlSeconds: 86400 * 7, // 7 days
    });
  }

  // Fall back to in-memory for local development
  return new InMemoryTaskStore();
}
```

#### Step 1.3: Update Selected Workers ✅ COMPLETE

Applied Redis task store to workers that benefit:

| Worker | Prefix | Status | Reason |
|--------|--------|--------|--------|
| `travel-planner` | `a2a:travel:` | ✅ | Multi-agent orchestration |
| `airbnb-agent` | `a2a:airbnb:` | ✅ | Part of travel system |
| `adversarial-defender` | `a2a:adversarial:` | ✅ | Conversation history |
| `image-generator` | `a2a:image:` | ✅ | Long-running operations |
| `expense-agent` | `a2a:expense:` | ✅ | Multi-step forms |
| `local-llm-chat` | `a2a:local-llm:` | ✅ | Chat history persistence |

#### Step 1.4: Shared Utilities ✅ COMPLETE

Created shared Redis setup in `examples/workers/shared/redis.ts`:

```typescript
// examples/workers/shared/redis.ts
import { Redis } from "@upstash/redis/cloudflare";
import { UpstashRedisTaskStore } from "@drew-foxall/a2a-js-taskstore-upstash-redis";

export interface RedisEnv {
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
}

export function createRedisClient(env: RedisEnv): Redis { ... }
export function createRedisTaskStore(redis: Redis, options: RedisTaskStoreOptions): UpstashRedisTaskStore { ... }
export function isRedisConfigured(env: Partial<RedisEnv>): env is RedisEnv { ... }
```

#### Step 1.5: Documentation ✅ COMPLETE

- [x] Update `examples/workers/README.md` explaining when to use each task store
- [x] Add `.env.example` to `workers/shared` with Redis credential placeholders
- [x] Document wrangler secret commands

**Deliverables** ✅:
- [x] 6 workers updated to use `UpstashRedisTaskStore` (with InMemory fallback)
- [x] 11 workers remain with `InMemoryTaskStore` (appropriate for their use case)
- [x] Shared Redis utilities (`workers/shared/redis.ts`)
- [x] Documentation explaining task store selection

---

### Phase 2: Workflow DevKit Foundation (Week 2) ✅ COMPLETE

**Goal**: Add Workflow DevKit to dice-agent as proof of concept

#### Step 2.1: Add Dependencies ✅ COMPLETE

Dependencies added to `dice-agent-durable` worker:
- `workflow` (4.0.1-beta.24)
- `@drew-foxall/workflow-ai` (^0.1.0)
- `@drew-foxall/upstash-workflow-world` (0.1.0)

#### Step 2.2: Create Durable Steps ✅ COMPLETE

Created `examples/agents/src/agents/dice-agent/steps.ts`:

```typescript
import { checkPrime as checkPrimePure, rollDice as rollDicePure } from "./tools";

export async function rollDice(sides: number = 6): Promise<number> {
  "use step";
  return rollDicePure(sides);
}

export async function checkPrime(numbers: number[]): Promise<string> {
  "use step";
  return checkPrimePure(numbers);
}
```

#### Step 2.3: Create Workflow ✅ COMPLETE

Created `examples/agents/src/agents/dice-agent/workflow.ts`:

```typescript
import { DurableAgent } from "@drew-foxall/workflow-ai/agent";
import type { ModelMessage, UIMessageChunk } from "ai";
import { getWritable } from "workflow";
import { rollDice, checkPrime } from "./steps";

export async function diceAgentWorkflow(messages: ModelMessage[]): Promise<{ messages: ModelMessage[] }> {
  "use workflow";
  
  const writable = getWritable<UIMessageChunk>();
  const agent = new DurableAgent({
    model: "openai/gpt-4o-mini",
    system: getDiceAgentPrompt(),
    tools: {
      rollDice: { description: "...", inputSchema: rollDiceSchema, execute: async (params) => { ... } },
      checkPrime: { description: "...", inputSchema: checkPrimeSchema, execute: async (params) => { ... } },
    },
  });
  
  return agent.stream({ messages, writable });
}
```

#### Step 2.4: Create Durable Worker ✅ COMPLETE

Created `examples/workers/dice-agent-durable/` with:
- Full A2A protocol support
- Redis task store (via `a2a-workers-shared`)
- Workflow DevKit routes (`/.well-known/workflow/v1/step`, `/.well-known/workflow/v1/flow`)
- Upstash Workflow World integration

#### Step 2.5: Test Durability ✅ COMPLETE

Created `examples/workers/dice-agent-durable/test/durability.test.ts` with tests for:
- Health check (reports durableWorkflow status)
- Task persistence in Redis
- Task retrieval by ID
- Concurrent request handling
- Workflow DevKit endpoints
- Agent card discovery

**Run tests**: `pnpm --filter a2a-dice-agent-durable-worker test`

**Deliverables** ✅:
- [x] `dice-agent` has `steps.ts` and `workflow.ts`
- [x] `dice-agent-durable` worker with Workflow DevKit integration
- [x] Durability tests covering task persistence and workflow endpoints

---

### Phase 3: High-Value Workflows (Week 3) ✅ COMPLETE

**Goal**: Apply Workflow DevKit to agents that benefit most

#### Priority Agents

| Agent | Why Workflow Helps | Effort | Status |
|-------|-------------------|--------|--------|
| `travel-planner-multiagent` | Parallel A2A calls with retry | High | ✅ |
| `image-generator` | Long-running generation | Medium | ✅ |
| `adversarial` | Conversation persistence | Medium | Deferred |
| `code-review` | External tool retries | Medium | Deferred |

#### Step 3.1: Image Generator Workflow ✅ COMPLETE

Created durable workflow for image generation with DALL-E:

**Files created:**
- `examples/agents/src/agents/image-generator/steps.ts` - Durable DALL-E API step
- `examples/agents/src/agents/image-generator/workflow.ts` - DurableAgent workflow
- `examples/workers/image-generator-durable/` - New durable worker

```typescript
// examples/agents/src/agents/image-generator/steps.ts
export async function generateImage(params: GenerateImageParams, apiKey: string): Promise<GenerateImageResult> {
  "use step";
  // DALL-E API call with automatic retry and caching
}
```

```typescript
// examples/agents/src/agents/image-generator/workflow.ts
export async function imageGeneratorWorkflow(messages: ModelMessage[], apiKey: string): Promise<{ messages: ModelMessage[] }> {
  "use workflow";
  
  const agent = new DurableAgent({
    model: "openai/gpt-4o-mini",
    system: getImageGeneratorPrompt(),
    tools: {
      generate_image: {
        execute: async (params) => generateImage(params, apiKey), // Durable step
      },
    },
  });
  
  return agent.stream({ messages, writable });
}
```

#### Step 3.2: Travel Planner Workflow ✅ COMPLETE

Created durable workflow for multi-agent travel planning:

**Files created:**
- `examples/agents/src/agents/travel-planner-multiagent/planner/steps.ts` - Durable sub-agent calls
- `examples/agents/src/agents/travel-planner-multiagent/planner/workflow.ts` - DurableAgent workflow
- `examples/workers/travel-planner-durable/` - New durable worker

```typescript
// examples/agents/src/agents/travel-planner-multiagent/planner/steps.ts
export async function callSubAgent(agentUrl: string, task: string, options?: SendMessageOptions): Promise<SendMessageResult> {
  "use step";
  // A2A sub-agent call with automatic retry
}

export async function discoverSubAgent(url: string): Promise<DiscoveryResult> {
  "use step";
  // Agent discovery with caching
}
```

```typescript
// examples/agents/src/agents/travel-planner-multiagent/planner/workflow.ts
export async function travelPlannerWorkflow(messages: ModelMessage[], config: TravelPlannerWorkflowConfig): Promise<{ messages: ModelMessage[] }> {
  "use workflow";
  
  // Phase 1: Discover sub-agents (durable steps)
  for (const url of agentUrls) {
    await discoverSubAgent(url);  // Cached on restart
  }
  
  // Phase 2: DurableAgent with sendMessage tool
  const agent = new DurableAgent({
    tools: {
      sendMessage: {
        execute: async (params) => callSubAgent(targetAgent.url, task, options), // Durable
      },
    },
  });
  
  return agent.stream({ messages, writable });
}
```

**Deliverables** ✅:
- [x] `image-generator` has `steps.ts` and `workflow.ts`
- [x] `image-generator-durable` worker created
- [x] `travel-planner-multiagent` has `steps.ts` and `workflow.ts`
- [x] `travel-planner-durable` worker created

#### Step 3.3: DurableA2AAdapter ✅ COMPLETE

Created `DurableA2AAdapter` in `@drew-foxall/a2a-ai-sdk-adapter` to bridge durable workflows with A2A protocol:

```typescript
// packages/a2a-ai-sdk-adapter/src/durable-adapter.ts
import { DurableA2AAdapter } from "@drew-foxall/a2a-ai-sdk-adapter";
import { diceAgentWorkflow } from "a2a-agents";

// Bridge durable workflow to A2A protocol
const executor = new DurableA2AAdapter(diceAgentWorkflow, {
  workingMessage: "Rolling dice (with durability)...",
});

// For workflows with additional arguments:
const imageExecutor = new DurableA2AAdapter<[string]>(imageGeneratorWorkflow, {
  workflowArgs: [env.OPENAI_API_KEY],
  workingMessage: "Generating image...",
});
```

The adapter:
- Converts A2A `Message` to AI SDK `ModelMessage[]`
- **Invokes the workflow via `start()` from `workflow/api`** - This is critical for durability!
- Awaits `run.returnValue` to get the result (polls until workflow completes)
- Converts workflow output back to A2A protocol events
- Handles task lifecycle (submitted → working → completed/failed)

**Key Architecture Decision:** Durability requires three layers working together:
1. **`start()` from `workflow/api`** - Creates run in World, queues execution
2. **World** (e.g., `@drew-foxall/upstash-workflow-world`) - Persists runs, steps, events
3. **`DurableAgent` from `@drew-foxall/workflow-ai/agent`** - AI SDK integration with `"use step"` internally

Calling a workflow function directly does NOT provide durability - the `DurableA2AAdapter` handles invoking via `start()` correctly.

---

### Phase 4: Platform Portability (Week 4) ✅ COMPLETE

**Goal**: Demonstrate same agent on multiple platforms

#### Implemented Structure

```
examples/
├── workers/
│   └── dice-agent/              # Cloudflare Workers
│
└── vercel/
    └── dice-agent/              # Vercel Edge Functions
        ├── api/index.ts        # Edge function handler
        ├── package.json
        ├── vercel.json
        └── tsconfig.json
```

#### Step 4.1: Vercel Edge Example ✅ COMPLETE

Created `examples/vercel/dice-agent/` with:
- Full A2A protocol support via Hono
- Same agent logic (`createDiceAgent` from `a2a-agents`)
- Redis task store support (same config as Cloudflare)
- Health check endpoint reporting platform info

**Key insight: Code is 95% identical!**

```typescript
// This line is IDENTICAL across both platforms:
import { createDiceAgent } from "a2a-agents";
const agent = createDiceAgent(model);
```

What differs:
- Environment access: `c.env.VAR` (Cloudflare) vs `process.env.VAR` (Vercel)
- Export: `export default app` vs `export default app.fetch`
- Config: `wrangler.toml` vs `vercel.json`

#### Step 4.2: Documentation ✅ COMPLETE

Created comprehensive platform comparison:
- `docs/PLATFORM-PORTABILITY.md` - Full migration and comparison guide
- `examples/vercel/README.md` - Vercel-specific documentation
- `examples/vercel/dice-agent/README.md` - Agent-specific guide

**Deliverables** ✅:
- [x] `dice-agent` Vercel Edge example (`examples/vercel/dice-agent/`)
- [x] Platform comparison documentation (`docs/PLATFORM-PORTABILITY.md`)
- [x] Deployment guides for each platform
- [x] Updated `pnpm-workspace.yaml` to include Vercel examples

---

### Phase 5: Unlock Deferred Examples (Week 5-6) ✅ TELEMETRY COMPLETE

**Goal**: Implement previously impossible examples using Workflow DevKit + Pluggable Telemetry

#### Telemetry (Example 19) ✅ COMPLETE

**Approach Changed**: Instead of locking into Workflow DevKit's observability, we created a **pluggable telemetry abstraction** that supports multiple backends:

**Files Created:**
- `examples/agents/src/shared/telemetry/types.ts` - Core interfaces (Span, TelemetryProvider)
- `examples/agents/src/shared/telemetry/console.ts` - Console provider (dev)
- `examples/agents/src/shared/telemetry/noop.ts` - NoOp provider (prod, disabled)
- `examples/agents/src/shared/telemetry/opentelemetry.ts` - OTEL integration
- `examples/agents/src/shared/telemetry/index.ts` - Factory functions
- `examples/agents/src/agents/dice-agent/instrumented.ts` - Example instrumented agent
- `docs/TELEMETRY.md` - Comprehensive documentation

**Supported Providers:**

| Provider | Use Case | Overhead |
|----------|----------|----------|
| `console` | Development, debugging | Low |
| `noop` | Production when disabled | Zero |
| `opentelemetry` | Full observability stack | Medium |
| `custom` | Bring your own | Varies |

**Usage Example:**

```typescript
import { createTelemetry, AgentAttributes, SpanNames } from "a2a-agents";

// Console for development
const telemetry = createTelemetry({
  provider: "console",
  serviceName: "dice-agent",
  format: "pretty",
});

// OpenTelemetry for production
const prodTelemetry = createTelemetry({
  provider: "opentelemetry",
  serviceName: "dice-agent",
});

// Use in agent
const span = telemetry.startSpan(SpanNames.AGENT_EXECUTE_TOOL, {
  attributes: { [AgentAttributes.TOOL_NAME]: "rollDice" },
});
```

**Workflow DevKit Integration**: The pluggable telemetry is complementary to Workflow DevKit observability:
- Workflow DevKit: Durable execution traces, step history, retry visibility
- Our Telemetry: Detailed operation spans, custom metrics, log correlation

#### Auth Flows (Example 18) ✅ COMPLETE

CIBA (Client-Initiated Backchannel Authentication) patterns implemented with:
- Pluggable `AuthProvider` interface (Auth0, Okta, custom)
- `MockAuthProvider` for development/testing
- Durable polling with `completeCIBAFlow()` step
- Edge-compatible (no `nodejs_compat` required)
- **Aligned with [Auth0 + Google Cloud A2A Partnership](https://auth0.com/blog/auth0-google-a2a/)**

**Security Schemes (A2A Spec Section 4.5):**
- `OAuth2SecurityScheme` with `ClientCredentialsOAuthFlow` for agent-to-agent auth
- `HTTPAuthSecurityScheme` (Bearer) for pre-obtained JWTs
- `OpenIdConnectSecurityScheme` for CIBA/OIDC flows

**Files Created:**
- `examples/agents/src/agents/auth-agent/` - Agent implementation
  - `types.ts` - OAuth2/CIBA type definitions
  - `providers/mock.ts` - Mock auth provider
  - `steps.ts` - Durable steps for auth operations
  - `agent.ts` - Tool-based auth agent
- `examples/agents/src/shared/security-schemes.ts` - Reusable security scheme types
- `examples/workers/auth-agent/` - Cloudflare Worker

**Usage:**

```typescript
import { createAuthAgent, createDevAuthProvider } from "a2a-agents";

const authProvider = createDevAuthProvider(); // Mock for dev
const agent = createAuthAgent({
  model: openai.chat("gpt-4o-mini"),
  authProvider,
});

// User asks for sensitive data
// → Agent initiates CIBA
// → User receives push notification
// → User approves
// → Agent accesses data with token
```

#### MCP Registry (Example 06) ✅ COMPLETE

Implemented MCP-based agent registry with:
- `AgentRegistry` class for dynamic agent registration and capability-based search
- `MCPRegistryServer` implementing full MCP protocol (tools + resources)
- `MCPRegistryOrchestrator` for plan execution with automatic re-planning on failure
- Cloudflare Worker (`workers/mcp-registry/`) with REST + MCP endpoints
- Redis persistence via Upstash for registered agents

**Files Created:**
- `examples/agents/src/agents/mcp-registry/types.ts` - Type definitions
- `examples/agents/src/agents/mcp-registry/registry.ts` - Agent registry implementation
- `examples/agents/src/agents/mcp-registry/mcp-server.ts` - MCP protocol server
- `examples/agents/src/agents/mcp-registry/orchestrator.ts` - Task orchestrator with re-planning
- `examples/agents/src/agents/mcp-registry/index.ts` - Public exports
- `examples/workers/mcp-registry/` - Cloudflare Worker deployment

**Deliverables** ✅:
- [x] Pluggable telemetry abstraction (`TelemetryProvider` interface)
- [x] Console provider for development
- [x] NoOp provider for production (zero overhead)
- [x] OpenTelemetry provider for full observability
- [x] Semantic conventions (AgentAttributes, SpanNames)
- [x] Instrumented agent example (`dice-agent/instrumented.ts`)
- [x] Documentation (`docs/TELEMETRY.md`)
- [ ] Auth flow example with durable sleep (deferred)
- [x] MCP Registry with state persistence

---

## Implementation Checklist

### Phase 1: Task Store Foundation ✅ COMPLETE
- [x] Create Upstash Redis account
- [x] Update `travel-planner` worker with Redis task store (PoC)
- [x] Create shared Redis utilities (`workers/shared/redis.ts`)
- [x] Update 5 additional workers that benefit from persistence (airbnb, adversarial, image, expense, local-llm)
- [x] Document task store selection criteria

### Phase 2: Workflow DevKit Foundation ✅ COMPLETE
- [x] Add Workflow DevKit dependencies (`workflow`, `@drew-foxall/workflow-ai`, `@drew-foxall/upstash-workflow-world`)
- [x] Create `dice-agent/steps.ts`
- [x] Create `dice-agent/workflow.ts`
- [x] Create `dice-agent-durable` worker
- [x] Create durability tests (`durability.test.ts`)

### Phase 3: High-Value Workflows ✅ COMPLETE
- [x] Add workflow to `image-generator` (steps.ts, workflow.ts)
- [x] Create `image-generator-durable` worker
- [x] Add workflow to `travel-planner-multiagent` (steps.ts, workflow.ts)
- [x] Create `travel-planner-durable` worker
- [ ] Add workflow to `adversarial` (deferred)
- [ ] Add workflow to `code-review` (deferred)

### Phase 4: Platform Portability ✅ COMPLETE
- [x] Create `dice-agent` Vercel Edge example (`examples/vercel/dice-agent/`)
- [x] Document platform comparison (`docs/PLATFORM-PORTABILITY.md`)
- [x] Add deployment guides (in README files)
- [x] Update `pnpm-workspace.yaml` for Vercel examples

### Phase 5: Unlock Deferred Examples ✅ TELEMETRY COMPLETE
- [x] Design pluggable telemetry abstraction (`TelemetryProvider` interface)
- [x] Create telemetry providers (Console, NoOp, OpenTelemetry)
- [x] Create instrumented agent example (`dice-agent/instrumented.ts`)
- [x] Document telemetry system (`docs/TELEMETRY.md`)
- [ ] Implement auth flow with durable sleep (deferred)
- [x] Implement MCP registry with state persistence

---

## Success Criteria

### Phase 1 Complete When: ✅ DONE
- [x] 6 workers use `UpstashRedisTaskStore` (those that benefit, with fallback)
- [x] 11 workers remain with `InMemoryTaskStore` (appropriate for use case)
- [x] Multi-agent coordination works (travel-planner)
- [x] Shared Redis utilities created
- [ ] Multi-turn game state persists (number-game uses custom JSON-RPC, not SDK task store)

### Phase 2 Complete When: ✅ DONE
- [x] `dice-agent` has durable workflow (`steps.ts`, `workflow.ts`)
- [x] `dice-agent-durable` worker has Workflow DevKit routes
- [x] Task persistence tested via `durability.test.ts`
- [x] Worker supports both Redis and InMemory fallback

### Phase 3 Complete When: ✅ DONE
- [x] Multi-agent travel planner is durable (`travel-planner-durable` worker)
- [x] Image generator handles timeouts (`image-generator-durable` worker)
- [x] Both agents have `steps.ts` and `workflow.ts` with durable operations
- [ ] Observability shows multi-agent traces (requires deployed Workflow World)

### Phase 4 Complete When: ✅ DONE
- [x] Same agent runs on Cloudflare + Vercel (`examples/workers/dice-agent` + `examples/vercel/dice-agent`)
- [x] Same Redis backend for both (Upstash Redis with platform-specific prefixes)
- [x] Documentation shows comparison (`docs/PLATFORM-PORTABILITY.md`)

### Phase 5 Complete When: ✅ TELEMETRY DONE
- [x] Pluggable telemetry abstraction created
- [x] Multiple providers (Console, NoOp, OpenTelemetry) implemented
- [x] Semantic conventions defined (AgentAttributes, SpanNames)
- [x] Instrumented agent example works
- [x] Documentation complete (`docs/TELEMETRY.md`)
- [ ] Auth flow example with CIBA (deferred)
- [x] MCP Registry with re-planning

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
| 1 | Task Store Foundation | 7 workers use Redis task store (where appropriate) |
| 2 | Workflow Foundation | travel-planner has durable workflow |
| 3 | High-Value Workflows | 4 agents have workflows |
| 4 | Platform Portability | Vercel example + docs |
| 5-6 | Unlock Deferred | 3 previously impossible examples |

---

## References

- [Task Store Integration Analysis](./TASKSTORE-INTEGRATION-ANALYSIS.md)
- [Workflow DevKit Integration Plan](./WORKFLOW-INTEGRATION-PLAN.md)
- [Platform Portability Guide](./PLATFORM-PORTABILITY.md)
- [Pluggable Telemetry Guide](./TELEMETRY.md)
- [Python Examples Reference](./python-examples-reference/)
- [a2a-js-taskstores Repository](../../a2a-js-taskstores/)
- [Workflow DevKit Documentation](https://useworkflow.dev)
- [Upstash Redis](https://upstash.com/redis)
- [Vercel Edge Functions](https://vercel.com/docs/functions/edge-functions)
- [OpenTelemetry JavaScript](https://opentelemetry.io/docs/languages/js/)

