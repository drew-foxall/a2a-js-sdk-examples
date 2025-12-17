# Environment Variables Template for A2A Workers

Copy these configurations to `.dev.vars` in each worker directory for local development.
For production, set secrets via `wrangler secret put <NAME>`.

> **Quick Start**: Copy `.dev.vars.example` from this directory to your worker.
> See [LOCAL_TESTING.md](../../../LOCAL_TESTING.md) for the full local development guide.

## Required: AI Provider

```bash
# OpenAI (default provider)
OPENAI_API_KEY=sk-your-openai-api-key-here
```

## Optional: Alternative Providers

```bash
# Anthropic (use AI_PROVIDER=anthropic to enable)
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key-here

# Google AI (use AI_PROVIDER=google to enable)
GOOGLE_GENERATIVE_AI_API_KEY=your-google-api-key-here

# Provider and model selection (defaults to openai/gpt-4o-mini)
AI_PROVIDER=openai
AI_MODEL=gpt-4o-mini
```

## Optional: Redis Task Store

Workers with Redis support automatically fall back to `InMemoryTaskStore` if these are not configured.

**Workers that use Redis:**
- `travel-planner` - Multi-agent orchestration
- `airbnb-agent` - Part of travel system
- `adversarial-defender` - Conversation history
- `image-generator` - Long-running operations
- `expense-agent` - Multi-step forms
- `local-llm-chat` - Chat history

### Local Development (Recommended)

Start local Redis infrastructure with `pnpm local:up`, then use:

```bash
UPSTASH_REDIS_REST_URL=http://localhost:8079
UPSTASH_REDIS_REST_TOKEN=local-dev-token
```

### Production (Upstash)

Get free credentials at: https://upstash.com/redis

```bash
UPSTASH_REDIS_REST_URL=https://your-region.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxx...your-upstash-token-here
```

## Service-Specific Configuration

```bash
# GitHub Agent
GITHUB_API_TOKEN=ghp_your-github-token-here

# Airbnb MCP Server URL (for airbnb-agent when not using Service Bindings)
AIRBNB_MCP_URL=http://localhost:8788
```

## Setting Secrets for Production

```bash
# Set secrets
wrangler secret put OPENAI_API_KEY
wrangler secret put UPSTASH_REDIS_REST_URL
wrangler secret put UPSTASH_REDIS_REST_TOKEN

# List secrets
wrangler secret list

# Delete a secret
wrangler secret delete <NAME>
```

