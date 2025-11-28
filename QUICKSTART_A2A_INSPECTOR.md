# 🚀 Quick Start: Testing with A2A Inspector

Get started testing your agents in **3 minutes**!

## Step 1: Start an Agent

Choose any agent and start it:

```bash
# Simple greeting agent (recommended for first test)
pnpm agent:hello-world

# Or try any other agent:
# pnpm agent:dice          # Roll dice
# pnpm agent:analytics     # Generate charts
# pnpm agent:movie         # Search movies
# pnpm agent:github        # GitHub integration
# pnpm agent:currency      # Currency conversion
# pnpm agent:coder         # Code generation
# pnpm agent:weather       # Weather forecasts
# pnpm agent:airbnb        # Airbnb search
# pnpm agent:planner       # Multi-agent orchestrator
```

You should see:
```
🚀 Agent server started
📍 Local:    http://localhost:41244
📍 Agent Card: http://localhost:41244/.well-known/agent-card.json
```

✅ **Keep this terminal running!**

---

## Step 2: Start Local A2A Inspector

In a **new terminal**:

```bash
pnpm inspector
```

This starts the inspector in Docker at **http://127.0.0.1:5001**

1. Open: **http://127.0.0.1:5001**
2. Enter agent URL: `http://localhost:41244`
3. Click **"Connect"**

> **Note**: There is no hosted inspector. You must run it locally via Docker.

---

## Step 3: Chat with Your Agent

Try these prompts:

### Hello World Agent
- "Hello!"
- "Hi there"
- "What can you do?"

### Dice Agent (Port 41245)
- "Roll a dice"
- "Give me a random number between 1 and 100"
- "Roll two dice"

### Analytics Agent (Port 41247)
- "Show me a bar chart for: Q1:100 Q2:150 Q3:200 Q4:180"
- "Visualize this data: Jan:1000 Feb:1500 Mar:2000"

### Movie Agent (Port 41249)
- "Tell me about Inception"
- "Who directed The Matrix?"

### GitHub Agent (Port 41246) - *Requires GITHUB_TOKEN*
```bash
export GITHUB_TOKEN=your_token_here
pnpm agent:github
```
- "Show me recent issues in vercel/ai"
- "List commits in facebook/react"

### Currency Agent (Port 41248)
- "Convert 100 USD to EUR"
- "What's the exchange rate for GBP?"

### Coder Agent (Port 41250)
- "Create a React button component"
- "Write a Python function to reverse a string"

---

## What You'll See

### In A2A Inspector:

1. **Chat Tab**: Real-time conversation
2. **Agent Card Tab**: Agent capabilities and metadata
3. **Debug Tab**: Protocol-level messages (JSON-RPC)
4. **Artifacts Tab**: Generated files (charts, code, etc.)

### In Your Terminal:

You'll see live logs showing:
- Incoming requests
- Agent processing
- Tool executions
- Response streaming

---

## Testing Artifacts

Some agents generate artifacts (files):

### Analytics Agent - PNG Charts
```
Prompt: "Create a bar chart: Sales:100 Revenue:200 Profit:50"
Result: Text response + PNG image artifact
```

### Coder Agent - Code Files
```
Prompt: "Write a TypeScript interface for a User"
Result: Text explanation + code artifact
```

**View artifacts** in the Inspector's "Artifacts" tab!

---

## Testing Multi-Agent System

To test the Travel Planner (orchestrator):

### Terminal 1:
```bash
pnpm agent:weather
```

### Terminal 2:
```bash
pnpm agent:airbnb
```

### Terminal 3:
```bash
pnpm agent:planner
```

### In A2A Inspector:
Connect to `http://localhost:41254` and try:
```
"Plan a weekend trip to San Francisco"
```

The planner will coordinate Weather + Airbnb agents! Watch all 3 terminals to see agent-to-agent communication.

---

## Quick Verification

Test if your agent is working:

```bash
# Check agent card is accessible
curl http://localhost:41244/.well-known/agent-card.json | jq

# Send a test message
curl -X POST http://localhost:41244/execute \
  -H "Content-Type: application/json" \
  -d '{"task_id": "test", "input": {"role": "user", "content": "Hello"}}'
```

---

## Stopping Agents

Press `Ctrl+C` in the terminal running the agent.

---

## Common Issues

### "Connection Failed" in Inspector
- ✅ Check agent is running: `curl http://localhost:41244/.well-known/agent-card.json`
- ✅ Verify port number matches
- ✅ Ensure no other process is using the port

### Artifacts Not Showing
- ✅ Check Inspector's "Artifacts" tab
- ✅ Look for artifacts in "Debug" tab (raw data)
- ✅ Verify agent supports artifacts (see Agent Card)

### Streaming Not Working
- ✅ Check agent card has `streaming: true`
- ✅ Try a different agent (e.g., dice agent streams by default)

---

## Next Steps

1. ✅ **Read Full Guide**: [TESTING_WITH_A2A_INSPECTOR.md](examples/TESTING_WITH_A2A_INSPECTOR.md)
2. ✅ **Try All Agents**: Test each agent's unique capabilities
3. ✅ **Write Vitest Tests**: Automate testing with `pnpm test`
4. ✅ **Build Your Own**: Use these agents as templates

---

## Agent Ports Reference

| Agent | Port | Command |
|-------|------|---------|
| Hello World | 41244 | `pnpm agent:hello-world` |
| Dice | 41245 | `pnpm agent:dice` |
| GitHub | 41246 | `pnpm agent:github` |
| Analytics | 41247 | `pnpm agent:analytics` |
| Currency | 41248 | `pnpm agent:currency` |
| Movie | 41249 | `pnpm agent:movie` |
| Coder | 41250 | `pnpm agent:coder` |
| Content Editor | 41251 | `pnpm agent:content-editor` |
| Weather | 41252 | `pnpm agent:weather` |
| Airbnb | 41253 | `pnpm agent:airbnb` |
| Planner | 41254 | `pnpm agent:planner` |

---

**Happy Testing! 🎉**

For detailed testing scenarios, see [TESTING_WITH_A2A_INSPECTOR.md](examples/TESTING_WITH_A2A_INSPECTOR.md)

