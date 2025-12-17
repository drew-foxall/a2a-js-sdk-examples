# A2A Agents on Cloudflare Workers

Deploy A2A protocol agents to the edge with Cloudflare Workers. This directory demonstrates how to run AI agents globally with low latency, including a multi-agent system using Service Bindings for secure worker-to-worker communication.

## 🎯 Why Cloudflare Workers?

| Feature | Benefit |
|---------|---------|
| **Global Edge Network** | Agents run in 300+ locations worldwide |
| **Zero Cold Starts** | Sub-millisecond startup times |
| **Service Bindings** | Private worker-to-worker calls (no public URLs) |
| **Generous Free Tier** | 100,000 requests/day free |
| **Built-in Secrets** | Secure API key management |

---

## 📁 Directory Structure

```
workers/
├── shared/                    # 🔧 Shared utilities
│   ├── types.ts              # Environment type definitions
│   ├── utils.ts              # Model provider setup (OpenAI, Anthropic, Google)
│   ├── redis.ts              # Upstash Redis task store utilities
│   └── package.json          # Shared dependencies
│
├── hello-world/              # 👋 Simple A2A agent
├── dice-agent/               # 🎲 Tool-using agent
├── dice-agent-durable/       # 🎲⚡ Durable dice agent (Workflow DevKit)
├── currency-agent/           # 💱 External API integration
│
├── weather-agent/            # 🌤️ Weather specialist (PRIVATE)
├── airbnb-agent/             # 🏠 Airbnb specialist (PRIVATE)
├── airbnb-mcp-server/        # 🔌 MCP server for Airbnb data
│
├── travel-planner/           # ✈️ Multi-agent orchestrator (PUBLIC)
├── travel-planner-durable/   # ✈️⚡ Durable orchestrator (Workflow DevKit)
│
├── image-generator/          # 🎨 DALL-E image generation
└── image-generator-durable/  # 🎨⚡ Durable image generator (Workflow DevKit)
```

---

## 🏗️ Architecture Overview

### Simple Agents (Public)

Simple agents are directly accessible from the internet:

```
┌──────────────────────────────────────────────────────────────────┐
│                        PUBLIC INTERNET                            │
│                                                                   │
│    User/Client ──────► A2A Inspector ──────► Your Application    │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             │ HTTPS (A2A Protocol)
                             │
                             ▼
              ┌─────────────────────────────┐
              │     Cloudflare Workers      │
              │         (Edge)              │
              ├─────────────────────────────┤
              │  ┌───────────────────────┐  │
              │  │   Hello World Agent  │  │  ◄── Public endpoint
              │  │   /message/send      │  │
              │  └───────────────────────┘  │
              │                             │
              │  ┌───────────────────────┐  │
              │  │     Dice Agent       │  │  ◄── Public endpoint
              │  │   /message/send      │  │
              │  └───────────────────────┘  │
              │                             │
              │  ┌───────────────────────┐  │
              │  │   Currency Agent     │  │  ◄── Public endpoint
              │  │   /message/send      │  │
              │  └───────────────────────┘  │
              └─────────────────────────────┘
```

### Multi-Agent System (Service Bindings)

The Travel Planner demonstrates a sophisticated multi-agent architecture:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           PUBLIC INTERNET                                 │
│                                                                          │
│   "Plan a trip to Paris"                                                 │
│         │                                                                │
└─────────┼────────────────────────────────────────────────────────────────┘
          │
          │ HTTPS (A2A Protocol)
          │
          ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        CLOUDFLARE EDGE NETWORK                            │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                      TRAVEL PLANNER                                 │  │
