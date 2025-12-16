# A2A Agents on Vercel Edge Functions

Deploy A2A protocol agents to Vercel's Edge Network. This directory demonstrates how to run the **same agent logic** as Cloudflare Workers but on Vercel's platform.

## 🎯 Platform Portability

The key insight is that **agent logic is platform-agnostic**. The same `a2a-agents` package works on:

| Platform | Runtime | Example |
|----------|---------|---------|
| Cloudflare Workers | Edge | `workers/dice-agent` |
| **Vercel Edge** | Edge | `vercel/dice-agent` |
| Local (Node.js) | Node | `agents/dice-agent` |

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SAME AGENT LOGIC (a2a-agents)                     │
│                                                                      │
│   import { createDiceAgent } from "a2a-agents";                      │
│   const agent = createDiceAgent(model);                              │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
         ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
         │ Cloudflare      │ │ Vercel Edge     │ │ Local Node.js   │
         │ Workers         │ │ Functions       │ │ Server          │
         │                 │ │                 │ │                 │
         │ wrangler.toml   │ │ vercel.json     │ │ tsx watch       │
         │ export default  │ │ export config   │ │ serve()         │
         │ app             │ │ = { runtime }   │ │                 │
         └─────────────────┘ └─────────────────┘ └─────────────────┘
                    │               │               │
                    └───────────────┼───────────────┘
                                    ▼
         ┌─────────────────────────────────────────────────────────────────┐
         │                     UPSTASH REDIS (optional)                     │
         │  Same task store works across all platforms                      │
         └─────────────────────────────────────────────────────────────────┘
```

---

## 📁 Directory Structure

```
vercel/
├── dice-agent/              # 🎲 Dice agent on Vercel Edge
│   ├── api/
│   │   └── [...path].ts    # Edge function handler
│   ├── package.json
│   ├── vercel.json
│   └── tsconfig.json
│
└── README.md
```

---

## 🚀 Quick Start

### 1. Prerequisites

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login
```

### 2. Set Environment Variables

```bash
cd examples/vercel/dice-agent

# Set OpenAI API key
vercel env add OPENAI_API_KEY

# Optional: Set Redis for persistence
vercel env add UPSTASH_REDIS_REST_URL
vercel env add UPSTASH_REDIS_REST_TOKEN
```

### 3. Deploy

```bash
# From the dice-agent directory
vercel deploy

# Or deploy to production
vercel deploy --prod
```

### 4. Test

```bash
# Test with curl
curl -X POST https://your-project.vercel.app/api \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "id": "test-1",
    "params": {
      "message": {
        "role": "user",
        "messageId": "msg-1",
        "parts": [{"kind": "text", "text": "Roll a d20"}]
      }
    }
  }'
```

---

## 🔧 Local Development

```bash
cd examples/vercel/dice-agent

# Install dependencies
pnpm install

# Run locally with Vercel CLI
vercel dev

# Or run with hot reload
pnpm dev
```

---

## 📋 Platform Comparison

### Code Differences

| Aspect | Cloudflare Workers | Vercel Edge |
|--------|-------------------|-------------|
| Config file | `wrangler.toml` | `vercel.json` |
| Entry point | `export default app` | `export default handler` |
| Env access | `c.env.OPENAI_API_KEY` | `process.env.OPENAI_API_KEY` |
| Routing | Hono router | Vercel file-based |
| Secrets | `wrangler secret put` | `vercel env add` |

### What's the Same

- ✅ Agent logic (`a2a-agents` package)
- ✅ A2A protocol handling (`@drew-foxall/a2a-js-sdk`)
- ✅ Task store (`InMemoryTaskStore` or `UpstashRedisTaskStore`)
- ✅ AI SDK models (`@ai-sdk/openai`, etc.)

---

## 🔗 See Also

- [Cloudflare Workers Examples](../workers/README.md)
- [Local Agent Examples](../agents/README.md)
- [A2A Protocol Documentation](https://a2a.plus/docs)
- [Vercel Edge Functions](https://vercel.com/docs/functions/edge-functions)

