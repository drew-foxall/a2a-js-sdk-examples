# Airbnb Agent - Cloudflare Worker

Specialist agent for Airbnb accommodation searches, part of the multi-agent travel planning system.

## Role in Multi-Agent System

```
Travel Planner ──Service Binding──► Airbnb Agent
                                         │
                                         ▼
                                   Airbnb MCP Server
                                         │
                                         ▼
                                   Airbnb Website
```

The Travel Planner orchestrator calls this agent via Service Binding when users ask about accommodations.

## Features

- Search Airbnb listings by location
- Filter by guests, dates, price range
- Returns real listing data with prices, ratings, and direct links
- Uses MCP (Model Context Protocol) for data access

## Agent Card

```json
{
  "name": "Airbnb Agent",
  "description": "Specialist agent for searching Airbnb accommodations",
  "skills": [
    {
      "id": "airbnb-search",
      "name": "Search Airbnb Listings",
      "description": "Search for accommodations by location, dates, and guests"
    },
    {
      "id": "listing-details",
      "name": "Get Listing Details",
      "description": "Get detailed information about a specific listing"
    }
  ]
}
```

## MCP Integration

This agent connects to an Airbnb MCP Server deployed as a separate Cloudflare Worker:

```typescript
async function callMCPTool(env: Env, toolName: string, args: unknown) {
  // Try Service Binding first
  if (env.AIRBNB_MCP) {
    const response = await env.AIRBNB_MCP.fetch("https://internal/mcp", {
      method: "POST",
      body: JSON.stringify({ tool: toolName, arguments: args }),
    });
    return response.json();
  }

  // Fall back to HTTP
  const response = await fetch(`${env.AIRBNB_MCP_URL}/mcp`, { ... });
  return response.json();
}
```

## Deployment

```bash
cd examples/workers/airbnb-agent
pnpm run deploy
```

## Testing

```bash
# Direct test
curl -X POST https://a2a-airbnb-agent.aisdk-a2a.workers.dev/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "id": "1",
    "params": {
      "message": {
        "role": "user",
        "messageId": "msg-1",
        "parts": [{"kind": "text", "text": "Find accommodations in Paris for 2 adults"}]
      }
    }
  }'
```

## Data Source

| Source | Method | Data |
|--------|--------|------|
| Airbnb MCP Server | Service Binding or HTTP | Real listings from Airbnb |

The MCP server scrapes Airbnb search results to provide current listing data.

## Configuration

### wrangler.toml

```toml
name = "a2a-airbnb-agent"
main = "src/index.ts"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

[vars]
AI_PROVIDER = "openai"
AI_MODEL = "gpt-4o-mini"
AIRBNB_MCP_URL = "https://airbnb-mcp-server.aisdk-a2a.workers.dev"

# Service binding to MCP server
[[services]]
binding = "AIRBNB_MCP"
service = "airbnb-mcp-server"
```

### Secrets

```bash
wrangler secret put OPENAI_API_KEY
```

## MCP Server Dependency

This agent requires the Airbnb MCP Server to be deployed:

```bash
cd examples/workers/airbnb-mcp-server
pnpm run deploy
```

The MCP server provides two tools:
- `searchAirbnb`: Search listings by location and criteria
- `getListingDetails`: Get details for a specific listing ID

