# Airbnb Planner Multi-Agent Reference

> **Source**: `samples/python/agents/airbnb_planner_multiagent/`
> **Our Implementation**: `examples/agents/travel-planner-multiagent/` + `examples/workers/travel-planner/`

## Overview

A multi-agent orchestration system for travel planning. The **host agent** routes user queries to **specialist agents** (Weather, Airbnb) using the A2A protocol.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         HOST AGENT                               │
│                    (Routing/Orchestrator)                        │
│                                                                  │
│  Model: gemini-2.5-flash-lite                                   │
│  Framework: Google ADK                                           │
│                                                                  │
│  Tool: send_message(agent_name, task)                           │
│        └─► Routes to specialist agents via A2A protocol         │
└─────────────────────────┬───────────────────────────────────────┘
                          │
           ┌──────────────┴──────────────┐
           │                             │
           ▼                             ▼
┌─────────────────────┐       ┌─────────────────────┐
│    WEATHER AGENT    │       │    AIRBNB AGENT     │
│                     │       │                     │
│  Model: gemini-2.5  │       │  Model: Gemini/     │
│  Framework: ADK+MCP │       │         VertexAI    │
│                     │       │  Framework:         │
│  Tools (via MCP):   │       │    LangGraph        │
│  - get_alerts       │       │                     │
│  - get_forecast     │       │  Tools (via MCP):   │
│  - get_forecast_    │       │  - search_listings  │
│    by_city          │       │  - get_listing_     │
│                     │       │    details          │
│  Port: 10001        │       │  Port: 10002        │
└─────────────────────┘       └─────────────────────┘
```

## Host Agent (Routing Agent)

### Agent Card

```json
{
  "name": "Travel Planner",
  "description": "Multi-agent orchestrator for travel planning",
  "version": "1.0.0",
  "capabilities": {
    "streaming": true
  },
  "skills": [
    {
      "id": "travel_planning",
      "name": "Travel Planning",
      "description": "Coordinates weather and accommodation searches",
      "tags": ["travel", "planning", "orchestration"],
      "examples": [
        "Plan a trip to Paris",
        "What's the weather in LA and find me a place to stay"
      ]
    }
  ]
}
```

### System Prompt

```
**Role:** You are an expert Routing Delegator. Your primary function is to accurately delegate user inquiries regarding weather or accommodations to the appropriate specialized remote agents.

**Core Directives:**

* **Task Delegation:** Utilize the `send_message` function to assign actionable tasks to remote agents.

* **Contextual Awareness for Remote Agents:** If a remote agent repeatedly requests user confirmation, assume it lacks access to the full conversation history. In such cases, enrich the task description with all necessary contextual information relevant to that specific agent.

* **Autonomous Agent Engagement:** Never seek user permission before engaging with remote agents. If multiple agents are required to fulfill a request, connect with them directly without requesting user preference or confirmation.

* **Transparent Communication:** Always present the complete and detailed response from the remote agent to the user.

* **User Confirmation Relay:** If a remote agent asks for confirmation, and the user has not already provided it, relay this confirmation request to the user.

* **Focused Information Sharing:** Provide remote agents with only relevant contextual information. Avoid extraneous details.

* **No Redundant Confirmations:** Do not ask remote agents for confirmation of information or actions.

* **Tool Reliance:** Strictly rely on available tools to address user requests. Do not generate responses based on assumptions. If information is insufficient, request clarification from the user.

* **Prioritize Recent Interaction:** Focus primarily on the most recent parts of the conversation when processing requests.

* **Active Agent Prioritization:** If an active agent is already engaged, route subsequent related requests to that agent using the appropriate task update tool.

**Agent Roster:**

