# Platform Portability Guide

This guide explains how to deploy the same A2A agent across multiple edge platforms, demonstrating true platform portability.

## 🎯 The Key Insight

**Agent logic is platform-agnostic.** The same code runs everywhere:

```typescript
// This line is IDENTICAL across all platforms
import { createDiceAgent } from "a2a-agents";
const agent = createDiceAgent(model);
```

What differs is only the **deployment wrapper**:
- How to access environment variables
- How to export the handler
- Configuration file format

---

## 📊 Platform Comparison Matrix

### Runtime & Configuration

| Feature | Cloudflare Workers | Vercel Edge | Local Node.js |
|---------|-------------------|-------------|---------------|
| **Runtime** | V8 Isolates | V8 Isolates | Node.js |
| **Config File** | `wrangler.toml` | `vercel.json` | None |
| **Entry Point** | `export default app` | `export default handler` | `serve()` |
| **Deploy Command** | `wrangler deploy` | `vercel deploy` | N/A |
| **Local Dev** | `wrangler dev` | `vercel dev` | `tsx watch` |

### Environment Variables

| Aspect | Cloudflare Workers | Vercel Edge | Local Node.js |
|--------|-------------------|-------------|---------------|
| **Set Secrets** | `wrangler secret put` | `vercel env add` | `.env` file |
| **Local Secrets** | `.dev.vars` | `.env.local` | `.env` |
| **Access Pattern** | `c.env.VAR_NAME` | `process.env.VAR_NAME` | `process.env.VAR_NAME` |
| **Bindings Type** | `Bindings` generic | N/A | N/A |

### Features

| Feature | Cloudflare Workers | Vercel Edge | Local Node.js |
|---------|-------------------|-------------|---------------|
| **Service Bindings** | ✅ Yes | ❌ No | ❌ No |
| **Edge Locations** | 300+ | 100+ | 1 (local) |
| **Cold Start** | ~0ms | ~5ms | N/A |
| **Free Tier** | 100K req/day | 100K req/mo | Unlimited |
| **Max Execution** | 10ms (free), 30s (paid) | 25s | Unlimited |

---

## 🔧 Code Comparison

### Environment Access

**Cloudflare Workers:**
```typescript
// Uses Hono context with typed env bindings
app.get("/health", (c) => {
  const apiKey = c.env.OPENAI_API_KEY;  // From wrangler.toml or secrets
  return c.json({ status: "ok" });
});
```

**Vercel Edge:**
```typescript
// Uses process.env (requires helper function for typing)
function getEnv(): Env {
  return {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  };
}

app.get("/health", (c) => {
  const env = getEnv();
  const apiKey = env.OPENAI_API_KEY;
  return c.json({ status: "ok" });
});
```

**Local Node.js:**
```typescript
// Uses process.env directly (dotenv loaded at startup)
import "dotenv/config";

const apiKey = process.env.OPENAI_API_KEY;
```

### Entry Point

**Cloudflare Workers:**
```typescript
// Export Hono app directly
export default app;
```

**Vercel Edge:**
```typescript
// Export fetch handler with config
export const config = { runtime: "edge" };
export default app.fetch;
```

**Local Node.js:**
```typescript
// Use @hono/node-server or native http
import { serve } from "@hono/node-server";
serve({ fetch: app.fetch, port: 3000 });
```

---

## 💾 Shared Task Store

The same Redis instance works across all platforms!

```typescript
// This code is IDENTICAL on Cloudflare, Vercel, and Node.js
import { Redis } from "@upstash/redis";
import { UpstashRedisTaskStore } from "@drew-foxall/a2a-js-taskstore-upstash-redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const taskStore = new UpstashRedisTaskStore({
  client: redis,
  prefix: "a2a:dice:",  // Use platform-specific prefix if desired
  ttlSeconds: 86400 * 7,
});
```

### Key Prefixes by Platform

| Platform | Example Prefix | Purpose |
|----------|---------------|---------|
| Cloudflare Workers | `a2a:dice-cf:` | Cloudflare deployment |
| Vercel Edge | `a2a:dice-vercel:` | Vercel deployment |
| Local Node.js | `a2a:dice-local:` | Local development |

