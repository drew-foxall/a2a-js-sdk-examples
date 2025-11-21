# Travel Planner - Multi-Agent Orchestration System

> **Python Equivalent**: [`airbnb_planner_multiagent`](https://github.com/a2aproject/a2a-samples/tree/main/samples/python/agents/airbnb_planner_multiagent)  
> JavaScript implementation using `a2a-ai-provider` for multi-agent orchestration (equivalent to Python's ADK).

A comprehensive demonstration of **multi-agent orchestration** using the A2A protocol and `a2a-ai-provider`.

> **📊 Data Sources:**
> - **Weather Agent**: ✅ Uses **real API** (Open-Meteo) with global coverage
> - **Airbnb Agent**: ✅ Uses **real MCP** (@openbnb/mcp-server-airbnb) with live data
> 
> **✨ PRODUCTION-READY**: Both agents now use real APIs! See [Python vs JavaScript Comparison](../../../../PYTHON_VS_JS_MULTIAGENT_COMPARISON.md) for architecture details.

## Overview

This example showcases **agent-to-agent communication** with three agents:
- 🌤️ **Weather Agent** (Specialist) - Provides weather forecasts
- 🏠 **Airbnb Agent** (Specialist) - Searches for accommodations
- 🎭 **Travel Planner** (Orchestrator) - Coordinates both specialists

**Key Innovation**: The orchestrator uses `a2a-ai-provider` to consume A2A agents as if they were LLM providers!

## Architecture

```
User Request: "Plan a trip to Paris for 2 people"
        ↓
Travel Planner (Orchestrator - Port 41252)
        ├─→ Weather Agent (Specialist - Port 41250)
        │   └─→ Open-Meteo API (Real Weather Data)
        └─→ Airbnb Agent (Specialist - Port 41251)
            └─→ @openbnb/mcp-server-airbnb (Real Airbnb Data via MCP)
```

### Components

#### 1. Weather Agent (Specialist)
- **Port**: 41250
- **Purpose**: Provides weather forecasts
- **API**: Open-Meteo (free, no API key)
- **Features**: 7-day forecasts, temperature, precipitation, conditions

#### 2. Airbnb Agent (Specialist)
- **Port**: 41251
- **Purpose**: Searches for accommodations
- **API**: Real MCP (@openbnb/mcp-server-airbnb)
- **Features**: Real listings with current prices, ratings, amenities, booking links
- **✨ NEW**: Upgraded to use real Airbnb data via Model Context Protocol!

#### 3. Travel Planner (Orchestrator)
- **Port**: 41252
- **Purpose**: Coordinates specialist agents
- **Technology**: `a2a-ai-provider` + AI SDK
- **Features**: Automatic delegation, response synthesis

## Directory Structure

```
travel-planner-multiagent/
├── weather-agent/
│   ├── agent.ts        # AI SDK ToolLoopAgent (weather tools)
│   ├── index.ts        # A2A server (port 41250)
│   ├── tools.ts        # Open-Meteo API integration
│   └── prompt.ts       # Weather agent instructions
├── airbnb-agent/
│   ├── agent.ts        # AI SDK ToolLoopAgent (MCP tools)
│   ├── index.ts        # A2A server (port 41251)
│   ├── mcp-client.ts   # MCP client for @openbnb/mcp-server-airbnb
│   ├── prompt.ts       # Airbnb agent instructions
│   └── tools.mock.ts   # Mock data (backup, no longer used)
├── planner/
│   ├── orchestrator.ts # Multi-agent coordinator (a2a-ai-provider)
│   ├── index.ts        # Orchestrator server (port 41252)
│   └── prompt.ts       # Orchestration instructions
└── README.md           # This file
```

## Why This Example?

This is the **most advanced example** in the repository because it demonstrates:

1. **Multi-Agent Orchestration** - Coordinating multiple specialist agents
2. **A2A Protocol Power** - Agent-to-agent communication at scale
3. **a2a-ai-provider Integration** - Consuming A2A agents as "models"
4. **Separation of Concerns** - Each agent has a specific responsibility
5. **Scalable Patterns** - Add new specialist agents easily
6. **Real-World Use Case** - Practical travel planning scenario

## Quick Start

### Prerequisites

```bash
# Ensure you have the dependencies installed
cd examples/agents
pnpm install
```

### Step 1: Start Weather Agent

```bash
# Terminal 1
export OPENAI_API_KEY=your_key
pnpm agents:weather-agent

# Should see:
# 🌤️  Weather Agent - A2A Server Starting...
# 📍 Port: 41250
```

### Step 2: Start Airbnb Agent

```bash
# Terminal 2
export OPENAI_API_KEY=your_key
pnpm agents:airbnb-agent

# Should see:
# 🏠 Airbnb Agent - A2A Server Starting...
# 📍 Port: 41251
```

### Step 3: Start Travel Planner Orchestrator

```bash
# Terminal 3
export OPENAI_API_KEY=your_key
pnpm agents:travel-planner

# Should see:
# 🎭 Travel Planner Orchestrator - Starting...
# 📍 Port: 41252
```

### Step 4: Test the System

```bash
# Weather only
curl -X POST http://localhost:41252/plan \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the weather in Paris?"}'

# Accommodations only
curl -X POST http://localhost:41252/plan \
  -H "Content-Type: application/json" \
  -d '{"query": "Find accommodations in Tokyo for 3 people"}'

# Full travel plan (both agents)
curl -X POST http://localhost:41252/plan \
  -H "Content-Type: application/json" \
  -d '{"query": "Plan a trip to Los Angeles for 2 people, June 20-25"}'
```

## Technical Details

### The Magic: a2a-ai-provider

The key to multi-agent orchestration is `a2a-ai-provider`, which allows AI SDK agents to consume A2A agents as "models":

```typescript
import { a2a } from "a2a-ai-provider";
import { generateText } from "ai";

// A2A agent consumed as a "model"!
const result = await generateText({
  model: a2a('http://localhost:41250/.well-known/agent-card.json'),
  prompt: 'What is the weather in Paris?',
});
```

### Orchestrator Pattern

```typescript
// orchestrator.ts
export class TravelPlannerOrchestrator {
  // Delegate to Weather Agent
  private async delegateToWeatherAgent(query: string) {
    return await generateText({
      model: a2a(this.config.weatherAgent.agentCardUrl),
      prompt: query,
    });
  }

  // Delegate to Airbnb Agent
  private async delegateToAirbnbAgent(query: string) {
    return await generateText({
      model: a2a(this.config.airbnbAgent.agentCardUrl),
      prompt: query,
    });
  }

  // Main entry point
  async processRequest(userQuery: string) {
    // 1. Analyze request
    const analysis = await this.analyzeRequest(userQuery);
    
    // 2. Delegate to appropriate agent(s)
    const responses = [];
    if (analysis.needsWeather) {
      responses.push(await this.delegateToWeatherAgent(userQuery));
    }
    if (analysis.needsAccommodation) {
      responses.push(await this.delegateToAirbnbAgent(userQuery));
    }
    
    // 3. Synthesize and return
    return this.synthesize(responses);
  }
}
```

### Request Flow Example

```
User: "Plan a trip to Paris for 2 people, June 20-25"
  ↓
Travel Planner:
  1. Analyze request
     → Needs weather: true
     → Needs accommodation: true
  
  2. Delegate to Weather Agent
     Request: "Weather in Paris, June 20-25"
     Response: "7-day forecast..."
  
  3. Delegate to Airbnb Agent
     Request: "Accommodations in Paris for 2 people, June 20-25"
     Response: "2 listings found..."
  
  4. Synthesize responses
     → Combine weather + accommodations
     → Format as travel plan
  
  5. Return to user
```

### Specialist Agent Pattern

Each specialist agent is a **standalone A2A agent**:

```typescript
// Weather Agent (agent.ts)
export function createWeatherAgent(model: LanguageModel) {
  return new ToolLoopAgent({
    model,
    instructions: getWeatherAgentPrompt(),
    tools: {
      get_weather_forecast: {
        description: "Get weather forecast...",
        inputSchema: weatherForecastSchema,
        execute: async (params) => {
          return await getWeatherForecast(params.location);
        },
      },
    },
  });
}
```

## Usage Examples

### Example 1: Weather Only

**Request**:
```bash
curl -X POST http://localhost:41252/plan \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the weather in Los Angeles?"}'
```

**Response**:
```json
{
  "query": "What is the weather in Los Angeles?",
  "response": "## Weather Forecast\n\nHere's the weather forecast for Los Angeles, CA:\n\n- **Date**: 2025-06-20\n- **High**: 78°F, Low: 62°F\n- **Conditions**: Partly cloudy\n- **Precipitation**: 0.0 inches\n\n..."
}
```

### Example 2: Accommodations Only

**Request**:
```bash
curl -X POST http://localhost:41252/plan \
  -H "Content-Type: application/json" \
  -d '{"query": "Find accommodations in Paris for 4 people"}'
```

**Response**:
```json
{
  "query": "Find accommodations in Paris for 4 people",
  "response": "## Accommodations\n\nHere are accommodations in Paris for 4 guests:\n\n### 1. Elegant Marais Loft\n- **Type**: Entire loft\n- **Price**: $280/night\n- **Capacity**: 4 guests, 2 bedrooms\n- **Rating**: 4.8 ⭐ (156 reviews)\n- **Book**: https://www.airbnb.com/rooms/paris-001\n\n..."
}
```

### Example 3: Full Travel Plan (Both Agents)

**Request**:
```bash
curl -X POST http://localhost:41252/plan \
  -H "Content-Type: application/json" \
  -d '{"query": "Plan a trip to Tokyo for 3 people"}'
```

**Response**:
```json
{
  "query": "Plan a trip to Tokyo for 3 people",
  "response": "# Your Travel Plan\n\n## Weather Forecast\n\n[Weather Agent response for Tokyo]\n\n## Accommodations\n\n[Airbnb Agent response for Tokyo, 3 guests]"
}
```

## Testing Individual Specialists

You can test each specialist agent independently:

### Test Weather Agent Directly

```bash
curl -X POST http://localhost:41250/message/send \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "role": "user",
      "parts": [{"kind": "text", "text": "Weather in Paris?"}]
    }
  }'
```

### Test Airbnb Agent Directly

```bash
curl -X POST http://localhost:41251/message/send \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "role": "user",
      "parts": [{"kind": "text", "text": "Find a room in Los Angeles for 2 people"}]
    }
  }'
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | ✅ (or other provider) | - | API key for LLM provider |
| `AI_PROVIDER` | ❌ | `openai` | Provider: openai, anthropic, google, etc. |
| `AI_MODEL` | ❌ | `gpt-4o-mini` | Model to use |

## Ports

| Agent | Port | Purpose |
|-------|------|---------|
| Weather Agent | 41250 | Specialist (weather forecasts) |
| Airbnb Agent | 41251 | Specialist (accommodation search) |
| Travel Planner | 41252 | Orchestrator (coordinates specialists) |

## Extending the System

### Add a New Specialist Agent

1. Create a new specialist agent directory:
   ```
   travel-planner-multiagent/restaurant-agent/
   ```

2. Implement the agent with AI SDK ToolLoopAgent:
   ```typescript
   export function createRestaurantAgent(model: LanguageModel) {
     return new ToolLoopAgent({
       model,
       tools: { search_restaurants: ... },
     });
   }
   ```

3. Expose via A2A (port 41253):
   ```typescript
   const app = new A2AHonoApp({
     agentCard,
     agentExecutor: adapter.createAgentExecutor(),
   });
   ```

4. Update the orchestrator:
   ```typescript
   const orchestrator = new TravelPlannerOrchestrator({
     model: getModel(),
     weatherAgent: { ... },
     airbnbAgent: { ... },
     restaurantAgent: { name: "Restaurant Agent", agentCardUrl: "..." },
   });
   ```

5. Add delegation logic:
   ```typescript
   if (analysis.needsRestaurants) {
     const response = await generateText({
       model: a2a(this.config.restaurantAgent.agentCardUrl),
       prompt: query,
     });
     responses.push(response.text);
   }
   ```

## Comparison to Python Example

| Feature | Python (Google ADK) | JavaScript (AI SDK) |
|---------|---------------------|---------------------|
| **Orchestrator** | Google ADK Agent | TravelPlannerOrchestrator |
| **Specialists** | ADK + MCP Tools | ToolLoopAgent + tools |
| **Delegation** | ADK send_message | a2a-ai-provider |
| **Tools** | MCP (Model Context Protocol) | Native TypeScript |
| **State** | ADK state management | In-memory |
| **Complexity** | High (3 frameworks) | Medium (AI SDK + A2A) |

**Key Difference**: Python uses Google ADK + MCP + A2A, while JavaScript uses AI SDK + A2A + a2a-ai-provider. The JavaScript version is simpler and more unified.

## Comparison to Single-Agent Examples

| Feature | Single Agents | Multi-Agent System |
|---------|---------------|-------------------|
| **Agents** | 1 | 3 (2 specialists + 1 orchestrator) |
| **Coordination** | None | Orchestrator delegates |
| **Scalability** | Limited | High (add specialists) |
| **Complexity** | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Use Case** | Simple tasks | Complex workflows |
| **a2a-ai-provider** | Not used | Core technology |

## Learning Path

This multi-agent example teaches:

### 1. Multi-Agent Orchestration
- How to coordinate multiple agents
- Delegation patterns
- Response synthesis

### 2. a2a-ai-provider Usage
```typescript
// Consume an A2A agent as a "model"
model: a2a('http://agent-url/.well-known/agent-card.json')
```

### 3. Specialist Agent Design
- Single responsibility principle
- Tool-based capabilities
- Protocol-agnostic implementation

### 4. Scalable Architecture
- Add new specialists without changing orchestrator core
- Each agent is independently testable
- Loose coupling via A2A protocol

## Troubleshooting

### Specialist Agent Not Responding
**Issue**: Orchestrator can't connect to Weather or Airbnb agent
**Solution**: Ensure all agents are running on correct ports (41250, 41251, 41252)

### Agent Connection Timeout
**Issue**: `a2a()` connection times out
**Solution**: Verify agent card URLs are accessible:
```bash
curl http://localhost:41250/.well-known/agent-card.json
curl http://localhost:41251/.well-known/agent-card.json
```

### No Weather Data
**Issue**: Weather Agent returns errors
**Solution**: Open-Meteo API is free but has rate limits. Wait a moment and retry.

### No Accommodations Found
**Issue**: Airbnb Agent finds no listings
**Solution**: Mock data only includes: Los Angeles, Paris, Tokyo, New York. Try one of these.

## Next Steps

After understanding the multi-agent system:
1. **Add More Specialists** - Restaurant agent, flight agent, etc.
2. **Persistent State** - Add Redis for conversation history
3. **Real APIs** - Integrate real Airbnb-like APIs
4. **Error Handling** - Implement retry logic and fallbacks
5. **Parallel Delegation** - Call multiple agents simultaneously

## Learn More

- [A2A Protocol Documentation](https://google.github.io/A2A/)
- [AI SDK Documentation](https://sdk.vercel.ai/docs)
- [a2a-ai-provider GitHub](https://github.com/dracoblue/a2a-ai-provider)
- [Open-Meteo API](https://open-meteo.com/)
- [Conversion Plan](../../../../../../../PYTHON_TO_JS_CONVERSION_PLAN.md)

## Disclaimer

**This is a demonstration system**:
- Weather data is from Open-Meteo (free API)
- Airbnb data is mocked (no real API available)
- Not intended for production use
- Demonstrates patterns and architectures

In production:
- Use real APIs with authentication
- Implement proper error handling and retries
- Add rate limiting and caching
- Secure agent communication
- Validate all external data