│  │                     (Orchestrator)                                  │  │
│  │                                                                     │  │
│  │   "I need weather data for Paris and accommodation options..."     │  │
│  │                                                                     │  │
│  │              ┌─────────────┴─────────────┐                         │  │
│  │              │                           │                         │  │
│  │              ▼                           ▼                         │  │
│  │   ┌─────────────────┐         ┌─────────────────┐                  │  │
│  │   │ Service Binding │         │ Service Binding │                  │  │
│  │   │ WEATHER_AGENT   │         │ AIRBNB_AGENT    │                  │  │
│  │   └────────┬────────┘         └────────┬────────┘                  │  │
│  └────────────┼───────────────────────────┼───────────────────────────┘  │
│               │                           │                              │
│               │ Internal (no public URL)  │ Internal (no public URL)     │
│               │                           │                              │
│               ▼                           ▼                              │
│  ┌─────────────────────┐     ┌─────────────────────┐                    │
│  │   WEATHER AGENT     │     │   AIRBNB AGENT      │                    │
│  │   (Specialist)      │     │   (Specialist)      │                    │
│  │                     │     │                     │                    │
│  │  🔒 INTERNAL_ONLY   │     │  🔒 INTERNAL_ONLY   │                    │
│  │                     │     │         │           │                    │
│  │  ┌───────────────┐  │     │         │           │                    │
│  │  │ Open-Meteo    │  │     │         ▼           │                    │
│  │  │ Weather API   │  │     │  ┌─────────────┐    │                    │
│  │  └───────────────┘  │     │  │ Service     │    │                    │
│  │                     │     │  │ Binding     │    │                    │
│  └─────────────────────┘     │  │ AIRBNB_MCP  │    │                    │
│                              │  └──────┬──────┘    │                    │
│                              └─────────┼───────────┘                    │
│                                        │                                │
│                                        ▼                                │
│                              ┌─────────────────────┐                    │
│                              │  AIRBNB MCP SERVER  │                    │
│                              │                     │                    │
│                              │  🔒 INTERNAL_ONLY   │                    │
│                              │                     │                    │
│                              │  Web scraping for   │                    │
│                              │  real Airbnb data   │                    │
│                              └─────────────────────┘                    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

Legend:
  ─────►  Public HTTPS request (A2A Protocol)
  ─────►  Service Binding (private, internal only)
  🔒      INTERNAL_ONLY=true (rejects public requests)
```

### How Service Bindings Work

```
Traditional HTTP Call:
┌────────┐    Internet    ┌────────┐
│Worker A│ ────────────► │Worker B│   ❌ Slow, public URL required
└────────┘               └────────┘

Service Binding:
┌────────┐   Direct Call  ┌────────┐
│Worker A│ ═══════════════│Worker B│   ✅ Fast, no public URL
└────────┘   (internal)   └────────┘
```

**Benefits:**
- **Zero network latency** - Direct function call, not HTTP
- **No public exposure** - Specialist workers have no public URLs
- **Automatic authentication** - Only bound workers can call each other
- **Cost effective** - Internal calls don't count against request limits

---

## 🚀 Quick Start

### 1. Prerequisites

```bash
# Install dependencies
pnpm install

# Login to Cloudflare
pnpm --filter a2a-hello-world-worker exec wrangler login
```

### 2. Set Secrets

```bash
# Set OpenAI API key for each worker
pnpm --filter a2a-hello-world-worker exec wrangler secret put OPENAI_API_KEY
pnpm --filter a2a-dice-agent-worker exec wrangler secret put OPENAI_API_KEY
pnpm --filter a2a-currency-agent-worker exec wrangler secret put OPENAI_API_KEY
pnpm --filter a2a-weather-agent-worker exec wrangler secret put OPENAI_API_KEY
pnpm --filter a2a-airbnb-agent-worker exec wrangler secret put OPENAI_API_KEY
pnpm --filter a2a-travel-planner-worker exec wrangler secret put OPENAI_API_KEY
```

### 3. Deploy

```bash
# Deploy a single worker
pnpm worker:deploy:hello-world

# Deploy all workers (in correct order for Service Bindings)
pnpm workers:deploy:all
```

### 4. Test

```bash
# Test with curl
curl -X POST https://a2a-hello-world.YOUR-SUBDOMAIN.workers.dev/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "id": "test-1",
    "params": {
      "message": {
        "role": "user",
        "messageId": "msg-1",
        "parts": [{"kind": "text", "text": "Hello!"}]
      }
    }
  }'

# Or use the A2A Inspector
# 1. Start local inspector: pnpm inspector (from repo root)
# 2. Enter your worker URL
# 3. Start chatting!
```

---

## 📋 Available Commands

### Local Development

```bash
# Start individual workers locally
pnpm worker:hello-world      # http://localhost:8787
pnpm worker:dice             # http://localhost:8787
pnpm worker:currency         # http://localhost:8787
pnpm worker:weather          # http://localhost:8788
pnpm worker:airbnb-agent     # http://localhost:8789
pnpm worker:airbnb-mcp-server # http://localhost:8790
pnpm worker:planner          # http://localhost:8787
```

### Deployment

```bash
# Deploy individual workers
pnpm worker:deploy:hello-world
pnpm worker:deploy:dice
pnpm worker:deploy:currency
pnpm worker:deploy:weather
pnpm worker:deploy:airbnb-mcp-server
pnpm worker:deploy:airbnb-agent
pnpm worker:deploy:planner

