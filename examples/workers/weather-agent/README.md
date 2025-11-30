# Weather Agent - Cloudflare Worker

Specialist agent for weather forecasts, part of the multi-agent travel planning system.

## Role in Multi-Agent System

```
Travel Planner ──Service Binding──► Weather Agent
                                         │
                                         ▼
                                   Open-Meteo API
```

The Travel Planner orchestrator calls this agent via Service Binding when users ask about weather. This agent is also publicly accessible for direct testing.

## Features

- 7-day weather forecasts
- Global coverage (any city worldwide)
- Temperature high/low, precipitation, conditions
- Uses Open-Meteo API (free, no API key required)

## Agent Card

```json
{
  "name": "Weather Agent",
  "description": "Specialized weather forecast assistant using Open-Meteo API",
  "skills": [
    {
      "id": "weather-forecast",
      "name": "Weather Forecast",
      "description": "Get weather forecasts for any location worldwide"
    }
  ]
}
```

## Implementation

The worker creates a `ToolLoopAgent` with a weather forecast tool:

```typescript
const agent = new ToolLoopAgent({
  model,
  instructions: getWeatherAgentPrompt(),
  tools: {
    get_weather_forecast: {
      description: "Get weather forecast for a location",
      inputSchema: weatherForecastSchema,
      execute: async (params) => {
        const data = await getWeatherForecast(params.location, params.days);
        return formatWeatherResponse(data);
      },
    },
  },
});
```

## Tool Reuse

Weather tools are imported from the `a2a-agents` package:

```typescript
import {
  getWeatherAgentPrompt,
  getWeatherForecast,
  getWeatherDescription,
} from "a2a-agents";
```

This ensures consistency between local development and worker deployment.

## Deployment

```bash
cd examples/workers/weather-agent
pnpm run deploy
```

## Testing

```bash
# Direct test
curl -X POST https://a2a-weather-agent.aisdk-a2a.workers.dev/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "id": "1",
    "params": {
      "message": {
        "role": "user",
        "messageId": "msg-1",
        "parts": [{"kind": "text", "text": "What is the weather in Tokyo?"}]
      }
    }
  }'
```

## Data Source

| API | Coverage | Rate Limits |
|-----|----------|-------------|
| Open-Meteo | Global | Free tier available |

The agent includes mock data fallback when the API is rate-limited.

## Configuration

### wrangler.toml

```toml
name = "a2a-weather-agent"
main = "src/index.ts"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

[vars]
AI_PROVIDER = "openai"
AI_MODEL = "gpt-4o-mini"
```

### Secrets

```bash
wrangler secret put OPENAI_API_KEY
```

