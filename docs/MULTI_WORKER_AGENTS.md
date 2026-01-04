# Multi-Worker Agent Development Guide

This document explains how to develop and deploy multi-worker agents using Turbo and pnpm. Multi-worker agents are orchestrator systems that coordinate multiple specialist workers to accomplish complex tasks.

## Overview

Multi-worker agents consist of:
- **Orchestrator Worker**: The main entry point that coordinates specialist agents
- **Specialist Workers**: Individual workers that handle specific capabilities
- **Support Services**: Optional services like MCP servers that provide tool access

## Current Multi-Worker Agents

### Travel Planner

The Travel Planner is a multi-agent orchestrator that coordinates weather and accommodation searches.

| Worker | Package Name | Port | Inspector | Description |
|--------|-------------|------|-----------|-------------|
| Travel Planner | `a2a-travel-planner-worker` | 8787 | 9230 | Orchestrator agent |
| Weather Agent | `a2a-weather-agent-worker` | 8788 | 9231 | Weather information specialist |
| Airbnb Agent | `a2a-airbnb-agent-worker` | 8789 | 9232 | Accommodation search specialist |
| Airbnb MCP Server | `airbnb-mcp-server-worker` | 8790 | 9233 | MCP server for Airbnb API |

## Running Multi-Worker Agents

### Start All Workers (Development)

```bash
# Start all Travel Planner workers concurrently
pnpm multi:travel-planner
```

This command uses Turbo to run all required workers in parallel:
- Airbnb MCP Server (port 8790)
- Weather Agent (port 8788)
- Airbnb Agent (port 8789)
- Travel Planner (port 8787)

### Stop All Workers

Press `Ctrl+C` in the terminal running the multi command. All workers will stop.

### Deploy All Workers

```bash
# Deploy all Travel Planner workers to Cloudflare
pnpm multi:travel-planner:deploy
```

Workers are deployed concurrently. Service Bindings automatically connect them in production.

## Local Development Secrets

Workers that use AI providers require API keys. For local development, create `.dev.vars` files in each worker directory:

### Travel Planner Group

```bash
# examples/workers/travel-planner/.dev.vars
OPENAI_API_KEY=sk-proj-xxxxx

# examples/workers/weather-agent/.dev.vars
OPENAI_API_KEY=sk-proj-xxxxx

# examples/workers/airbnb-agent/.dev.vars
OPENAI_API_KEY=sk-proj-xxxxx
```

> **Note**: `.dev.vars` files are gitignored. Never commit API keys to the repository.

For production deployment, use Wrangler secrets:

```bash
cd examples/workers/weather-agent
wrangler secret put OPENAI_API_KEY

cd examples/workers/airbnb-agent
wrangler secret put OPENAI_API_KEY

cd examples/workers/travel-planner
wrangler secret put OPENAI_API_KEY
```

## Adding a New Multi-Worker Agent

### Step 1: Create Worker Packages

Create each worker in `examples/workers/`:

```
examples/workers/
├── my-orchestrator/
│   ├── package.json
│   ├── src/index.ts
│   └── wrangler.toml
├── specialist-a/
│   ├── package.json
│   ├── src/index.ts
│   └── wrangler.toml
└── specialist-b/
    ├── package.json
    ├── src/index.ts
    └── wrangler.toml
```

### Step 2: Assign Unique Ports

Each worker needs unique **worker port** AND **inspector port** for local development. Update `package.json`:

```json
{
  "name": "my-orchestrator-worker",
  "scripts": {
    "dev": "wrangler dev --port 8791 --inspector-port 9234",
    "deploy": "wrangler deploy"
  }
}
```

**Port Convention**:

| Group | Worker Ports | Inspector Ports |
|-------|-------------|-----------------|
| Travel Planner | 8787-8790 | 9230-9233 |
| Future Group 1 | 8791-8795 | 9234-9238 |
| Future Group 2 | 8796-8800 | 9239-9243 |

> **Important**: The inspector port is used for Node.js debugging. All workers default to 9230, causing conflicts when running concurrently.

### Step 3: Add Root Scripts

Add grouped commands to root `package.json`:

```json
{
  "scripts": {
    "multi:my-agent": "turbo run dev --filter=my-orchestrator-worker --filter=specialist-a-worker --filter=specialist-b-worker --concurrency=4",
    "multi:my-agent:deploy": "turbo run deploy --filter=my-orchestrator-worker --filter=specialist-a-worker --filter=specialist-b-worker"
  }
}
```

> **Note**: Turbo requires `--concurrency` to be at least `n+1` for `n` persistent tasks (dev servers). For 3 workers, use `--concurrency=4`.

### Step 4: Configure Service Bindings

In the orchestrator's `wrangler.toml`:

```toml
[[services]]
binding = "SPECIALIST_A"
service = "specialist-a-service-name"

[[services]]
binding = "SPECIALIST_B"
service = "specialist-b-service-name"

[vars]
# Fallback URLs for local development
SPECIALIST_A_URL_FALLBACK = "http://localhost:8792/.well-known/agent-card.json"
SPECIALIST_B_URL_FALLBACK = "http://localhost:8793/.well-known/agent-card.json"
```

### Step 5: Update Documentation

Add your multi-worker agent to this document's "Current Multi-Worker Agents" section.

## Architecture Patterns

### Service Bindings vs HTTP

| Aspect | Service Binding | HTTP Fallback |
|--------|-----------------|---------------|
| Environment | Production (Cloudflare) | Local Development |
| Latency | Sub-millisecond | Network round-trip |
| Security | Private by default | Public endpoint |
| Configuration | `[[services]]` in wrangler.toml | `*_URL_FALLBACK` vars |

### Communication Flow

```
                    Public Internet
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                     ORCHESTRATOR                         │
│                    (port 8787)                          │
│                                                          │
│  Uses Service Bindings (prod) or HTTP fallback (dev)    │
└─────────────────────────┬───────────────────────────────┘
                          │
           ┌──────────────┴──────────────┐
           │                             │
           ▼                             ▼
┌─────────────────────┐       ┌─────────────────────┐
│   SPECIALIST A      │       │   SPECIALIST B      │
│   (port 8788)       │       │   (port 8789)       │
└─────────────────────┘       └─────────────────────┘
```

## Troubleshooting

### Port Conflicts

If you see `EADDRINUSE` errors, check that no other workers are using the same port:

```bash
# Find processes using a specific port
lsof -i :8787
```

### Service Binding Not Found

In local development, Service Bindings don't work with `wrangler dev`. Ensure:
1. All workers are running
2. Fallback URLs are configured in `wrangler.toml`
3. Fallback URLs match the port assignments

### Workers Not Starting Together

Ensure all workers are listed in the Turbo filter:

```bash
# Verify filter syntax
turbo run dev --filter=worker-a --filter=worker-b --dry-run
```

## Best Practices

1. **Consistent Port Numbering**: Use sequential ports within a group
2. **Document Dependencies**: List all required workers in README
3. **Fallback URLs**: Always configure HTTP fallbacks for local development
4. **Concurrency Limit**: Set `--concurrency` to at least `n+1` for `n` workers (Turbo requirement)
5. **Single Deploy Command**: Keep deployment atomic with one command

## Related Documentation

- [Travel Planner Architecture](../examples/workers/travel-planner/ARCHITECTURE.md)
- [Travel Planner README](../examples/workers/travel-planner/README.md)
- [Turbo Documentation](https://turbo.build/repo/docs)