# Deploy all workers
pnpm workers:deploy:all
```

### Monitoring

```bash
# View real-time logs
pnpm --filter a2a-hello-world-worker exec wrangler tail

# View logs with filtering
pnpm --filter a2a-weather-agent-worker exec wrangler tail --format json
```

---

## 💾 Task Store Selection

Workers use **task stores** to persist A2A task state. We use two types based on agent requirements:

### InMemoryTaskStore (Default)

For simple, stateless agents that don't need persistence:

| Worker | Reason |
|--------|--------|
| `hello-world` | Simple greeting, no state |
| `dice-agent` | Single-turn, stateless |
| `currency-agent` | Single-turn API call |
| `weather-agent` | Single-turn API call |
| `github-agent` | Single-turn API call |
| `analytics-agent` | Single-turn chart generation |
| `content-planner` | Single-turn outline |
| `contact-extractor` | Single-turn extraction |
| `code-review` | Single-turn analysis |
| ~~`local-llm-chat`~~ | *Now uses Redis for chat history* |
| `number-game-alice` | Custom JSON-RPC (no SDK task store) |
| `number-game-carol` | Custom JSON-RPC (no SDK task store) |

### UpstashRedisTaskStore (Persistent)

For agents that benefit from persistent task state:

| Worker | Prefix | Reason |
|--------|--------|--------|
| `travel-planner` | `a2a:travel:` | Multi-agent orchestration |
| `airbnb-agent` | `a2a:airbnb:` | Part of travel system |
| `adversarial-defender` | `a2a:adversarial:` | Conversation history for security testing |
| `image-generator` | `a2a:image:` | Long-running DALL-E operations |
| `expense-agent` | `a2a:expense:` | Multi-step form handling |
| `local-llm-chat` | `a2a:local-llm:` | Chat history persistence |

### Configuring Redis

Workers with Redis support automatically fall back to `InMemoryTaskStore` if Redis isn't configured.

To enable Redis persistence:

```bash
# Set Upstash Redis credentials
wrangler secret put UPSTASH_REDIS_REST_URL
wrangler secret put UPSTASH_REDIS_REST_TOKEN
```

For local development, add to `.dev.vars`:

```bash
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxx...
```

### When to Use Redis

| Use Redis When | Keep InMemory When |
|----------------|-------------------|
| Multi-turn conversations | Simple request/response |
| Multi-agent coordination | Single-turn interactions |
| Long-running operations | Stateless operations |
| Task history needed | No state needed |

---

## ⚡ Durable Workers (Workflow DevKit)

Some workers have **durable variants** that use [Workflow DevKit](https://useworkflow.dev) for enhanced reliability:

| Worker | Durable Variant | Benefits |
|--------|----------------|----------|
| `dice-agent` | `dice-agent-durable` | Step caching, automatic retry |
| `image-generator` | `image-generator-durable` | Long-running DALL-E with retry |
| `travel-planner` | `travel-planner-durable` | Multi-agent coordination with retry |

### What Durable Workers Provide

- **Automatic Retry**: Failed API calls retry automatically with backoff
- **Step Caching**: If a workflow restarts, completed steps return cached results
- **Observability**: View workflow traces via `npx workflow web`
- **Fault Tolerance**: Long-running operations survive worker restarts

### How Durability Works (Three-Layer Stack)

Durability requires THREE components working together:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DurableA2AAdapter                            │
│  Bridges A2A protocol with Workflow DevKit via start()              │
│  Import: @drew-foxall/a2a-ai-sdk-adapter/durable                    │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │ calls start()
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Workflow DevKit Runtime                          │
│  - start() creates run in World, queues workflow execution          │
│  - "use workflow" and "use step" directives (SWC transform)         │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │ persists to
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         World (Persistence)                         │
│  - @drew-foxall/upstash-workflow-world (Cloudflare Workers)         │
│  - Stores: runs, steps, events, hooks, queue                        │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │ uses
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      @drew-foxall/workflow-ai                       │
│  - DurableAgent: AI SDK integration with "use step" internally      │
└─────────────────────────────────────────────────────────────────────┘
```

**Key Insight:** Calling a workflow function directly does NOT provide durability. The workflow MUST be invoked via `start()` from `workflow/api`, which triggers the World's persistence. The `DurableA2AAdapter` handles this automatically.

### Configuring Durable Workers

Durable workers need additional Upstash Redis credentials for Workflow DevKit:

