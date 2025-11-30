# Travel Planner Agent Reference

> **Source**: `samples/python/agents/travel_planner_agent/`
> **Our Implementation**: N/A (single-agent, simpler than our multi-agent version)

## Overview

A simple single-agent travel assistant using LangChain and ChatOpenAI. This is a straightforward implementation without tools or multi-agent orchestration - just an LLM with a travel-focused system prompt.

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Client    │────►│  A2A Protocol   │────►│  LangChain LLM  │
│             │◄────│  (JSON-RPC)     │◄────│  (ChatOpenAI)   │
└─────────────┘     └─────────────────┘     └─────────────────┘
```

## Key Components

### 1. Agent Class (LangChain)

```python
class TravelPlannerAgent:
    def __init__(self):
        self.model = ChatOpenAI(
            model=config['model_name'] or 'gpt-4o',
            base_url=config['base_url'] or None,
            api_key=api_key,
            temperature=0.7,
        )
```

### 2. System Prompt

```python
SystemMessage(content="""
You are an expert travel assistant specializing in trip planning, 
destination information, and travel recommendations.

When providing information:
- Be specific and practical with your advice
- Consider seasonality, budget constraints, and travel logistics
- Highlight cultural experiences and authentic local activities
- Include practical travel tips relevant to the destination

For itineraries:
- Create realistic day-by-day plans
- Balance popular tourist sites with off-the-beaten-path experiences
- Include approximate timing and practical logistics
- Suggest meal options highlighting local cuisine
""")
```

### 3. Streaming Response

```python
async def stream(self, query: str) -> AsyncGenerator[dict[str, Any], None]:
    messages = [SystemMessage(content=SYSTEM_PROMPT)]
    messages.append(HumanMessage(content=query))
    
    async for chunk in self.model.astream(messages):
        if hasattr(chunk, 'content') and chunk.content:
            yield {'content': chunk.content, 'done': False}
    yield {'content': '', 'done': True}
```

## Comparison with Our Multi-Agent Version

| Aspect | Python Single-Agent | Our Multi-Agent |
|--------|---------------------|-----------------|
| Architecture | Single LLM | Orchestrator + Specialists |
| Tools | None | Weather, Airbnb via A2A |
| Real Data | No | Yes (via specialist agents) |
| Complexity | Low | Higher |
| Extensibility | Limited | Add agents without code changes |

## Key Differences

This Python example is simpler than our implementation:

1. **No tools** - Pure LLM conversation
2. **No external data** - All knowledge from model training
3. **No multi-agent** - Single agent handles everything
4. **No dynamic routing** - Fixed behavior

## Our Approach

We chose to implement a more sophisticated multi-agent version because:

1. **Real-time data** - Weather and accommodation info via specialist agents
2. **Extensibility** - Add new capabilities by adding agents
3. **Separation of concerns** - Each agent is focused and testable
4. **A2A showcase** - Demonstrates the protocol's multi-agent capabilities

## Checklist for Implementation

- [x] Basic travel planning agent (via multi-agent orchestrator)
- [x] System prompt for travel expertise
- [x] Streaming responses
- [x] Real-time weather data (via Weather Agent)
- [x] Accommodation search (via Airbnb Agent)
- [x] Worker deployment

## Notes

This Python example serves as a baseline for comparison. Our implementation goes beyond it by demonstrating:
- Dynamic agent discovery
- Tool-based routing to specialists
- Service Binding communication in Workers
- The full power of the A2A protocol for multi-agent systems