* Available Agents: `{self.agents}`
* Currently Active Seller Agent: `{current_agent['active_agent']}`
```

### Dynamic Routing Tool

```python
async def send_message(
    self, agent_name: str, task: str, tool_context: ToolContext
):
    """Sends a task to remote seller agent.

    This will send a message to the remote agent named agent_name.

    Args:
        agent_name: The name of the agent to send the task to.
        task: The comprehensive conversation context summary
            and goal to be achieved regarding user inquiry and purchase request.
        tool_context: The tool context this method runs in.

    Yields:
        A dictionary of JSON data.
    """
    if agent_name not in self.remote_agent_connections:
        raise ValueError(f'Agent {agent_name} not found')
        
    state = tool_context.state
    state['active_agent'] = agent_name
    client = self.remote_agent_connections[agent_name]

    payload = {
        'message': {
            'role': 'user',
            'parts': [{'type': 'text', 'text': task}],
            'messageId': message_id,
        },
    }

    if task_id:
        payload['message']['taskId'] = task_id
    if context_id:
        payload['message']['contextId'] = context_id

    message_request = SendMessageRequest(
        id=message_id, params=MessageSendParams.model_validate(payload)
    )
    send_response = await client.send_message(message_request=message_request)

    if not isinstance(send_response.root, SendMessageSuccessResponse):
        return None
    if not isinstance(send_response.root.result, Task):
        return None

    return send_response.root.result
```

### Agent Discovery at Startup

```python
async def _async_init_components(self, remote_agent_addresses: list[str]) -> None:
    """Discover remote agents by fetching their Agent Cards."""
    async with httpx.AsyncClient(timeout=30) as client:
        for address in remote_agent_addresses:
            card_resolver = A2ACardResolver(client, address)
            try:
                card = await card_resolver.get_agent_card()
                remote_connection = RemoteAgentConnections(
                    agent_card=card, agent_url=address
                )
                self.remote_agent_connections[card.name] = remote_connection
                self.cards[card.name] = card
            except Exception as e:
                print(f'ERROR: Failed to get agent card from {address}: {e}')

    # Build agent roster for prompt
    agent_info = []
    for agent_detail_dict in self.list_remote_agents():
        agent_info.append(json.dumps(agent_detail_dict))
    self.agents = '\n'.join(agent_info)
```

### Agent Roster Format

```json
{"name": "Weather Agent", "description": "An agent that can help questions about weather"}
{"name": "Airbnb Agent", "description": "A specialized assistant for Airbnb accommodations"}
```

---

## Weather Agent

### System Prompt

```
You are a specialized weather forecast assistant. Your primary function is to utilize the provided tools to retrieve and relay weather information in response to user queries. You must rely exclusively on these tools for data and refrain from inventing information. Ensure that all responses include the detailed output from the tools used and are formatted in Markdown.
```

### Agent Creation (ADK + MCP)

```python
def create_weather_agent() -> LlmAgent:
    LITELLM_MODEL = os.getenv('LITELLM_MODEL', 'gemini-2.5-flash')
    return LlmAgent(
        model=LiteLlm(model=LITELLM_MODEL),
        name='weather_agent',
        description='An agent that can help questions about weather',
        instruction="""...""",  # System prompt above
        tools=[
            MCPToolset(
                connection_params=StdioServerParameters(
                    command='python',
                    args=['./weather_mcp.py'],
                ),
            )
        ],
    )
```

### MCP Tools (weather_mcp.py)

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP('weather')

@mcp.tool()
async def get_alerts(state: str) -> str:
    """Get active weather alerts for a specific US state.

    Args:
        state: The two-letter US state code (e.g., CA, NY, TX).
    """
    endpoint = f'/alerts/active/area/{state.upper()}'
    data = await get_weather_response(endpoint)
    # Format and return alerts...

@mcp.tool()
async def get_forecast(latitude: float, longitude: float) -> str:
    """Get the weather forecast for a specific location.

    Args:
        latitude: The latitude of the location (e.g., 34.05).
        longitude: The longitude of the location (e.g., -118.25).
    """
    point_endpoint = f'/points/{latitude:.4f},{longitude:.4f}'
    # Fetch from NWS API...

@mcp.tool()
async def get_forecast_by_city(city: str, state: str) -> str:
    """Get weather forecast for a US city by geocoding first.

    Args:
        city: The name of the city (e.g., "Los Angeles").
        state: The two-letter US state code (e.g., CA).
    """
    # Geocode city -> lat/lon
    location = geolocator.geocode(f'{city}, {state}, USA')
    return await get_forecast(location.latitude, location.longitude)

if __name__ == '__main__':
    mcp.run(transport='stdio')
```

