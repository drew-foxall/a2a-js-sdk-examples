# A2A with MCP Registry Reference

> **Source**: `samples/python/agents/a2a_mcp/`
> **Our Implementation**: Partial - See `examples/workers/airbnb-mcp-server/` for MCP pattern ⚠️

## Overview

An advanced multi-agent system that uses MCP (Model Context Protocol) as a **registry** for dynamic agent discovery. This enables runtime discovery of agents without hardcoding URLs.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ORCHESTRATOR AGENT                            │
│                                                                      │
│  Responsibilities:                                                   │
│  1. Receive user query                                               │
│  2. Get plan from Planner Agent                                      │
│  3. For each task: discover agent via MCP, execute via A2A          │
│  4. Aggregate and summarize results                                  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌───────────────┐    ┌─────────────────┐    ┌─────────────────────┐
│PLANNER AGENT  │    │   MCP SERVER    │    │    TASK AGENTS      │
│               │    │   (Registry)    │    │                     │
│ Decomposes    │    │                 │    │ ┌─────────────────┐ │
│ user query    │    │ Resources:      │    │ │ Air Ticketing   │ │
│ into task DAG │    │ - Agent Cards   │    │ │ Agent           │ │
│               │    │                 │    │ └─────────────────┘ │
│ LangGraph     │    │ Tools:          │    │ ┌─────────────────┐ │
│               │    │ - find_agent    │    │ │ Hotel Booking   │ │
│               │    │ - list_agents   │    │ │ Agent           │ │
│               │    │ - get_flights   │    │ └─────────────────┘ │
│               │    │ - get_hotels    │    │ ┌─────────────────┐ │
│               │    │ - get_cars      │    │ │ Car Rental      │ │
│               │    │                 │    │ │ Agent           │ │
└───────────────┘    └─────────────────┘    │ └─────────────────┘ │
                                            └─────────────────────┘
```

## Key Concepts

### 1. MCP as Agent Registry

Instead of hardcoding agent URLs, store Agent Cards in an MCP server:

```
MCP Server
├── Resources
│   └── agent_cards/
│       ├── air_ticketing_agent.json
│       ├── hotel_booking_agent.json
│       ├── car_rental_agent.json
│       └── planner_agent.json
└── Tools
    ├── find_agent(query) → Best matching agent
    ├── list_agents() → All available agents
    ├── get_flights(from, to, date)
    ├── get_hotels(city, date)
    └── get_cars(city, date)
```

### 2. Dynamic Agent Discovery

```python
# Query MCP to find the best agent for a task
agent_card = await mcp_client.call_tool(
    'find_agent',
    {'query': 'I need to book a flight from NYC to LA'}
)
# Returns: air_ticketing_agent.json

# Then use A2A to communicate with that agent
a2a_client = A2AClient(agent_card)
result = await a2a_client.send_message(task)
```

### 3. Planning + Execution Separation

```
User: "Plan a trip to France for 2 people, June 15-22"
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│              PLANNER AGENT (LangGraph)              │
│                                                     │
│  Output: Task DAG                                   │
│  [                                                  │
│    { "task": "book_flights", "deps": [] },          │
│    { "task": "book_hotel", "deps": ["book_flights"]},│
│    { "task": "book_car", "deps": ["book_hotel"] }   │
│  ]                                                  │
└─────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│              ORCHESTRATOR AGENT                      │
│                                                     │
│  For each task:                                     │
│  1. find_agent(task.type) via MCP                   │
│  2. Execute task via A2A                            │
│  3. Store result                                    │
│  4. Handle failures → re-plan if needed             │
└─────────────────────────────────────────────────────┘
```

## MCP Server Implementation

### Resources (Agent Cards)

```python
# src/a2a_mcp/mcp/server.py

@mcp.resource("agent_cards/list")
async def list_agent_cards():
    """List all available agent cards"""
    cards = []
    for filename in os.listdir('agent_cards/'):
        if filename.endswith('.json'):
            with open(f'agent_cards/{filename}') as f:
                cards.append(json.load(f))
    return cards