Or use the same prefix across platforms for shared state!

---

## 🚀 Migration Guide

### From Cloudflare to Vercel

1. **Create new directory structure:**
   ```
   vercel/your-agent/
   ├── api/
   │   └── index.ts
   ├── package.json
   ├── vercel.json
   └── tsconfig.json
   ```

2. **Copy agent logic (unchanged):**
   ```typescript
   // The agent creation is identical
   import { createYourAgent } from "a2a-agents";
   const agent = createYourAgent(model);
   ```

3. **Adapt environment access:**
   ```typescript
   // Before (Cloudflare)
   const apiKey = c.env.OPENAI_API_KEY;
   
   // After (Vercel)
   const apiKey = process.env.OPENAI_API_KEY;
   ```

4. **Update export:**
   ```typescript
   // Before (Cloudflare)
   export default app;
   
   // After (Vercel)
   export const config = { runtime: "edge" };
   export default app.fetch;
   ```

5. **Create vercel.json:**
   ```json
   {
     "rewrites": [{ "source": "/(.*)", "destination": "/api" }],
     "functions": { "api/**/*.ts": { "runtime": "@vercel/edge" } }
   }
   ```

6. **Deploy:**
   ```bash
   vercel deploy --prod
   ```

---

## 📁 Directory Structure

```
examples/
├── agents/                    # Platform-agnostic agent logic
│   └── src/agents/
│       └── dice-agent/
│           ├── agent.ts      # Core agent (shared everywhere)
│           ├── prompt.ts
│           └── tools.ts
│
├── workers/                   # Cloudflare Workers
│   └── dice-agent/
│       ├── src/index.ts      # Cloudflare wrapper
│       ├── wrangler.toml
│       └── package.json
│
└── vercel/                    # Vercel Edge Functions
    └── dice-agent/
        ├── api/index.ts      # Vercel wrapper
        ├── vercel.json
        └── package.json
```

---

## 🔄 Deployment Workflow

### Cloudflare Workers

```bash
cd examples/workers/dice-agent

# Set secrets
wrangler secret put OPENAI_API_KEY
wrangler secret put UPSTASH_REDIS_REST_URL
wrangler secret put UPSTASH_REDIS_REST_TOKEN

# Deploy
wrangler deploy
```

### Vercel Edge

```bash
cd examples/vercel/dice-agent

# Set secrets
vercel env add OPENAI_API_KEY
vercel env add UPSTASH_REDIS_REST_URL
vercel env add UPSTASH_REDIS_REST_TOKEN

# Deploy
vercel deploy --prod
```

---

## 🧪 Testing Both Platforms

Both deployments expose the same A2A endpoints:

```bash
# Test Cloudflare
curl -X POST https://a2a-dice-agent.YOUR.workers.dev/message/send \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"message/send","id":"1","params":{"message":{"role":"user","messageId":"m1","parts":[{"kind":"text","text":"Roll a d20"}]}}}'

# Test Vercel (identical request!)
curl -X POST https://a2a-dice-agent.vercel.app/api \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"message/send","id":"1","params":{"message":{"role":"user","messageId":"m1","parts":[{"kind":"text","text":"Roll a d20"}]}}}'
```

---

## 📈 When to Use Each Platform

| Use Case | Recommended Platform |
|----------|---------------------|
| **Global edge with Service Bindings** | Cloudflare Workers |
| **Next.js integration** | Vercel Edge |
| **Fastest cold starts** | Cloudflare Workers |
| **Existing Vercel projects** | Vercel Edge |
| **Complex multi-agent systems** | Cloudflare (Service Bindings) |
| **Simple single agents** | Either works |

---

## 🔗 References

- [Cloudflare Workers Examples](../examples/workers/README.md)
- [Vercel Edge Examples](../examples/vercel/README.md)
- [Local Agent Examples](../examples/agents/README.md)
- [A2A Protocol Documentation](https://a2a.plus/docs)

