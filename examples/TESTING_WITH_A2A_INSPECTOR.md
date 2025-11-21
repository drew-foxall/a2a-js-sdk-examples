# Testing with A2A Inspector

This guide demonstrates how to test our A2A agents using the official [a2a-inspector](https://github.com/a2aproject/a2a-inspector) web tool.

## What is A2A Inspector?

A2A Inspector is a web-based tool for inspecting, debugging, and validating servers implementing the A2A protocol. It provides:

- **Agent Card Viewer**: View and validate agent metadata
- **Compliance Checker**: Verify protocol compliance
- **Live Chat Interface**: Interact with agents in real-time
- **Debug Console**: Monitor A2A protocol messages
- **Multi-Agent Testing**: Test agent-to-agent interactions

**Official Tool**: https://inspector.a2a.plus

## Quick Start

### 1. Start an Agent

Start any agent from the examples:

```bash
# From repository root
pnpm agents:hello-world     # Port 41244
pnpm agents:dice-agent      # Port 41245
pnpm agents:coder           # Port 41250
pnpm agents:movie-agent     # Port 41249
# ... etc
```

### 2. Open A2A Inspector

Visit: **https://inspector.a2a.plus**

### 3. Connect to Your Agent

In the inspector:

1. Enter your agent's URL: `http://localhost:41244` (use the correct port)
2. Click "Connect" or "Inspect"
3. The inspector will:
   - Fetch the agent card from `/.well-known/agent-card.json`
   - Validate protocol compliance
   - Enable the chat interface

### 4. Test Your Agent

- **Chat Tab**: Send messages and view responses
- **Agent Card Tab**: View agent metadata, skills, and capabilities
- **Debug Tab**: Monitor protocol-level messages

## Testing Individual Agents

### Hello World Agent (Port 41244)

**Purpose**: Simplest A2A agent - demonstrates basic protocol implementation

```bash
pnpm agents:hello-world
```

**Test in Inspector**:
- URL: `http://localhost:41244`
- Try: "Hello!", "Hi there", "What can you do?"
- **Expected**: Friendly greeting responses

**Protocol Mode**: Generate (simple awaited responses)

---

### Dice Agent (Port 41245)

**Purpose**: Demonstrates simple tool usage (random number generation)

```bash
pnpm agents:dice-agent
```

**Test in Inspector**:
- URL: `http://localhost:41245`
- Try: "Roll a dice", "Give me a random number", "Roll two dice"
- **Expected**: Random numbers with explanatory text

**Protocol Mode**: Stream (real-time text + potential artifacts)

---

### GitHub Agent (Port 41246)

**Purpose**: External API integration (Octokit for GitHub)

```bash
# Requires GITHUB_TOKEN
export GITHUB_TOKEN=your_token_here
pnpm agents:github-agent
```

**Test in Inspector**:
- URL: `http://localhost:41246`
- Try: "Show me issues in google/a2a", "List recent commits in vercel/ai"
- **Expected**: GitHub data with formatted responses

**Protocol Mode**: Stream with async artifacts

---

### Analytics Agent (Port 41247)

**Purpose**: Demonstrates artifact generation (PNG charts)

```bash
pnpm agents:analytics-agent
```

**Test in Inspector**:
- URL: `http://localhost:41247`
- Try: "Show sales trends", "Create a bar chart", "Visualize data"
- **Expected**: Text explanation + PNG chart artifact

**Protocol Mode**: Generate with async artifacts
**Artifacts**: Base64-encoded PNG images

---

### Currency Agent (Port 41248)

**Purpose**: Real-time API integration (Frankfurter API for exchange rates)

```bash
pnpm agents:currency-agent
```

**Test in Inspector**:
- URL: `http://localhost:41248`
- Try: "Convert 100 USD to EUR", "What's the exchange rate for GBP?"
- **Expected**: Current exchange rates and conversions

**Protocol Mode**: Stream

---

### Coder Agent (Port 41250)

**Purpose**: Code generation with artifact extraction

```bash
pnpm agents:coder
```

**Test in Inspector**:
- URL: `http://localhost:41250`
- Try: "Create a React button component", "Write a Python function to sort a list"
- **Expected**: Code explanation + code block artifacts

**Protocol Mode**: Stream with real-time artifact parsing
**Artifacts**: Code blocks extracted from markdown

---

### Movie Agent (Port 41249)

**Purpose**: Multi-turn conversation with custom state management

```bash
pnpm agents:movie-agent
```

**Test in Inspector**:
- URL: `http://localhost:41249`
- Try: 
  1. "I want to watch a sci-fi movie"
  2. Agent asks for preferences
  3. Respond: "Something with space travel"
  4. Agent provides recommendations
- **Expected**: Interactive movie recommendation flow

**Protocol Mode**: Generate with history tracking
**State**: Custom `parseTaskState` for `input-required` detection

---

### Weather Agent (Port 41252)

**Purpose**: Real-time weather data (Open-Meteo API)

```bash
pnpm agents:weather-agent
```

**Test in Inspector**:
- URL: `http://localhost:41252`
- Try: "What's the weather in London?", "Forecast for New York"
- **Expected**: Current weather and forecast data

**Protocol Mode**: Stream

---

### Airbnb Agent (Port 41253)

**Purpose**: MCP integration with real Airbnb data

```bash
pnpm agents:airbnb-agent
```

**Test in Inspector**:
- URL: `http://localhost:41253`
- Try: "Show me listings in Paris", "Find apartments in Tokyo under $100/night"
- **Expected**: Real Airbnb listings with details

**Protocol Mode**: Stream
**MCP**: Uses `@openbnb/mcp-server-airbnb` via AI SDK's MCP support

---

### Travel Planner (Multi-Agent Orchestrator, Port 41254)

**Purpose**: Demonstrates multi-agent orchestration using `a2a-ai-provider`

```bash
pnpm agents:travel-planner
```

**Test in Inspector**:
- URL: `http://localhost:41254`
- Try: "Plan a weekend trip to San Francisco"
- **Expected**: Coordinated response using Weather + Airbnb agents

**Architecture**:
- Uses `a2a-ai-provider` to consume other A2A agents as models
- Delegates to Weather Agent (41252) and Airbnb Agent (41253)
- Synthesizes responses into travel plan

**Protocol Mode**: Stream
**Agent Network**: Planner → Weather Agent, Airbnb Agent

## Testing Multiple Agents Simultaneously

Start all agents in parallel using Turborepo:

```bash
pnpm dev
```

This starts all 10 agents simultaneously, each on their designated port. You can then:

1. Open multiple browser tabs with A2A Inspector
2. Connect each tab to a different agent
3. Test interactions across agents

## Advanced Testing Scenarios

### Scenario 1: Multi-Agent Travel Planning

**Setup**:
```bash
# Terminal 1: Start Weather Agent
pnpm agents:weather-agent

# Terminal 2: Start Airbnb Agent  
pnpm agents:airbnb-agent

# Terminal 3: Start Travel Planner (orchestrator)
pnpm agents:travel-planner
```

**Test**:
1. Open Inspector at `http://localhost:41254` (Travel Planner)
2. Send: "Plan a 3-day trip to Seattle"
3. **Expected**: Planner delegates to Weather + Airbnb, synthesizes response

**Debug**: Monitor all 3 terminals to see agent-to-agent communication

---

### Scenario 2: Code Generation with Artifacts

**Setup**:
```bash
pnpm agents:coder
```

**Test**:
1. Connect Inspector to `http://localhost:41250`
2. Send: "Create a TypeScript function that validates email addresses"
3. **Expected**: 
   - Text explanation (streamed)
   - Code artifact (extracted in real-time)
4. **Verify**: Check Inspector's Artifacts tab for extracted code

---

### Scenario 3: Data Visualization Pipeline

**Setup**:
```bash
pnpm agents:analytics-agent
```

**Test**:
1. Connect Inspector to `http://localhost:41247`
2. Send: "Visualize quarterly revenue: Q1: $100k, Q2: $150k, Q3: $200k, Q4: $180k"
3. **Expected**:
   - Text summary (awaited)
   - PNG chart artifact (generated after completion)
4. **Verify**: Chart displays correctly in Inspector

## Protocol Compliance Validation

A2A Inspector automatically validates:

- ✅ Agent card structure (`/.well-known/agent-card.json`)
- ✅ Protocol version compatibility
- ✅ Capability declarations (streaming, statefulness, etc.)
- ✅ Input/output mode support
- ✅ JSON-RPC message formatting

**Check Compliance**:
1. Connect to any agent
2. Open "Agent Card" tab
3. Look for ✅ green checkmarks or ❌ errors

## Debugging Tips

### 1. Agent Not Responding

**Symptoms**: Inspector shows "Connection Failed" or timeout

**Solutions**:
- Verify agent is running: `curl http://localhost:41244/.well-known/agent-card.json`
- Check port number matches
- Ensure no firewall blocking localhost
- Check terminal for agent errors

### 2. Artifacts Not Showing

**Symptoms**: Text response works but no artifacts appear

**Solutions**:
- Check agent's `parseArtifacts` or `generateArtifacts` implementation
- Verify artifact MIME types in agent card
- Check Inspector's "Debug" tab for raw artifact data
- Ensure artifacts are base64-encoded (for binary data)

### 3. Streaming Not Working

**Symptoms**: Long delay before all text appears at once

**Solutions**:
- Verify agent uses `mode: 'stream'` in A2AAdapter config
- Check agent card has `capabilities.streaming: true`
- Ensure no buffering middleware in Hono app
- Test with `curl` to verify SSE events

### 4. Multi-Turn Conversation Breaks

**Symptoms**: Agent forgets previous context

**Solutions**:
- Verify agent uses `includeHistory: true` in A2AAdapter config
- Check task store is persistent (not in-memory for production)
- Ensure `contextId` is preserved across turns
- Review agent's message history handling

## Comparison with Other Testing Methods

| Method | Use Case | Pros | Cons |
|--------|----------|------|------|
| **A2A Inspector** | Interactive testing, debugging | Visual, real-time, protocol validation | Manual, requires running agent |
| **Vitest** | Unit/integration tests | Automated, CI/CD, fast feedback | No UI, mocks required |
| **curl** | Quick health checks | Fast, scriptable, no dependencies | No UI, manual JSON parsing |
| **a2a-cli** | CLI automation | Scriptable, batch testing | No visual feedback |

**Recommendation**: Use A2A Inspector for **development and manual testing**, Vitest for **automated testing and CI/CD**.

## Next Steps

1. **Start with Hello World**: Verify basic setup with the simplest agent
2. **Test Tool Usage**: Try Dice Agent to understand tool calling
3. **Test Artifacts**: Use Analytics Agent or Coder to verify artifact handling
4. **Test Multi-Agent**: Run Travel Planner to see agent orchestration
5. **Automate**: Write Vitest tests for critical agent behaviors

## Resources

- **A2A Inspector**: https://inspector.a2a.plus
- **A2A Inspector (GitHub)**: https://github.com/a2aproject/a2a-inspector
- **A2A Protocol Docs**: https://a2a.plus/docs
- **AI SDK Testing**: https://ai-sdk.dev/docs/ai-sdk-core/testing
- **This Repository**: https://github.com/drew-foxall/a2a-js-sdk-examples

---

**Happy Testing! 🚀**

