# MCP Agent Registry

A Cloudflare Worker that provides **MCP-based agent discovery**. This enables dynamic agent routing without hardcoding URLs - agents register themselves, and orchestrators find agents by capability.

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     MCP AGENT REGISTRY                           │
│                                                                  │
│  Resources:                     Tools:                           │
│  - agent_cards/list            - find_agent(query)               │
│  - agent_cards/{name}          - list_agents()                   │
│  - registry/stats              - get_agent(name)                 │
│                                - register_agent(card)            │
│                                - unregister_agent(name)          │
└─────────────────────────────────────────────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
        ▼                         ▼                         ▼
┌───────────────┐        ┌───────────────┐        ┌───────────────┐
│ Weather Agent │        │ Airbnb Agent  │        │ Flight Agent  │
│ (registered)  │        │ (registered)  │        │ (registered)  │
└───────────────┘        └───────────────┘        └───────────────┘
```

## Features

- **Dynamic Discovery**: Find agents by natural language query
- **Capability Matching**: Filter by required capabilities and tags
- **Health Tracking**: Monitor agent availability
- **State Persistence**: Redis-backed storage (optional)
- **MCP Protocol**: Standard Model Context Protocol interface
- **REST API**: Simple REST endpoints for easy integration

## Quick Start

### Development

```bash
# Install dependencies
pnpm install

# Start the worker
pnpm dev
```

### Register an Agent

```bash
# Via REST API
curl -X POST http://localhost:41260/agents \
  -H "Content-Type: application/json" \
  -d '{
    "agentCard": {
      "name": "Weather Agent",
      "description": "Provides weather forecasts for any location",
      "url": "https://weather-agent.example.com"
    },
    "tags": ["weather", "forecast", "travel"]
  }'
```

### Find an Agent

```bash
# Via REST API
curl "http://localhost:41260/find?query=I+need+weather+information+for+Paris"

# Via MCP
curl -X POST http://localhost:41260/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "find_agent",
      "arguments": {
        "query": "I need weather information for Paris"
      }
    }
  }'
```

## API Reference

### REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Server info |
| GET | `/health` | Health check |
| GET | `/agents` | List all agents |
| POST | `/agents` | Register an agent |
| GET | `/agents/:name` | Get agent by name |
| DELETE | `/agents/:name` | Unregister agent |
| GET | `/find?query=...` | Find agent by capability |
| GET | `/stats` | Registry statistics |

### MCP Tools

| Tool | Description |
|------|-------------|
| `find_agent` | Find the best agent(s) for a task |
| `list_agents` | List all registered agents |
| `get_agent` | Get a specific agent by name |
| `register_agent` | Register a new agent |
| `unregister_agent` | Remove an agent |

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL | No |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token | No |

Without Redis, the registry uses in-memory storage (data lost on restart).

### Setting Secrets

```bash
wrangler secret put UPSTASH_REDIS_REST_URL
wrangler secret put UPSTASH_REDIS_REST_TOKEN
```

## Usage with Orchestrator

```typescript
import { createMCPRegistryOrchestrator } from "a2a-agents/agents/mcp-registry";

// Create orchestrator that uses the registry
const orchestrator = createMCPRegistryOrchestrator(mcpServer, model, {
  registryUrl: "https://a2a-mcp-registry.workers.dev",
  maxReplanIterations: 3,
});

// Execute a complex query
const result = await orchestrator.execute(
  "Plan a trip to Paris for 2 people, June 15-22, budget $3000"
);

// The orchestrator will:
// 1. Create a plan (flight search, hotel search, etc.)
// 2. Find agents for each task via MCP registry
// 3. Execute tasks respecting dependencies
// 4. Re-plan if any task fails
```

## Deployment

```bash
# Deploy to Cloudflare Workers
pnpm deploy
```

## Related

- [MCP Registry Agent](../../agents/src/agents/mcp-registry/) - Core implementation
- [Travel Planner](../travel-planner/) - Example orchestrator
- [Python Reference](../../docs/python-examples-reference/06-a2a-mcp-registry.md) - Original pattern