---

## Airbnb Agent

### System Prompt

```
You are a specialized assistant for Airbnb accommodations. Your primary function is to utilize the provided tools to search for Airbnb listings and answer related questions. You must rely exclusively on these tools for information; do not invent listings or prices. Ensure that your Markdown-formatted response includes all relevant tool output, with particular emphasis on providing direct links to listings.
```

### Structured Response Format

```python
class ResponseFormat(BaseModel):
    """Respond to the user in this format."""
    status: Literal['input_required', 'completed', 'error'] = 'input_required'
    message: str

RESPONSE_FORMAT_INSTRUCTION = (
    'Select status as "completed" if the request is fully addressed. '
    'Select status as "input_required" if you need more information. '
    'Select status as "error" if an error occurred.'
)
```

### Agent Creation (LangGraph)

```python
class AirbnbAgent:
    def __init__(self, mcp_tools: list[Any]):
        if os.getenv('GOOGLE_GENAI_USE_VERTEXAI') == 'TRUE':
            self.model = ChatVertexAI(model=model)
        else:
            self.model = ChatGoogleGenerativeAI(model=model)

        self.mcp_tools = mcp_tools

    async def ainvoke(self, query: str, session_id: str) -> dict[str, Any]:
        airbnb_agent_runnable = create_react_agent(
            self.model,
            tools=self.mcp_tools,
            checkpointer=memory,
            prompt=self.SYSTEM_INSTRUCTION,
            response_format=(self.RESPONSE_FORMAT_INSTRUCTION, ResponseFormat),
        )
        
        config = {'configurable': {'thread_id': session_id}}
        langgraph_input = {'messages': [('user', query)]}
        
        await airbnb_agent_runnable.ainvoke(langgraph_input, config)
        return self._get_agent_response_from_state(config, airbnb_agent_runnable)
```

---

## Multi-Agent Communication Flow

### Example: "What's the weather in LA and find me a place to stay"

```
User ──────────────────────────────────────────────────────────────►
      "What's the weather in LA and find me a place to stay"
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         HOST AGENT                               │
│                                                                  │
│  LLM Reasoning:                                                  │
│  "User wants BOTH weather AND accommodation.                     │
│   I need to call both specialist agents."                        │
│                                                                  │
│  Tool Calls:                                                     │
│  1. send_message("Weather Agent", "Get weather for Los Angeles") │
│  2. send_message("Airbnb Agent", "Search listings in LA")        │
└─────────────────────────────────────────────────────────────────┘
                    │                           │
                    ▼                           ▼
        ┌───────────────────┐       ┌───────────────────┐
        │   WEATHER AGENT   │       │   AIRBNB AGENT    │
        │                   │       │                   │
        │ A2A Request:      │       │ A2A Request:      │
        │ "Get weather for  │       │ "Search listings  │
        │  Los Angeles"     │       │  in LA"           │
        │                   │       │                   │
        │ MCP Tool:         │       │ MCP Tool:         │
        │ get_forecast_     │       │ search_listings   │
        │   by_city("LA")   │       │   ("LA")          │
        │                   │       │                   │
        │ Response:         │       │ Response:         │
        │ "LA: 72°F, sunny" │       │ "Found 5 listings │
        │                   │       │  starting at $89" │
        └───────────────────┘       └───────────────────┘
                    │                           │
                    └───────────┬───────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         HOST AGENT                               │
│                                                                  │
│  Combines results:                                               │
│  "Here's your LA trip info:                                      │
│                                                                  │
│   **Weather:** 72°F and sunny, perfect for sightseeing!          │
│                                                                  │
│   **Accommodations:** Found 5 great options starting at $89/night│
│   - Cozy Studio in Hollywood - $89/night                         │
│   - Beach House in Santa Monica - $150/night                     │
│   ..."                                                           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
◄─────────────────────────────────────────────────────────────── User
      Combined response with weather + accommodations
```

---

## Our TypeScript Implementation

### Current Approach (Separate Tools)

