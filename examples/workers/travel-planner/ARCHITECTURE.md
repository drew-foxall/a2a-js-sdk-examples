# Travel Planner Worker - Architecture Plan

## Directory Structure

```
examples/
  agents/src/agents/travel-planner-multiagent/
    planner/
      agent.ts              # Agent internal logic (createPlannerAgent)
      agent-discovery.ts    # AgentRegistry, fetchAgentCard, discovery
      prompt.ts             # System prompt template
      index.ts              # Local Node.js server (Hono + @hono/node-server)
    weather-agent/
      agent.ts              # Weather agent logic
      tools.ts              # Weather API functions
      prompt.ts             # Weather prompt
      index.ts              # Local Node.js server
    airbnb-agent/
      agent.ts              # Airbnb agent logic  
      tools.mock.ts         # Mock Airbnb tools
      prompt.ts             # Airbnb prompt
      index.ts              # Local Node.js server

  workers/
    travel-planner/
      src/index.ts          # Cloudflare Worker implementation
    weather-agent/
      src/index.ts          # Cloudflare Worker implementation
    airbnb-agent/
      src/index.ts          # Cloudflare Worker implementation
```

---

## Separation of Concerns

### Agent Files (in `examples/agents/`)

**Responsibility**: Internal agent logic that is platform-agnostic

| File | Contents |
|------|----------|
| `agent.ts` | `createXxxAgent()` factory, tool definitions, agent behavior |
| `prompt.ts` | System prompt template |
| `tools.ts` | Pure functions for tool execution (API calls, etc.) |
| `agent-discovery.ts` | `AgentRegistry` class, `fetchAgentCard()` |
| `index.ts` | Local Node.js server using `@hono/node-server` |

### Worker Files (in `examples/workers/`)

**Responsibility**: Cloudflare-specific implementation

| File | Contents |
|------|----------|
| `src/index.ts` | Hono app, environment handling, A2A protocol wiring |

**Worker should:**
- Import agent factory from `a2a-agents`
- Handle Cloudflare environment (`env.OPENAI_API_KEY`, etc.)
- Handle Service Bindings (`env.WEATHER_AGENT`, etc.)
- Create Agent Card with dynamic `baseUrl`
- Wire up A2A protocol routes
- Handle CORS, security middleware

**Worker should NOT:**
- Duplicate agent logic
- Duplicate tool definitions
- Duplicate prompt logic

---

## The Problem: Travel Planner is Different

The Travel Planner agent has a unique challenge:

### Simple Agents (Hello World, Weather, Dice)

```typescript
// agent.ts - platform-agnostic
export function createWeatherAgent(model: LanguageModel) {
  return new ToolLoopAgent({
    model,
    instructions: getWeatherAgentPrompt(),
    tools: {
      get_weather_forecast: {
        inputSchema: weatherSchema,
        execute: async (params) => {
          return await getWeatherForecast(params.location);  // Pure function
        },
      },
    },
  });
}

// worker index.ts - just imports and wires
const agent = createWeatherAgent(getModel(env));
const executor = new A2AAdapter(agent, { mode: "stream" });
```

### Travel Planner (Orchestrator)

The `sendMessage` tool needs to **call other agents**, which requires:
1. **Agent registry** - list of available agents
2. **Communication mechanism** - HTTP or Service Binding
3. **State** - tracking active agent

```typescript
// agent.ts - but HOW does execute() call other agents?
export function createPlannerAgent(model: LanguageModel, ???) {
  return new ToolLoopAgent({
    model,
    instructions: getTravelPlannerPrompt({ agentRoster, activeAgent }),
    tools: {
      sendMessage: {
        execute: async ({ agentName, task }) => {
          // HOW do we call the agent?
          // - Local: HTTP via a2a-ai-provider
          // - Worker: Service Binding OR HTTP
        },
      },
    },
  });
}
```

---

## Solution: Dependency Injection for Communication

The agent logic should not know HOW to communicate. It should receive a function that handles communication.

### Agent File (`planner/agent.ts`)

```typescript
/**
 * Options for sendMessage (matches Python's taskId/contextId support)
 */
export interface SendMessageOptions {
  /** Task ID for conversation continuity */
  taskId?: string;
  /** Context ID for session tracking */
  contextId?: string;
}

/**
 * Function type for sending messages to other agents
 */
export type SendMessageFn = (
  agentName: string, 
  task: string,
  options?: SendMessageOptions
) => Promise<string>;

/**
 * Configuration for the Travel Planner agent
 */
export interface PlannerAgentConfig {
  model: LanguageModel;
  agentRoster: string;           // JSON-lines format
  activeAgent: string | null;
  sendMessage: SendMessageFn;    // Injected communication function
  onActiveAgentChange?: (agentName: string) => void;
}

/**
 * Create a Travel Planner agent
 * 
 * The sendMessage function is injected, so this works in any environment.
 */
export function createPlannerAgent(config: PlannerAgentConfig) {
  const { model, agentRoster, activeAgent, sendMessage, onActiveAgentChange } = config;

  return new ToolLoopAgent({
    model,
    instructions: getTravelPlannerPrompt({ agentRoster, activeAgent }),
    tools: {
      sendMessage: {
        description: "Send a task to a specialist agent by name",
        inputSchema: sendMessageSchema,
        execute: async ({ agentName, task }) => {
          // Notify state change
          onActiveAgentChange?.(agentName);
          
          // Use injected function - doesn't know if it's HTTP or Service Binding
          return await sendMessage(agentName, task);
        },
      },
    },
  });
}
```

