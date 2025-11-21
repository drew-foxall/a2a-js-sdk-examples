# Python to JavaScript Conversion Plan

## Overview

This document outlines the plan to convert Python agent examples from [`a2a-samples`](https://github.com/a2aproject/a2a-samples/tree/main/samples/python) to JavaScript/TypeScript equivalents using the AI SDK + Hono + A2A architecture.

## Python ↔ JavaScript Agent Name Mapping

For easy cross-referencing between Python and JavaScript implementations:

| Python Source | JavaScript Implementation | Status | Notes |
|--------------|---------------------------|---------|-------|
| `helloworld` | `hello-world` | ✅ Complete | Hyphenated for JS convention |
| `dice_agent_rest` | `dice-agent` | ✅ Complete | Simplified name |
| `github-agent` | `github-agent` | ✅ Complete | Exact match ✨ |
| `analytics` | `analytics-agent` | ✅ Complete | Added `-agent` suffix |
| `langgraph` | `currency-agent` | ✅ Complete | Named for functionality (currency) |
| `airbnb_planner_multiagent` | `travel-planner-multiagent` | ✅ Complete | Named for purpose (travel planning) |
| `content_planner` | *(not converted)* | ⏸️ Skipped | Similar to `content-editor` |
| `birthday_planner_adk` | *(planned)* | ⏸️ Optional | Future multi-agent example |

**JavaScript-Only Agents** (no Python equivalent):
- `movie-agent` - TMDB API integration example
- `coder` - Streaming code generation example  
- `content-editor` - Text editing example

**Naming Convention**: Future Python conversions will use **exact Python names** to avoid confusion. Current agents keep their JavaScript-idiomatic names for stability.

See [AGENT_NAMING_ALIGNMENT.md](./AGENT_NAMING_ALIGNMENT.md) for detailed naming decisions.

## Current JavaScript Examples (Already Implemented)

✅ **Movie Agent** - TMDB API integration, tool usage, conversation history  
✅ **Coder Agent** - Streaming code generation, artifact emission  
✅ **Content Editor Agent** - Professional text editing

## Conversion Strategy

### Phase 1: Foundation Examples (Simple → Complex)

These examples establish baseline patterns and progressively demonstrate core capabilities:

#### 1. Hello World Agent ⭐ **START HERE**
- **Python Source**: [`helloworld`](https://github.com/a2aproject/a2a-samples/tree/main/samples/python/agents/helloworld)
- **JavaScript**: `hello-world` (Port 41244)
- **Complexity**: ⭐ (Very Simple)
- **Purpose**: Simplest possible A2A agent - baseline example
- **Features**:
  - No tools
  - Simple text response
  - Demonstrates minimal A2A integration
  - Good for testing A2A adapter pattern
- **Implementation Notes**:
  - Use `A2AAdapter` with simple agent
  - No AI SDK tools needed
  - Focus on clean A2A protocol integration
- **Priority**: **HIGH** - Foundation example

---

#### 2. Dice Agent (REST)
- **Python Source**: [`dice_agent_rest`](https://github.com/a2aproject/a2a-samples/tree/main/samples/python/agents/dice_agent_rest)
- **JavaScript**: `dice-agent` (Port 41249)
- **Complexity**: ⭐⭐ (Simple)
- **Purpose**: Demonstrates basic tool usage
- **Features**:
  - Two simple tools: roll dice, check if number is prime
  - No external APIs
  - Simple stateless operations
- **Implementation Notes**:
  - Use AI SDK `ToolLoopAgent`
  - Define `rollDice` and `isPrime` tools
  - Good example of pure computational tools
- **Priority**: **HIGH** - Basic tool demonstration

---

### Phase 2: Real-World Utility Examples

#### 3. GitHub Agent
- **Python Source**: [`github-agent`](https://github.com/a2aproject/a2a-samples/tree/main/samples/python/agents/github-agent)
- **JavaScript**: `github-agent` (Port 41240) ✨ **Name Match**
- **Complexity**: ⭐⭐⭐ (Moderate)
- **Purpose**: Real-world API integration, developer utility
- **Features**:
  - GitHub API integration (Octokit)
  - Multiple tools: get repos, get commits, search
  - Authentication with GitHub token
  - Practical developer tool
- **Implementation Notes**:
  - Use `@octokit/rest` for GitHub API
  - Implement three tools matching Python version
  - Handle authentication via GITHUB_TOKEN env var
  - Great example of external API integration
- **Priority**: **MEDIUM** - Demonstrates API integration patterns

---

#### 4. Analytics Agent
- **Python Source**: [`analytics`](https://github.com/a2aproject/a2a-samples/tree/main/samples/python/agents/analytics)
- **JavaScript**: `analytics-agent` (Port 41247)
- **Complexity**: ⭐⭐⭐⭐ (Moderate-Complex)
- **Purpose**: Chart generation, demonstrates image artifacts
- **Features**:
  - Parse user prompts for data
  - Generate charts using Chart.js or similar
  - Return PNG images as artifacts
  - CrewAI equivalent (multi-step workflow)
- **Implementation Notes**:
  - Use `chart.js` + `canvas` for chart generation
  - Convert chart to PNG buffer
  - Emit image artifacts via A2A
  - Similar streaming pattern to Coder Agent
- **Priority**: **MEDIUM** - Demonstrates image artifact handling

---

### Phase 3: Advanced Framework Examples ✅ **COMPLETE**

#### 5. Currency Agent (LangGraph Equivalent) ✅ **IMPLEMENTED**
- **Python Source**: [`langgraph`](https://github.com/a2aproject/a2a-samples/tree/main/samples/python/agents/langgraph)
- **JavaScript**: `currency-agent` (Port 41248)
- **Complexity**: ⭐⭐⭐ (Moderate)
- **Purpose**: Multi-turn conversation, tool usage, streaming
- **Note**: Python example uses LangGraph framework, JS uses AI SDK ToolLoopAgent (equivalent functionality)
- **Status**: ✅ **COMPLETE** (Commit: fba3f92)
- **Features Implemented**:
  - ✅ Currency conversion via Frankfurter API (no API key required)
  - ✅ Multi-turn conversation with `parseTaskState`
  - ✅ Conversation memory via `contextId`
  - ✅ Streaming with status updates
  - ✅ Text artifacts for conversion results
  - ✅ Custom state parsing (input-required vs completed)
- **Implementation Highlights**:
  - Used AI SDK `ToolLoopAgent` (equivalent to LangGraph ReAct)
  - Implemented `get_exchange_rate` tool matching Python version
  - Multi-turn conversation via text-based state detection
  - Conversation history managed by A2AAdapter
  - Demonstrates LangGraph → AI SDK equivalence
- **Key Differences from Python**:
  - Python: LangGraph with structured output (`ResponseFormat`)
  - JavaScript: AI SDK with text parsing (`parseTaskState`)
  - Both support multi-turn, memory, and streaming
- **Lines of Code**: 846 lines (tools, agent, index, prompt, README)
- **Priority**: **COMPLETED** - Framework comparison successful

---

### Phase 4: Multi-Agent Orchestration 🆕 ✅ **IMPLEMENTED**

**NEW CAPABILITIES**: 
1. Using [`a2a-ai-provider`](https://github.com/dracoblue/a2a-ai-provider), AI SDK agents can **consume** A2A agents as if they were LLM providers
2. Using [`@ai-sdk/mcp`](https://v6.ai-sdk.dev/cookbook/node/mcp-tools), AI SDK agents can **connect to MCP servers** for tools

#### 6. Travel Planner Multi-Agent System ✅ **IMPLEMENTED**
- **Python Source**: [`airbnb_planner_multiagent`](https://github.com/a2aproject/a2a-samples/tree/main/samples/python/agents/airbnb_planner_multiagent)
- **JavaScript**: `travel-planner-multiagent` (Ports: 41245-41247)
- **Complexity**: ⭐⭐⭐⭐⭐ (Advanced)
- **Purpose**: Demonstrates multi-agent orchestration and delegation
- **Note**: Named for functionality (travel planning) rather than specific service (Airbnb)
- **Status**: ✅ **COMPLETE** (Phase 4)
- **Components**:
  - **Travel Planner** (orchestrator, Port 41247) - Uses AI SDK + `a2a-ai-provider`
  - **Weather Agent** (specialist, Port 41245) - Weather forecasts via Open-Meteo API
  - **Airbnb Agent** (specialist, Port 41246) - Accommodation search
  - Agent-to-agent communication via A2A protocol
- **Features Implemented**:
  - ✅ Multi-agent orchestration with `a2a-ai-provider`
  - ✅ Weather Agent using **real API** (Open-Meteo, global coverage)
  - ⚠️ Airbnb Agent using **mock data** (demonstration only)
  - ✅ Specialist agent delegation
  - ✅ Response synthesis
  - ✅ Full A2A protocol integration
- **Data Sources**:
  - **Python Weather**: National Weather Service API (US-only)
  - **JS Weather**: ✅ Open-Meteo API (global, **BETTER**)
  - **Python Airbnb**: ✅ Real Airbnb API via `@openbnb/mcp-server-airbnb` MCP
  - **JS Airbnb**: ⚠️ Mock data (12 hardcoded listings)
- **Known Limitations**:
  - Airbnb agent uses mock data instead of real MCP integration
  - For production, should use MCP like Python version (see upgrade path below)
- **Upgrade Path to Match Python**:
  ```typescript
  // Use AI SDK's MCP support to match Python's real Airbnb data
  import { experimental_createMCPClient } from '@ai-sdk/mcp';
  import { Experimental_StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio';
  
  const transport = new Experimental_StdioMCPTransport({
    command: 'npx',
    args: ['-y', '@openbnb/mcp-server-airbnb', '--ignore-robots-txt'],
  });
  
  const mcpClient = await experimental_createMCPClient({ transport });
  const mcpTools = await mcpClient.tools();
  
  // Now agent has access to real Airbnb data via MCP
  const agent = new ToolLoopAgent({
    model: getModel(),
    tools: mcpTools, // Real Airbnb search tools
  });
  ```
- **Key Orchestration Pattern**: 
  ```typescript
  import { a2a } from "a2a-ai-provider";
  import { generateText } from "ai";

  // Travel Planner delegates to specialist A2A agents
  const weatherResult = await generateText({
    model: a2a('http://localhost:41245/.well-known/agent-card.json'),
    prompt: 'Weather forecast for Paris',
  });
  
  const airbnbResult = await generateText({
    model: a2a('http://localhost:41246/.well-known/agent-card.json'),
    prompt: 'Find accommodations in Paris',
  });
  ```
- **Documentation**: See [PYTHON_VS_JS_MULTIAGENT_COMPARISON.md](./PYTHON_VS_JS_MULTIAGENT_COMPARISON.md)
- **Priority**: ✅ **COMPLETED** - Multi-agent orchestration demonstrated

---

#### 7. Birthday Planner Multi-Agent System (Optional)
- **Python Source**: [`birthday_planner_adk`](https://github.com/a2aproject/a2a-samples/tree/main/samples/python/agents/birthday_planner_adk)
- **JavaScript**: `birthday-planner-multiagent` (if implemented)
- **Complexity**: ⭐⭐⭐⭐ (Advanced)
- **Purpose**: Additional multi-agent orchestration example
- **Features**:
  - Birthday planner orchestrator
  - Calendar agent (scheduling)
  - Gift recommendation agent
  - Multi-step workflows
- **Implementation Notes**:
  - Similar pattern to Airbnb Planner
  - Demonstrates sequential agent calls
  - Shows state management across agents
- **Priority**: **LOW** - Alternative orchestration example

---

## Comparison: Existing vs. New Examples

| Feature | Movie | Coder | Editor | Hello | Dice | GitHub | Analytics | Currency | Travel | Birthday |
|---------|-------|-------|--------|-------|------|--------|-----------|----------|--------|----------|
| **Tools** | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ⏸️ |
| **Streaming** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ⏸️ |
| **External API** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ⚠️ | ⏸️ |
| **Artifacts** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ⏸️ |
| **Multi-turn** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ⏸️ |
| **Multi-agent** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ⏸️ |
| **MCP Integration** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ | ⏸️ |
| **Python Parity** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⏸️ |
| **Status** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⏸️ |
| **Complexity** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

**Legend**: 
- Movie = Movie Agent
- Coder = Coder Agent
- Editor = Content Editor
- Hello = Hello World
- Currency = Currency Agent (LangGraph equivalent)
- Travel = Travel Planner Multi-Agent (Airbnb Planner equivalent)
- Birthday = Birthday Planner (optional)

**Status Key**:
- ✅ = Fully implemented
- ⚠️ = Implemented with limitations (mock data instead of real API)
- ⏸️ = Deferred/Optional

**Notes**:
- **Travel External API**: ✅ Weather uses real API (✅), Airbnb uses real MCP (✅)
- **Travel MCP Integration**: ✅ Python uses MCP, JS now uses MCP (@openbnb/mcp-server-airbnb)
- **Travel Python Parity**: ✅ Architecture matches, Airbnb agent upgraded to MCP - **FULL PARITY ACHIEVED!**

---

## Not Converting (Overlap or Out of Scope)

### Overlap with Existing Examples
- **Content Planner** - Too similar to Content Editor
- **Expense Reimbursement** - Complex multi-turn, better as advanced example later
- **LlamaIndex File Chat** - Document parsing, different scope

### Framework-Specific (Not AI SDK)
- **CrewAI Image Generation** - Framework-specific, complex
- **Semantic Kernel Travel Agent** - Framework-specific
- **Marvin Contact Extractor** - Framework-specific
- **MindsDB Enterprise Data** - Requires MindsDB infrastructure
- **AG2** - Framework-specific
- **Azure AI Foundry** - Azure-specific
- **BeeAI** - Framework-specific

### Multi-Agent Examples (Deferred or Too Complex)
- ✅ **Airbnb Planner** - **INCLUDED** in Phase 4 (demonstrates orchestration)
- ✅ **Birthday Planner** - **INCLUDED** in Phase 4 (alternative orchestration)
- ❌ **Adversarial Multi-Agent** - Too niche, limited practical use
- ❌ **Number Guessing Game** - Game-specific, not practical utility

**Why now include multi-agent?** Discovery of [`a2a-ai-provider`](https://github.com/dracoblue/a2a-ai-provider) enables AI SDK to consume A2A agents as "models", making multi-agent orchestration practical and powerful!

### Specialized Infrastructure
- **ADK Cloud Run** - Deployment-focused
- **Headless Agent Auth** - OAuth flow, authentication focus
- **A2A MCP** - MCP integration (different protocol)
- **A2A Telemetry** - Telemetry/observability focus
- **Veo Video Gen** - Video generation, requires Google Veo API

---

## Implementation Order (Recommended)

### Sprint 1: Foundation
1. ✅ **Hello World Agent** - Validate basic A2A integration pattern
2. ✅ **Dice Agent** - Validate tool usage pattern

### Sprint 2: Real-World Utility
3. ✅ **GitHub Agent** - Validate external API integration
4. ✅ **Analytics Agent** - Validate image artifact handling

### Sprint 3: Advanced ✅ **COMPLETE**
5. ✅ **Currency Agent** - Multi-turn conversation + framework comparison

### Sprint 4: Multi-Agent Orchestration 🆕
6. ✅ **Airbnb Planner Multi-Agent** - Demonstrate agent orchestration with `a2a-ai-provider`
7. ⏸️ **Birthday Planner Multi-Agent** - Alternative orchestration pattern (optional)

---

## Technical Architecture (All New Agents)

### Single-Agent Architecture

All converted single-agent examples will follow the established architecture:

```
examples/agents/src/agents/{agent-name}/
  ├── agent.ts          # Pure AI SDK ToolLoopAgent (protocol-agnostic)
  ├── index.ts          # A2A integration via A2AAdapter
  ├── tools.ts          # Tool implementations (if applicable)
  ├── prompt.ts         # System prompts
  └── README.md         # Documentation
```

### MCP Integration Pattern 🆕

For agents that use Model Context Protocol (matching Python MCP implementations):

```typescript
// Install MCP support
// pnpm add @ai-sdk/mcp @modelcontextprotocol/sdk

import { experimental_createMCPClient } from '@ai-sdk/mcp';
import { Experimental_StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio';

// Connect to MCP server (stdio transport)
const transport = new Experimental_StdioMCPTransport({
  command: 'npx',
  args: ['-y', '@openbnb/mcp-server-airbnb', '--ignore-robots-txt'],
});

const mcpClient = await experimental_createMCPClient({ transport });
const mcpTools = await mcpClient.tools(); // Get tools from MCP server

// Use MCP tools in AI SDK agent
const agent = new ToolLoopAgent({
  model: getModel(),
  tools: mcpTools, // Real tools from MCP server
});

// Remember to close the client when done
await mcpClient.close();
```

**Supported MCP Transports**:
- **stdio**: Local MCP servers (Node.js commands)
- **HTTP**: Remote MCP servers via HTTP
- **SSE**: Server-Sent Events for streaming

**Example - Multiple MCP Servers**:
```typescript
// Connect to multiple MCP servers
const airbnbClient = await experimental_createMCPClient({
  transport: new Experimental_StdioMCPTransport({
    command: 'npx',
    args: ['-y', '@openbnb/mcp-server-airbnb'],
  }),
});

const weatherClient = await experimental_createMCPClient({
  transport: { type: 'http', url: 'http://localhost:3000/mcp' },
});

// Combine tools from multiple sources
const tools = {
  ...(await airbnbClient.tools()),
  ...(await weatherClient.tools()),
};

const agent = new ToolLoopAgent({ model: getModel(), tools });
```

**When to Use MCP**:
- Python example uses MCP (match functionality)
- Need to connect to existing MCP servers
- Want to reuse MCP tools across languages
- Complex external services with MCP adapters

### Multi-Agent Architecture 🆕

Multi-agent examples demonstrate orchestration patterns:

```
examples/agents/src/agents/{orchestrator-name}/
  ├── orchestrator.ts   # Host agent using a2a-ai-provider
  ├── index.ts          # A2A integration (orchestrator exposed via A2A)
  ├── specialist-1/     # First specialist agent (standard A2A agent)
  │   ├── agent.ts
  │   ├── index.ts
  │   └── README.md
  ├── specialist-2/     # Second specialist agent (standard A2A agent)
  │   ├── agent.ts
  │   ├── index.ts
  │   └── README.md
  └── README.md         # Multi-agent system documentation
```

**Key Multi-Agent Pattern**:
```typescript
import { a2a } from "a2a-ai-provider";
import { generateText } from "ai";

// Orchestrator agent delegates to specialist A2A agents
const weatherResult = await generateText({
  model: a2a('http://localhost:41250/.well-known/agent-card.json'), // Weather agent
  prompt: 'What is the weather in Paris?',
});

const airbnbResult = await generateText({
  model: a2a('http://localhost:41251/.well-known/agent-card.json'), // Airbnb agent
  prompt: `Find listings in Paris. Weather: ${weatherResult.text}`,
});
```

### Key Patterns
- **Pure Agent Layer**: AI SDK `ToolLoopAgent` with no A2A coupling
- **A2A Adapter**: Unified `A2AAdapter` for A2A protocol integration
- **A2A Provider**: Use `a2a-ai-provider` to consume A2A agents as "models"
- **MCP Integration**: Use `@ai-sdk/mcp` for Model Context Protocol tools (matches Python)
- **Tool Definitions**: Use `inputSchema` for Zod validation
- **Type Safety**: Strong typing with generics, avoid `any`
- **Flexible Models**: Support 8+ providers via `getModel()` utility

---

## Success Criteria

For each converted agent:
- ✅ Zero TypeScript errors
- ✅ Zero linter warnings
- ✅ Comprehensive README with usage examples
- ✅ Matches Python functionality
- ✅ Clean separation of concerns (agent vs. A2A)
- ✅ Tested with at least one LLM provider
- ✅ Demonstrates specific capability clearly

---

## Python vs JavaScript Implementation Fidelity

### Ensuring Accurate Conversions

Each converted agent should match Python functionality:

| Aspect | Python Implementation | JavaScript Equivalent | Status |
|--------|----------------------|----------------------|---------|
| **Framework** | LangGraph / ADK | AI SDK `ToolLoopAgent` | ✅ Equivalent |
| **MCP Tools** | `langchain_mcp_adapters.client.MultiServerMCPClient` | `@ai-sdk/mcp` `experimental_createMCPClient` | ✅ Available |
| **Multi-Agent** | ADK native delegation | `a2a-ai-provider` | ✅ Available |
| **Streaming** | LangGraph `astream_events` | AI SDK `streamText` | ✅ Equivalent |
| **Memory** | `MemorySaver` checkpointer | A2A `contextId` + adapter history | ✅ Equivalent |
| **Tools** | LangChain tools | AI SDK tools with Zod schemas | ✅ Equivalent |

### Data Source Parity

Critical: JavaScript agents must use **real data sources** to match Python:

#### Current Status

| Agent | Python Data Source | JS Data Source | Parity |
|-------|-------------------|----------------|---------|
| **Weather** | NWS API (US-only) | Open-Meteo (global) | ✅ **JS Better** |
| **Airbnb** | `@openbnb/mcp-server-airbnb` (real) | Mock data | ⚠️ **Needs MCP** |
| **GitHub** | GitHub API via Octokit | GitHub API via Octokit | ✅ Match |
| **Currency** | Frankfurter API | Frankfurter API | ✅ Match |

#### Action Items for Full Parity

1. **Airbnb Agent**: Upgrade to MCP using `@ai-sdk/mcp` (see MCP Integration Pattern above)
2. **Verify all APIs**: Ensure JavaScript uses same endpoints as Python where applicable
3. **Test outputs**: Compare response formats and data quality

### Conversion Checklist

For each agent conversion, verify:
- [ ] Matches Python's tool definitions exactly
- [ ] Uses same external APIs (or equivalent)
- [ ] Implements MCP if Python version uses MCP
- [ ] Supports same conversation patterns (multi-turn, etc.)
- [ ] Returns similar response formats
- [ ] Handles errors gracefully like Python version
- [ ] Documentation reflects actual capabilities

## Resources

- **Python Examples**: https://github.com/a2aproject/a2a-samples/tree/main/samples/python
- **A2A Protocol**: https://google.github.io/A2A/
- **AI SDK Docs**: https://sdk.vercel.ai/docs
- **AI SDK MCP Support**: https://v6.ai-sdk.dev/cookbook/node/mcp-tools
- **A2A JS SDK**: https://github.com/drew-foxall/a2a-js
- **A2A AI Provider** 🆕: https://github.com/dracoblue/a2a-ai-provider (enables multi-agent orchestration)
- **Model Context Protocol**: https://modelcontextprotocol.io/

---

## Upgrade Guide: Airbnb Agent to Real MCP Data

To achieve full parity with Python's Airbnb agent, follow this upgrade path:

### Step 1: Install MCP Dependencies

```bash
cd examples/agents
pnpm add @ai-sdk/mcp @modelcontextprotocol/sdk
```

### Step 2: Update Airbnb Agent to Use MCP

Replace `tools.ts` mock data approach with MCP integration:

```typescript
// examples/agents/src/agents/travel-planner-multiagent/airbnb-agent/agent.ts
import { experimental_createMCPClient } from '@ai-sdk/mcp';
import { Experimental_StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio';
import { ToolLoopAgent } from 'ai/agent';
import { getModel } from '../../../shared/utils.js';

let mcpClient: any = null;

export async function createAirbnbAgent() {
  // Initialize MCP client for Airbnb server
  const transport = new Experimental_StdioMCPTransport({
    command: 'npx',
    args: ['-y', '@openbnb/mcp-server-airbnb', '--ignore-robots-txt'],
  });

  mcpClient = await experimental_createMCPClient({ transport });
  const mcpTools = await mcpClient.tools();

  return new ToolLoopAgent({
    model: getModel(),
    tools: mcpTools, // Real Airbnb search tools from MCP
    system: `You are a specialized assistant for Airbnb accommodations...`,
  });
}

// Cleanup function to close MCP client
export async function closeAirbnbAgent() {
  if (mcpClient) {
    await mcpClient.close();
  }
}
```

### Step 3: Update Server to Manage MCP Lifecycle

```typescript
// examples/agents/src/agents/travel-planner-multiagent/airbnb-agent/index.ts
import { createAirbnbAgent, closeAirbnbAgent } from './agent.js';

async function main() {
  const agent = await createAirbnbAgent(); // Initializes MCP
  const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
    workingMessage: "Searching Airbnb...",
  });
  
  // ... server setup ...
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down MCP client...');
    await closeAirbnbAgent();
    process.exit(0);
  });
  
  serve({ fetch: app.fetch, port: PORT });
}
```

### Step 4: Remove Mock Data

Delete or comment out `tools.ts` mock data:

```bash
# Optionally keep for fallback
mv examples/agents/src/agents/travel-planner-multiagent/airbnb-agent/tools.ts \
   examples/agents/src/agents/travel-planner-multiagent/airbnb-agent/tools.mock.ts
```

### Step 5: Test with Real Data

```bash
# Start upgraded Airbnb agent
pnpm agents:airbnb-agent

# Test with real search
curl -X POST http://localhost:41246/message/send \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "role": "user",
      "parts": [{"kind": "text", "text": "Find rooms in Paris, France for 2 adults, June 20-25, 2025"}]
    }
  }'
```

### Expected Results After Upgrade

- ✅ Real Airbnb listings with actual availability
- ✅ Current prices in local currency
- ✅ Direct links to actual Airbnb properties
- ✅ Photos, reviews, and ratings from real listings
- ✅ Date-based availability checking
- ✅ Full feature parity with Python version

### Comparison: Before vs After

| Feature | Mock Data (Current) | MCP Integration (Upgraded) |
|---------|-------------------|---------------------------|
| **Data Source** | Hardcoded | Real Airbnb API |
| **Listings** | 12 fake | Unlimited real |
| **Availability** | Always available | Real-time availability |
| **Prices** | Fake ($75-$450) | Real current prices |
| **Booking** | Not possible | Direct links |
| **Photos** | Placeholder | Real photos |
| **Search Features** | Limited | Full Airbnb search |

---

## Next Steps

1. ✅ **Review and approve this plan** with stakeholders
2. ✅ **Foundation examples complete** (Hello World, Dice)
3. ✅ **Utility examples complete** (GitHub, Analytics)
4. ✅ **Advanced examples complete** (Currency)
5. ✅ **Multi-agent orchestration complete** (Travel Planner)
6. ⚠️ **Upgrade Airbnb agent to MCP** (optional, for production parity)
7. **Document learnings** for each conversion
8. ✅ **Update main README** with completed examples