```bash
# Task Store (same as other Redis workers)
wrangler secret put UPSTASH_REDIS_REST_URL
wrangler secret put UPSTASH_REDIS_REST_TOKEN

# Workflow DevKit World (can be same Redis instance)
wrangler secret put WORKFLOW_UPSTASH_REDIS_REST_URL
wrangler secret put WORKFLOW_UPSTASH_REDIS_REST_TOKEN
```

### When to Use Durable Workers

| Use Durable When | Use Standard When |
|-----------------|------------------|
| Operations take >30 seconds | Quick responses |
| Expensive API calls (avoid retries) | Cheap/free operations |
| Multi-step coordination | Single operation |
| Need observability traces | Simple debugging |

---

## 🔧 Configuration

### Environment Variables

Each worker uses `wrangler.toml` for configuration:

```toml
# wrangler.toml
name = "a2a-hello-world"
main = "src/index.ts"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

[vars]
AI_PROVIDER = "openai"
AI_MODEL = "gpt-4o-mini"
```

### Secrets

Secrets are set via `wrangler secret`:

```bash
# Set a secret
pnpm --filter a2a-hello-world-worker exec wrangler secret put OPENAI_API_KEY

# List secrets
pnpm --filter a2a-hello-world-worker exec wrangler secret list

# Delete a secret
pnpm --filter a2a-hello-world-worker exec wrangler secret delete OPENAI_API_KEY
```

### Local Development Secrets

For local development, create a `.dev.vars` file (gitignored):

```bash
# examples/workers/hello-world/.dev.vars
OPENAI_API_KEY=sk-your-key-here
```

### Service Bindings Configuration

Service Bindings are configured in `wrangler.toml`:

```toml
# travel-planner/wrangler.toml
name = "a2a-travel-planner"
main = "src/index.ts"

# Bind to specialist workers
[[services]]
binding = "WEATHER_AGENT"
service = "a2a-weather-agent"

[[services]]
binding = "AIRBNB_AGENT"
service = "a2a-airbnb-agent"
```

---

## ⚠️ Important: Zod Schema Limitation

**Zod schemas don't work correctly in Cloudflare Workers** due to bundling issues with the `~standard` interface. Use explicit JSON Schema objects instead:

### ❌ Doesn't Work (Zod)

```typescript
import { z } from "zod";
import { ToolLoopAgent } from "ai";

// This will fail - schema gets stripped during bundling
const agent = new ToolLoopAgent({
  model,
  tools: {
    get_weather: {
      description: "Get weather",
      inputSchema: z.object({
        location: z.string(),
      }),
      execute: async ({ location }) => { /* ... */ },
    },
  },
});
```

### ✅ Works (Explicit JSON Schema)

```typescript
import { ToolLoopAgent } from "ai";

// Create schema symbol for AI SDK
const schemaSymbol = Symbol.for("vercel.ai.schema");

// Define schema with explicit JSON Schema
const weatherSchema = {
  [schemaSymbol]: true,
  jsonSchema: {
    type: "object",
    properties: {
      location: {
        type: "string",
        description: "The location to get weather for",
      },
    },
    required: ["location"],
    additionalProperties: false,
  },
  validate: async (value: unknown) => {
    const v = value as { location?: string };
    if (typeof v?.location === "string") {
      return { success: true as const, value: v as { location: string } };
    }
    return { success: false as const, error: new Error("Invalid location") };
  },
};

// Use in agent
const agent = new ToolLoopAgent({
  model,
  tools: {
    get_weather: {
      description: "Get weather",
      inputSchema: weatherSchema,  // Use inputSchema, not parameters!
      execute: async ({ location }) => { /* ... */ },
    },
  },
});
```

See `weather-agent/src/index.ts` for a complete working example.

---

## 🔒 Security: Internal-Only Workers

Specialist workers can be configured to reject public requests:

### Configuration

```toml
# weather-agent/wrangler.toml
[vars]
INTERNAL_ONLY = "true"
```

### Implementation

```typescript
// Check for internal request
function isInternalRequest(request: Request): boolean {
  // Service Bindings use synthetic URLs
  const url = new URL(request.url);
  if (url.hostname === "internal") return true;
  
  // Check for internal header (set by orchestrator)
  if (request.headers.get("X-Worker-Internal") === "true") return true;
  
  // Localhost for development
  if (url.hostname === "localhost") return true;
  
  return false;
}

// Middleware to reject public requests
app.use("*", async (c, next) => {
  if (c.env.INTERNAL_ONLY === "true" && !isInternalRequest(c.req.raw)) {
    return c.json({ error: "This agent is internal only" }, 403);
  }
  return next();
});
```