```typescript
// examples/workers/travel-planner/src/index.ts

function createPlannerAgentWithBindings(model: LanguageModel, env: PlannerEnv) {
  return new ToolLoopAgent({
    model,
    instructions: PLANNER_INSTRUCTIONS,
    tools: {
      // Separate tool for weather
      getWeatherForecast: {
        description: "Get weather forecast for a location",
        inputSchema: weatherForecastSchema,
        execute: async (params) => {
          return await callSpecialistAgent(
            env.WEATHER_AGENT,
            `What is the weather forecast for ${params.location}?`
          );
        },
      },
      // Separate tool for accommodations
      searchAccommodations: {
        description: "Search for Airbnb accommodations",
        inputSchema: accommodationSearchSchema,
        execute: async (params) => {
          return await callSpecialistAgent(
            env.AIRBNB_AGENT,
            `Search for Airbnb listings in ${params.location}`
          );
        },
      },
    },
  });
}
```

### Python Approach (Dynamic Routing)

```typescript
// Recommended: Match Python's dynamic routing pattern

function createPlannerAgentWithDynamicRouting(model: LanguageModel, env: PlannerEnv) {
  // Discover agents at startup
  const agentRoster = discoverAgents(env);
  
  return new ToolLoopAgent({
    model,
    instructions: `
      You are an expert Routing Delegator...
      
      **Agent Roster:**
      ${agentRoster.map(a => `- ${a.name}: ${a.description}`).join('\n')}
    `,
    tools: {
      // Single dynamic routing tool
      sendMessage: {
        description: "Send a task to a specialist agent",
        inputSchema: z.object({
          agentName: z.string().describe("Name of the agent to call"),
          task: z.string().describe("Task description for the agent"),
        }),
        execute: async ({ agentName, task }) => {
          const agent = agentRoster.find(a => a.name === agentName);
          if (!agent) throw new Error(`Agent ${agentName} not found`);
          return await callSpecialistAgent(agent.binding, task);
        },
      },
    },
  });
}
```

### Key Differences

| Aspect | Python | Our Current | Recommended |
|--------|--------|-------------|-------------|
| Routing | Dynamic `send_message` | Separate tools | Match Python |
| Discovery | Fetch Agent Cards | Hardcoded | Dynamic discovery |
| Agent Roster | In prompt | Not exposed | Add to prompt |
| Active Agent | State tracking | Not implemented | Add state |

---

## Testing

### Start All Agents

```bash
# Terminal 1: Weather Agent
cd examples/workers/weather-agent && wrangler dev --port 8788

# Terminal 2: Airbnb Agent  
cd examples/workers/airbnb-agent && wrangler dev --port 8789

# Terminal 3: Travel Planner (Host)
cd examples/workers/travel-planner && wrangler dev --port 8787
```

### Test Multi-Agent Query

```bash
curl -X POST http://localhost:8787/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "id": "test",
    "params": {
      "message": {
        "role": "user",
        "messageId": "msg-1",
        "parts": [{"kind": "text", "text": "Plan a trip to Tokyo. What is the weather and find me accommodations."}]
      }
    }
  }'
```

---

## Checklist for Implementation

### Host Agent (Travel Planner)
- [x] Agent Card with orchestration skill
- [x] System prompt for routing (Routing Delegator pattern)
- [x] Tool to call Weather Agent
- [x] Tool to call Airbnb Agent
- [x] Service Bindings (Cloudflare)
- [x] Dynamic `sendMessage` tool (matches Python `send_message`)
- [x] Agent discovery at startup (fetches Agent Cards)
- [x] Agent roster in prompt (JSON-lines format)
- [x] Active agent state tracking

### Weather Agent
- [x] Agent Card
- [x] System prompt
- [x] Weather forecast tool
- [x] Open-Meteo API integration (global coverage, unlike Python's US-only NWS)
- [x] Service Binding access from orchestrator
- [ ] MCP server pattern (uses direct API instead)

### Airbnb Agent
- [x] Agent Card
- [x] System prompt
- [x] Search listings tool
- [x] Service Binding access from orchestrator
- [x] Real Airbnb data via MCP (@openbnb/mcp-server-airbnb)
- [ ] Structured response format (ResponseFormat class)