@mcp.resource("agent_cards/{agent_name}")
async def get_agent_card(agent_name: str):
    """Get a specific agent card"""
    with open(f'agent_cards/{agent_name}.json') as f:
        return json.load(f)
```

### Tools

```python
@mcp.tool()
async def find_agent(query: str) -> dict:
    """Find the best agent for a given task query.
    
    Uses embeddings to match query against agent descriptions.
    
    Args:
        query: Description of the task to perform
        
    Returns:
        The Agent Card of the best matching agent
    """
    # Generate embedding for query
    query_embedding = await generate_embedding(query)
    
    # Compare against agent card embeddings
    best_match = None
    best_score = 0
    
    for card in await list_agent_cards():
        card_embedding = await generate_embedding(card['description'])
        score = cosine_similarity(query_embedding, card_embedding)
        if score > best_score:
            best_score = score
            best_match = card
    
    return best_match

@mcp.tool()
async def get_flights(
    origin: str,
    destination: str,
    date: str,
    passengers: int = 1
) -> list[dict]:
    """Search for available flights.
    
    Args:
        origin: Departure city/airport code
        destination: Arrival city/airport code
        date: Travel date (YYYY-MM-DD)
        passengers: Number of passengers
        
    Returns:
        List of available flights with prices
    """
    # Query SQLite database
    conn = sqlite3.connect('travel_agency.db')
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM flights 
        WHERE origin = ? AND destination = ? AND date = ?
    ''', (origin, destination, date))
    return cursor.fetchall()

@mcp.tool()
async def get_hotels(city: str, checkin: str, checkout: str) -> list[dict]:
    """Search for available hotels."""
    # Similar database query...

@mcp.tool()
async def get_cars(city: str, pickup_date: str, return_date: str) -> list[dict]:
    """Search for available rental cars."""
    # Similar database query...
```

## Agent Card Examples

### Air Ticketing Agent

```json
{
  "name": "Air Ticketing Agent",
  "description": "Specialist agent for booking flights. Can search for flights, compare prices, and handle reservations.",
  "url": "http://localhost:10103/",
  "version": "1.0.0",
  "capabilities": {
    "streaming": true
  },
  "skills": [
    {
      "id": "flight_search",
      "name": "Flight Search",
      "description": "Search for available flights between cities",
      "tags": ["flights", "travel", "booking"]
    },
    {
      "id": "flight_booking",
      "name": "Flight Booking",
      "description": "Book a flight reservation",
      "tags": ["flights", "booking", "reservation"]
    }
  ]
}
```

### Hotel Booking Agent

```json
{
  "name": "Hotel Booking Agent",
  "description": "Specialist agent for hotel reservations. Can search for hotels, check availability, and make bookings.",
  "url": "http://localhost:10104/",
  "version": "1.0.0",
  "skills": [
    {
      "id": "hotel_search",
      "name": "Hotel Search",
      "description": "Search for available hotels in a city"
    },
    {
      "id": "hotel_booking",
      "name": "Hotel Booking",
      "description": "Book a hotel reservation"
    }
  ]
}
```

## Orchestrator Agent Flow

```python
class OrchestratorAgent:
    def __init__(self, mcp_client, planner_agent_url):
        self.mcp = mcp_client
        self.planner_url = planner_agent_url
        
    async def execute(self, user_query: str):
        # Step 1: Get plan from Planner Agent
        planner_card = await self.mcp.call_tool('find_agent', {'query': 'planning'})
        planner = A2AClient(planner_card)
        plan = await planner.send_message(f"Create a plan for: {user_query}")
        
        results = {}
        
        # Step 2: Execute each task in the plan
        for task in plan.tasks:
            # Find the right agent for this task
            agent_card = await self.mcp.call_tool('find_agent', {'query': task.type})
            
            # Execute task via A2A
            agent = A2AClient(agent_card)
            try:
                result = await agent.send_message(task.description)
                results[task.id] = result
            except Exception as e:
                # Handle failure - might trigger re-planning
                results[task.id] = {'error': str(e)}
                
        # Step 3: Summarize results
        summary = await self.summarize(user_query, results)
        return summary
```

## Example Flow: Travel Booking

```
User: "Book a trip to Paris for 2 people, June 15-22, budget $3000"
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ORCHESTRATOR                                │
│                                                                  │
│  1. find_agent("planning") → Planner Agent                       │
│  2. A2A → Planner: "Create plan for Paris trip..."               │
│                                                                  │
│  Plan received:                                                  │
│  - Task 1: Search flights NYC→Paris, June 15                     │
│  - Task 2: Search flights Paris→NYC, June 22                     │
│  - Task 3: Search hotels in Paris, June 15-22                    │
│  - Task 4: (Optional) Search car rentals                         │
└─────────────────────────────────────────────────────────────────┘
                    │
        ┌───────────┼───────────┬───────────┐
        ▼           ▼           ▼           ▼
   find_agent   find_agent   find_agent   find_agent
   ("flights")  ("flights")  ("hotels")   ("cars")
        │           │           │           │
        ▼           ▼           ▼           ▼
   A2A call     A2A call     A2A call     A2A call
   to Air       to Air       to Hotel     to Car
   Ticketing    Ticketing    Booking      Rental
        │           │           │           │
        └───────────┴───────────┴───────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ORCHESTRATOR                                │
│                                                                  │
│  Aggregate results:                                              │
│  - Flights: $800 round trip                                      │
│  - Hotel: $1200 for 7 nights                                     │
│  - Car: $300 for 7 days                                          │
│  - Total: $2300 (under budget!)                                  │
│                                                                  │
│  Check budget → OK                                               │
│  Return summary to user                                          │
└─────────────────────────────────────────────────────────────────┘
```

## Benefits of MCP Registry Pattern

| Benefit | Description |
|---------|-------------|
| **Dynamic Discovery** | Add/remove agents without code changes |
| **Capability Matching** | Find agents by what they can do, not by name |
| **Centralized Management** | Single place to manage all agent metadata |
| **Scalability** | Easy to add new specialist agents |
| **Fallback Support** | Can find alternative agents if primary is unavailable |

## TypeScript Implementation Considerations

### MCP Server

```typescript
// Could use @modelcontextprotocol/sdk for TypeScript MCP server
import { Server } from "@modelcontextprotocol/sdk/server";

const server = new Server({
  name: "agent-registry",
  version: "1.0.0",
});

// Register resources
server.resource("agent_cards/list", async () => {
  return listAgentCards();
});

// Register tools
server.tool("find_agent", {
  description: "Find best agent for a task",
  parameters: z.object({
    query: z.string(),
  }),
  execute: async ({ query }) => {
    return findBestAgent(query);
  },
});
```

### Orchestrator with MCP Client

```typescript
import { Client } from "@modelcontextprotocol/sdk/client";

class Orchestrator {
  private mcp: Client;
  
  async findAgent(taskDescription: string): Promise<AgentCard> {
    const result = await this.mcp.callTool("find_agent", {
      query: taskDescription,
    });
    return result as AgentCard;
  }
  
  async executeTask(task: Task): Promise<TaskResult> {
    const agentCard = await this.findAgent(task.type);
    const a2aClient = new A2AClient(agentCard.url);
    return await a2aClient.sendMessage(task.description);
  }
}
```

## When to Use This Pattern

**Use MCP Registry when:**
- You have many specialist agents (5+)
- Agents are added/removed frequently
- You want capability-based routing
- Multiple orchestrators need to discover agents

**Simpler alternatives:**
- Few agents → Hardcode URLs
- Static agent set → Config file
- Single orchestrator → Direct A2A calls

---

## Checklist for Implementation

- [x] MCP Server pattern (`workers/airbnb-mcp-server/`)
- [x] A2A agents that use MCP tools (`travel-planner-multiagent/airbnb-agent/`)
- [ ] MCP Server as agent registry (advanced)
- [ ] `find_agent` tool with embedding-based matching
- [ ] Orchestrator with MCP-based agent discovery
- [ ] Re-planning on task failure

**Note**: Our current implementation uses MCP for tool access (Airbnb API) rather than
agent registry. The registry pattern is an advanced use case for larger systems.

