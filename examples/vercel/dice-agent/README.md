# Dice Agent - Vercel Edge Function

A2A protocol agent running on Vercel Edge Functions. Demonstrates **platform portability**: the same agent logic that runs on Cloudflare Workers also runs on Vercel.

## 🎯 Key Point: Same Agent, Different Platform

```typescript
// This exact line appears in BOTH platforms:
import { createDiceAgent } from "a2a-agents";
const agent = createDiceAgent(model);
```

The agent logic is 100% shared. Only the deployment wrapper differs.

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd examples/vercel/dice-agent
pnpm install
```

### 2. Set Environment Variables

**For local development**, create `.env.local`:

```bash
OPENAI_API_KEY=sk-your-key-here

# Optional: For persistent storage
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxx...
```

**For deployment**, use Vercel CLI:

```bash
vercel env add OPENAI_API_KEY
vercel env add UPSTASH_REDIS_REST_URL
vercel env add UPSTASH_REDIS_REST_TOKEN
```

### 3. Run Locally

```bash
vercel dev
```

### 4. Deploy

```bash
vercel deploy --prod
```

---

## 📋 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/.well-known/agent-card.json` | GET | Agent discovery (A2A) |
| `/message/send` | POST | Send message (A2A) |
| `/health` | GET | Health check |

### Example Request

```bash
curl -X POST https://your-project.vercel.app/api \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "id": "1",
    "params": {
      "message": {
        "role": "user",
        "messageId": "m1",
        "parts": [{"kind": "text", "text": "Roll a d20"}]
      }
    }
  }'
```

---

## 🔄 Platform Comparison

### File Structure

| Cloudflare Workers | Vercel Edge |
|-------------------|-------------|
| `wrangler.toml` | `vercel.json` |
| `src/index.ts` | `api/index.ts` |
| `export default app` | `export default app.fetch` |

### Environment Variables

| Cloudflare Workers | Vercel Edge |
|-------------------|-------------|
| `wrangler secret put` | `vercel env add` |
| `.dev.vars` (local) | `.env.local` (local) |
| `c.env.OPENAI_API_KEY` | `process.env.OPENAI_API_KEY` |

### What's Identical

- ✅ Agent logic (`createDiceAgent`)
- ✅ A2A protocol handler (`A2AAdapter`)
- ✅ Task store (`UpstashRedisTaskStore`)
- ✅ AI SDK model setup
- ✅ Health check response structure

---

## 💾 Task Store

The agent uses `UpstashRedisTaskStore` when Redis is configured, falling back to `InMemoryTaskStore` otherwise.

**Same Redis instance works across platforms!**

```typescript
// This exact code works on both Cloudflare and Vercel
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const taskStore = new UpstashRedisTaskStore({
  client: redis,
  prefix: "a2a:dice-vercel:",  // Different prefix per platform
  ttlSeconds: 86400 * 7,
});
```

---

## 🔗 See Also

- [Cloudflare Workers Version](../../workers/dice-agent/)
- [Local Node.js Version](../../agents/src/agents/dice-agent/)
- [Platform Comparison](../README.md)