---

## 🧪 Testing

### Test a Single Agent

```bash
# Hello World
curl -X POST https://a2a-hello-world.YOUR-SUBDOMAIN.workers.dev/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "id": "1",
    "params": {
      "message": {
        "role": "user",
        "messageId": "m1",
        "parts": [{"kind": "text", "text": "Say hello!"}]
      }
    }
  }'
```

### Test Multi-Agent System

```bash
# Travel Planner (orchestrates Weather + Airbnb agents)
curl -X POST https://a2a-travel-planner.YOUR-SUBDOMAIN.workers.dev/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "id": "1",
    "params": {
      "message": {
        "role": "user",
        "messageId": "m1",
        "parts": [{"kind": "text", "text": "Plan a 3-day trip to Tokyo. What will the weather be like and where should I stay?"}]
      }
    }
  }'
```

### View Logs

```bash
# Real-time logs
pnpm --filter a2a-travel-planner-worker exec wrangler tail

# JSON format for parsing
pnpm --filter a2a-travel-planner-worker exec wrangler tail --format json
```

---

## 📊 Deployed Workers

After deployment, your workers will be available at:

| Worker | URL | Access |
|--------|-----|--------|
| Hello World | `https://a2a-hello-world.YOUR-SUBDOMAIN.workers.dev` | 🌐 Public |
| Dice Agent | `https://a2a-dice-agent.YOUR-SUBDOMAIN.workers.dev` | 🌐 Public |
| Currency Agent | `https://a2a-currency-agent.YOUR-SUBDOMAIN.workers.dev` | 🌐 Public |
| Weather Agent | `https://a2a-weather-agent.YOUR-SUBDOMAIN.workers.dev` | 🔒 Internal |
| Airbnb Agent | `https://a2a-airbnb-agent.YOUR-SUBDOMAIN.workers.dev` | 🔒 Internal |
| Airbnb MCP | `https://airbnb-mcp-server.YOUR-SUBDOMAIN.workers.dev` | 🔒 Internal |
| Travel Planner | `https://a2a-travel-planner.YOUR-SUBDOMAIN.workers.dev` | 🌐 Public |

---

## 🔄 Data Flow Example

Here's what happens when you ask the Travel Planner about a trip:

```
1. User: "Plan a trip to Paris for next week"
   │
   ▼
2. Travel Planner receives request
   │
   ├──► "I need weather data for Paris"
   │    │
   │    ▼
   │    Service Binding: WEATHER_AGENT.fetch()
   │    │
   │    ▼
   │    Weather Agent calls Open-Meteo API
   │    │
   │    ▼
   │    Returns: { forecasts: [...], location: "Paris, France" }
   │
   ├──► "I need accommodation options in Paris"
   │    │
   │    ▼
   │    Service Binding: AIRBNB_AGENT.fetch()
   │    │
   │    ▼
   │    Airbnb Agent calls MCP Server
   │    │
   │    ▼
   │    MCP Server scrapes Airbnb
   │    │
   │    ▼
   │    Returns: { listings: [...] }
   │
   ▼
3. Travel Planner combines results
   │
   ▼
4. Response: "Here's your Paris trip plan:
              Weather: Expect 45-55°F with partly cloudy skies...
              Accommodations: I found these great options..."
```

---

## 🛠️ Troubleshooting

### "OPENAI_API_KEY is missing"

```bash
# Set the secret
pnpm --filter a2a-hello-world-worker exec wrangler secret put OPENAI_API_KEY

# Verify it's set
pnpm --filter a2a-hello-world-worker exec wrangler secret list
```

### "Invalid schema for function"

You're using Zod schemas. See the [Zod Schema Limitation](#️-important-zod-schema-limitation) section above.

### Service Binding returns 403

The specialist worker has `INTERNAL_ONLY=true` but isn't receiving the internal request header. Make sure your orchestrator adds:

```typescript
const response = await env.WEATHER_AGENT.fetch("https://internal/", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Worker-Internal": "true",  // Add this header
  },
  body: JSON.stringify(payload),
});
```

### Rate Limiting (429 errors)

External APIs (like Open-Meteo) may rate limit Cloudflare Workers due to shared IP ranges. The Weather Agent includes mock data fallback for this scenario.

---

## 📚 Further Reading

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Service Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- [A2A Protocol](https://a2a.plus/docs)
- [Vercel AI SDK](https://ai-sdk.dev/)