### Local Server (`planner/index.ts`)

```typescript
import { a2a } from "a2a-ai-provider";
import { generateText } from "ai";
import { createPlannerAgent } from "./agent";
import { AgentRegistry, discoverAgents } from "./agent-discovery";

// Discover agents via HTTP
const registry = await discoverAgents({
  weatherAgent: "http://localhost:41252",
  airbnbAgent: "http://localhost:41253",
});

let activeAgent: string | null = null;

// Create agent with HTTP-based sendMessage
const agent = createPlannerAgent({
  model: getModel(),
  agentRoster: registry.buildAgentRoster(),
  activeAgent,
  sendMessage: async (agentName, task) => {
    const agent = registry.getAgent(agentName);
    if (!agent) throw new Error(`Agent ${agentName} not found`);
    
    // Use a2a-ai-provider for HTTP communication
    const result = await generateText({
      model: a2a(agent.url),
      prompt: task,
    });
    return result.text;
  },
  onActiveAgentChange: (name) => { activeAgent = name; },
});
```

### Cloudflare Worker (`workers/travel-planner/src/index.ts`)

```typescript
import { createPlannerAgent } from "a2a-agents/agents/travel-planner-multiagent/planner/agent";
import { getTravelPlannerPrompt } from "a2a-agents";

// Build registry from Service Bindings
const registry = await buildWorkerRegistry(env);

let activeAgent: string | null = null;

// Create agent with Service Binding-based sendMessage
const agent = createPlannerAgent({
  model: getModel(env),
  agentRoster: buildAgentRoster(registry),
  activeAgent,
  sendMessage: async (agentName, task) => {
    const agent = registry.get(agentName);
    if (!agent) throw new Error(`Agent ${agentName} not found`);
    
    // Use Service Binding for Cloudflare
    if (agent.binding) {
      return await callViaServiceBinding(agent.binding, task);
    }
    // Fallback to HTTP
    return await callViaHttp(agent.fallbackUrl, task);
  },
  onActiveAgentChange: (name) => { activeAgent = name; },
});
```

---

## File Responsibilities (Final)

### `examples/agents/src/agents/travel-planner-multiagent/planner/`

| File | Responsibility |
|------|----------------|
| `agent.ts` | `createPlannerAgent(config)` - accepts injected `sendMessage` function |
| `prompt.ts` | `getTravelPlannerPrompt({ agentRoster, activeAgent })` |
| `agent-discovery.ts` | `AgentRegistry` class, `fetchAgentCard()`, `discoverAgents()` |
| `index.ts` | Local Node.js server - provides HTTP-based `sendMessage` |

### `examples/workers/travel-planner/src/`

| File | Responsibility |
|------|----------------|
| `index.ts` | Hono app, A2A routes, Agent Card |
| `registry.ts` | `buildWorkerRegistry(env)` - from Service Bindings |
| `communication.ts` | `callViaServiceBinding()`, `callViaHttp()` |
| `types.ts` | `PlannerEnv`, `WorkerRegisteredAgent` |

---

## Implementation Checklist

### Step 1: Update Agent File

- [ ] Modify `planner/agent.ts` to accept `SendMessageFn` via config
- [ ] Remove direct `a2a-ai-provider` dependency from agent.ts
- [ ] Export `SendMessageFn` type

### Step 2: Update Local Server

- [ ] Modify `planner/index.ts` to provide HTTP-based `sendMessage`
- [ ] Keep using `a2a-ai-provider` here

### Step 3: Create Worker Files

- [ ] `src/index.ts` - Main Hono app
- [ ] `src/registry.ts` - Service Binding registry builder
- [ ] `src/communication.ts` - Service Binding + HTTP fallback
- [ ] `src/types.ts` - Environment types

### Step 4: Wire Up Worker

- [ ] Import `createPlannerAgent` from `a2a-agents`
- [ ] Provide Cloudflare-specific `sendMessage`
- [ ] Handle Agent Card, A2A routes

---

## Questions Resolved

**Q: Can we import agent logic from `a2a-agents`?**
A: Yes, by injecting the communication function.

**Q: Where does Service Binding logic live?**
A: In worker files (`communication.ts`), not in agent files.

**Q: How do we handle state (`activeAgent`)?**
A: Via `onActiveAgentChange` callback, state lives in the server/worker.

**Q: Is `AgentRegistry` shared?**
A: The class is shared, but workers build their own registry from env.

---

## Python Compatibility Checklist

| Python Feature | Our Support | Notes |
|----------------|-------------|-------|
| `send_message(agent_name, task)` | ✅ | Via injected `SendMessageFn` |
| `state['active_agent']` tracking | ✅ | Via `onActiveAgentChange` callback |
| `remote_agent_connections` lookup | ✅ | Registry passed to injected function |
| Agent Card fetching at startup | ✅ | `AgentRegistry.discoverAgents()` |
| Agent roster in prompt | ✅ | `getTravelPlannerPrompt({ agentRoster })` |
| `taskId` support | ✅ | Via `SendMessageOptions.taskId` |
| `contextId` support | ✅ | Via `SendMessageOptions.contextId` |
| Streaming responses | ✅ | A2A protocol + A2AAdapter handles |
| Multiple sequential tool calls | ✅ | `ToolLoopAgent` handles naturally |
