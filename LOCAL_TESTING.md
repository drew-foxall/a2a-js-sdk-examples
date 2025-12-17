# Local Testing Guide for A2A Workers

This guide explains how to run A2A workers locally with full Redis/Upstash support without needing external accounts.

## Quick Start

```bash
# 1. Start local infrastructure (Redis + Upstash adapter)
pnpm local:up

# 2. Copy environment template to your worker
cp examples/workers/shared/.dev.vars.example examples/workers/expense-agent/.dev.vars

# 3. Edit .dev.vars and add your AI provider key
# OPENAI_API_KEY=sk-your-key-here

# 4. Start your worker
pnpm worker:expense-agent
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Local Development                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │   Worker    │───▶│ Upstash REST │───▶│    Redis     │   │
│  │ (wrangler)  │    │   Adapter    │    │   Server     │   │
│  │ localhost:X │    │ :8079        │    │   :6379      │   │
│  └─────────────┘    └──────────────┘    └──────────────┘   │
│        │                                                    │
│        │ @upstash/redis                                    │
│        │ (same API as production)                          │
│        ▼                                                    │
│  ┌─────────────┐                                           │
│  │  AI Provider│                                           │
│  │  (OpenAI,   │                                           │
│  │  Anthropic) │                                           │
│  └─────────────┘                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

The local setup uses:
- **Redis 7 Alpine**: Lightweight Redis server for data persistence
- **serverless-elysia-redis-http**: Upstash-compatible REST API adapter

This means your workers use the exact same `@upstash/redis` code in development and production.

## Commands

| Command | Description |
|---------|-------------|
| `pnpm local:up` | Start Redis + Upstash adapter containers |
| `pnpm local:down` | Stop and remove containers |
| `pnpm local:logs` | View container logs (follow mode) |
| `pnpm local:status` | Check service health |
| `pnpm local:help` | Show available commands |

## Environment Configuration

### Local Development (.dev.vars)

Copy the template and configure your AI provider:

```bash
cp examples/workers/shared/.dev.vars.example examples/workers/<your-worker>/.dev.vars
```

The template includes pre-configured local Redis settings:

```bash
# Local Redis (via Upstash adapter)
UPSTASH_REDIS_REST_URL=http://localhost:8079
UPSTASH_REDIS_REST_TOKEN=local-dev-token

# Your AI provider (required)
OPENAI_API_KEY=sk-your-key-here
```

### Production (Cloudflare Secrets)

For production, use real Upstash credentials:

```bash
wrangler secret put UPSTASH_REDIS_REST_URL
wrangler secret put UPSTASH_REDIS_REST_TOKEN
```

## Workers That Use Redis

These workers benefit from the local Redis setup:

| Worker | Use Case |
|--------|----------|
| `travel-planner` | Multi-agent orchestration, context persistence |
| `airbnb-agent` | Part of travel system |
| `adversarial-defender` | Conversation history |
| `image-generator` | Long-running operations |
| `expense-agent` | Multi-step forms |
| `local-llm-chat` | Chat history |

Workers without Redis configuration automatically fall back to `InMemoryTaskStore`.

## Testing Workflow

### 1. Start Infrastructure

```bash
pnpm local:up
```

Expected output:
```
🏠 A2A Local Development Infrastructure

🚀 Starting local infrastructure...

✅ Local infrastructure started!

📋 Services:
   Redis:         localhost:6379
   Upstash REST:  http://localhost:8079

🔧 Worker Configuration (.dev.vars):
   UPSTASH_REDIS_REST_URL=http://localhost:8079
   UPSTASH_REDIS_REST_TOKEN=local-dev-token
```

### 2. Verify Services

```bash
pnpm local:status
```

Or test the Upstash adapter directly:

```bash
curl http://localhost:8079/health
```

### 3. Start a Worker

```bash
# Example: Start expense-agent (uses Redis)
pnpm --filter a2a-expense-agent-worker dev
```

### 4. Test with Inspector

```bash
# In another terminal
pnpm inspector
```

Then open http://127.0.0.1:5001 and point it at your worker's URL.

### 5. Clean Up

```bash
pnpm local:down
```

## Troubleshooting

### Docker Not Running

```
❌ Docker is not available!
```

**Solution**: Start Docker Desktop or the Docker daemon.

### Port Already in Use

```
Error: bind: address already in use
```

**Solution**: Check what's using the port and stop it:

```bash
# Check port 8079 (Upstash adapter)
lsof -i :8079

# Check port 6379 (Redis)
lsof -i :6379
```

### Connection Refused

```
Error: connect ECONNREFUSED 127.0.0.1:8079
```

**Solution**: Ensure local infrastructure is running:

```bash
pnpm local:status
pnpm local:up  # if not running
```

### Redis Data Persistence

Local Redis data persists in a Docker volume (`redis-data`). To clear it:

```bash
pnpm local:down
docker volume rm a2a-local_redis-data
pnpm local:up
```

## Advanced: Remote Bindings

For testing with real Cloudflare services (KV, R2, D1), you can use [remote bindings](https://developers.cloudflare.com/workers/development-testing/#remote-bindings):

```toml
# wrangler.toml
[[kv_namespaces]]
binding = "MY_KV"
id = "your-kv-id"
remote = true  # Use real KV during local dev
```

This keeps your worker executing locally while connecting to real Cloudflare resources.

## Related Documentation

- [ENV_TEMPLATE.md](examples/workers/shared/ENV_TEMPLATE.md) - Full environment variable reference
- [Cloudflare Workers Development](https://developers.cloudflare.com/workers/development-testing/) - Official docs
- [serverless-elysia-redis-http](https://github.com/drew-foxall/serverless-elysia-redis-http) - Upstash adapter

