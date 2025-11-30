# Travel Planner - Cloudflare Worker

Multi-agent orchestrator deployed as a Cloudflare Worker. Coordinates Weather and Airbnb specialist agents using Service Bindings.

## Architecture

```
                    Public Internet
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      TRAVEL PLANNER                              │
│              https://a2a-travel-planner.aisdk-a2a.workers.dev   │
│                                                                  │
│  - Imports agent logic from a2a-agents package                  │
│  - Uses Service Bindings for agent-to-agent calls               │
│  - Discovers agents by fetching Agent Cards at request time     │
└─────────────────────────┬───────────────────────────────────────┘
                          │ Service Bindings (private, zero-latency)
           ┌──────────────┴──────────────┐
           │                             │
           ▼                             ▼
┌─────────────────────┐       ┌─────────────────────┐
│    WEATHER AGENT    │       │    AIRBNB AGENT     │
│   (Service Binding) │       │   (Service Binding) │
│                     │       │                     │
│  Binding: WEATHER_  │       │  Binding: AIRBNB_   │
│           AGENT     │       │           AGENT     │
└─────────────────────┘       └─────────────────────┘
```

## Service Bindings vs HTTP

Cloudflare Service Bindings provide direct worker-to-worker communication without HTTP overhead:

| Aspect | Service Binding | HTTP |
|--------|-----------------|------|
| Latency | Sub-millisecond | Network round-trip |
| Security | Private by default | Public endpoint |
| Cost | Free | Billable egress |

This implementation uses Service Bindings when available, with HTTP fallback for local development.

## File Structure

```
travel-planner/
├── src/
│   ├── index.ts          # Worker entry point, imports from a2a-agents
│   ├── types.ts          # Worker-specific types (PlannerEnv, etc.)
│   ├── registry.ts       # Agent discovery via Service Binding or HTTP
│   └── communication.ts  # sendMessage implementation for workers
├── wrangler.toml         # Cloudflare configuration with Service Bindings
└── README.md
```

## Separation of Concerns

| Concern | Location | Responsibility |
|---------|----------|----------------|
| Agent logic | `a2a-agents` package | Platform-agnostic orchestration |
| Agent Card | `a2a-agents` package | Shared definition |
| Communication | `communication.ts` | Service Binding + HTTP fallback |
| Discovery | `registry.ts` | Fetch Agent Cards via binding or HTTP |
| Worker setup | `index.ts` | Cloudflare-specific wiring |

The agent logic is imported from `a2a-agents`, not duplicated:

```typescript
// src/index.ts
import { createPlannerAgent, createTravelPlannerCard } from "a2a-agents";

const plannerAgent = createPlannerAgent({
  model: getModel(env),
  agentRoster: registry.buildAgentRoster(),
  sendMessage: createWorkerSendMessage(registry), // Worker-specific
});
```

## Deployment

```bash
# Deploy all three workers
pnpm --filter a2a-weather-agent-worker run deploy
pnpm --filter a2a-airbnb-agent-worker run deploy
pnpm --filter a2a-travel-planner-worker run deploy
```

## Configuration

### wrangler.toml

```toml
name = "a2a-travel-planner"
main = "src/index.ts"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

[vars]
AI_PROVIDER = "openai"
AI_MODEL = "gpt-4o-mini"

# Service Bindings to specialist agents
[[services]]
binding = "WEATHER_AGENT"
service = "a2a-weather-agent"

[[services]]
binding = "AIRBNB_AGENT"
service = "a2a-airbnb-agent"
```

### Secrets

```bash
wrangler secret put OPENAI_API_KEY
```

## Testing

```bash
# Test via deployed URL
curl -X POST https://a2a-travel-planner.aisdk-a2a.workers.dev/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "id": "1",
    "params": {
      "message": {
        "role": "user",
        "messageId": "msg-1",
        "parts": [{"kind": "text", "text": "Plan a trip to Tokyo with weather and accommodations"}]
      }
    }
  }'
```

## Local Development

```bash
# Start the worker locally
cd examples/workers/travel-planner
pnpm run dev

# Note: Service Bindings require all workers running locally
# or use HTTP fallback URLs in .dev.vars
```

## URLs

| Worker | URL |
|--------|-----|
| Travel Planner | https://a2a-travel-planner.aisdk-a2a.workers.dev |
| Weather Agent | https://a2a-weather-agent.aisdk-a2a.workers.dev |
| Airbnb Agent | https://a2a-airbnb-agent.aisdk-a2a.workers.dev |

