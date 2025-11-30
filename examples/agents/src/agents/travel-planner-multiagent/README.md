# Travel Planner - Multi-Agent System

> **Reference**: Python [`airbnb_planner_multiagent`](https://github.com/a2aproject/a2a-samples/tree/main/samples/python/agents/airbnb_planner_multiagent)

This implementation replicates the Python multi-agent pattern using TypeScript, AI SDK, and the A2A protocol.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      TRAVEL PLANNER                              │
│                    (Orchestrator Agent)                          │
│                                                                  │
│  Framework: AI SDK (ToolLoopAgent)                              │
│  Tool: sendMessage(agentName, task)                             │
│        └─► Routes to specialist agents via A2A protocol         │
└─────────────────────────┬───────────────────────────────────────┘
                          │
           ┌──────────────┴──────────────┐
           │                             │
           ▼                             ▼
┌─────────────────────┐       ┌─────────────────────┐
│    WEATHER AGENT    │       │    AIRBNB AGENT     │
│                     │       │                     │
│  Framework: AI SDK  │       │  Framework: AI SDK  │
│  API: Open-Meteo    │       │  API: Airbnb MCP    │
│                     │       │                     │
│  Port: 41252        │       │  Port: 41253        │
└─────────────────────┘       └─────────────────────┘
```

## Pattern Implementation

### What We Implemented from Python

| Feature | Python | This Implementation |
|---------|--------|---------------------|
| Dynamic `sendMessage` tool | ✅ | ✅ Single tool routes by agent name |
| Agent discovery at startup | ✅ | ✅ Fetches Agent Cards via HTTP |
| Agent roster in prompt | ✅ | ✅ JSON-lines format injected |
| Active agent state tracking | ✅ | ✅ Tracks last-used agent |
| Routing Delegator prompt | ✅ | ✅ Same directive structure |

### Key Difference: Dependency Injection

The Python implementation couples communication to the framework. This implementation uses **dependency injection** for the `sendMessage` function:

```typescript
// Agent logic is platform-agnostic
export function createPlannerAgent(config: PlannerAgentConfig) {
  return new ToolLoopAgent({
    model,
    instructions,
    tools: {
      sendMessage: {
        execute: async ({ agentName, task }) => {
          // Communication is injected, not hardcoded
          return await config.sendMessage(agentName, task);
        },
      },
    },
  });
}
```

This means the same agent logic works in:
- **Local Node.js**: Uses `a2a-ai-provider` (HTTP)
- **Cloudflare Workers**: Uses Service Bindings (zero-latency)
- **Other platforms**: Inject your own communication function

## Directory Structure

```
travel-planner-multiagent/
├── planner/
│   ├── agent.ts           # Platform-agnostic orchestrator logic
│   ├── agent-discovery.ts # Agent Card fetching and registry
│   ├── card.ts            # Shared Agent Card definition
│   ├── prompt.ts          # Routing Delegator system prompt
│   └── index.ts           # Local Node.js server
├── weather-agent/
│   ├── agent.ts           # Weather specialist agent
│   ├── tools.ts           # Open-Meteo API integration
│   ├── prompt.ts          # Weather agent instructions
│   └── index.ts           # Local Node.js server
├── airbnb-agent/
│   ├── agent.ts           # Airbnb specialist agent
│   ├── mcp-client.ts      # MCP client for Airbnb data
│   ├── prompt.ts          # Airbnb agent instructions
│   └── index.ts           # Local Node.js server
└── README.md
```

## Running Locally

```bash
# Terminal 1: Weather Agent
pnpm agents:weather-agent
# Listening on port 41252

# Terminal 2: Airbnb Agent
pnpm agents:airbnb-agent
# Listening on port 41253

# Terminal 3: Travel Planner (Orchestrator)
pnpm agents:travel-planner
# Listening on port 41254
```

## Testing

```bash
# Weather query → routes to Weather Agent
curl -X POST http://localhost:41254/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "id": "1",
    "params": {
      "message": {
        "role": "user",
        "messageId": "msg-1",
        "parts": [{"kind": "text", "text": "What is the weather in Paris?"}]
      }
    }
  }'

# Accommodation query → routes to Airbnb Agent
curl -X POST http://localhost:41254/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "id": "2",
    "params": {
      "message": {
        "role": "user",
        "messageId": "msg-2",
        "parts": [{"kind": "text", "text": "Find accommodations in Tokyo for 2 adults"}]
      }
    }
  }'

# Multi-agent query → routes to both agents
curl -X POST http://localhost:41254/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "id": "3",
    "params": {
      "message": {
        "role": "user",
        "messageId": "msg-3",
        "parts": [{"kind": "text", "text": "Plan a trip to Barcelona with weather and accommodations"}]
      }
    }
  }'
```

## Data Sources

| Agent | Data Source | Coverage |
|-------|-------------|----------|
| Weather Agent | Open-Meteo API | Global, 7-day forecasts |
| Airbnb Agent | @openbnb/mcp-server-airbnb | Real Airbnb listings via MCP |

## Cloudflare Workers Deployment

See [`examples/workers/travel-planner/`](../../../../workers/travel-planner/) for the Cloudflare Workers deployment, which uses Service Bindings for private agent-to-agent communication.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | Yes | - | OpenAI API key |
| `AI_MODEL` | No | `gpt-4o-mini` | Model to use |
| `WEATHER_AGENT_URL` | No | `http://localhost:41252` | Weather Agent URL |
| `AIRBNB_AGENT_URL` | No | `http://localhost:41253` | Airbnb Agent URL |
