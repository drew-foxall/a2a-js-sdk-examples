# A2A Inspector Testing Workflow

This guide shows you how to start any A2A agent and test it with A2A Inspector.

---

## 🚀 Quick Test (30 seconds)

### Terminal 1: Start Agent

```bash
# Navigate to repository root
cd /Users/Drew_Garratt/Development/a2a-js-sdk-examples

# Start the hello-world agent
pnpm agent:hello-world
```

**Expected Output:**
```
🎉 Hello World Agent - A2A Server Starting...
📍 Port: 41244
🌐 URL: http://localhost:41244
📋 Agent Card: http://localhost:41244/.well-known/agent-card.json
🚀 Ready to accept A2A requests...
```

✅ **Keep this terminal running!**

### Browser: Test with A2A Inspector

1. Open: **https://inspector.a2a.plus**
2. In the "Agent URL" field, enter: `http://localhost:41244`
3. Click **"Connect"** or **"Inspect"**
4. You should see:
   - ✅ Green checkmark for agent card
   - Agent name: "Hello World Agent"
   - Description and capabilities displayed

5. Go to the **"Chat"** tab
6. Type: `Hello!`
7. Press Enter

**Expected Response:**
```
Hello! How can I assist you today?
```

8. Try more prompts:
   - "Hi there"
   - "What can you do?"
   - "Tell me a joke"

### Stop the Agent

In Terminal 1, press:
```
Ctrl + C
```

---

## 📋 All Available Agents

| Agent | Port | Command | Test Prompts |
|-------|------|---------|-------------|
| **Hello World** | 41244 | `pnpm agent:hello-world` | "Hello!", "Hi there" |
| **Dice** | 41245 | `pnpm agent:dice` | "Roll a dice", "Random number 1-100" |
| **GitHub** | 41246 | `pnpm agent:github` | "Issues in vercel/ai" (needs `GITHUB_TOKEN`) |
| **Analytics** | 41247 | `pnpm agent:analytics` | "Chart: Q1:100 Q2:150 Q3:200" |
| **Currency** | 41248 | `pnpm agent:currency` | "Convert 100 USD to EUR" |
| **Movie** | 41249 | `pnpm agent:movie` | "Tell me about Inception" (needs `TMDB_API_KEY`) |
| **Coder** | 41250 | `pnpm agent:coder` | "Create a React button" |
| **Content Editor** | 41251 | `pnpm agent:content-editor` | "Rewrite this: Hey folks!" |
| **Weather** | 41252 | `pnpm agent:weather` | "Weather in London" |
| **Airbnb** | 41253 | `pnpm agent:airbnb` | "Listings in Paris" |
| **Planner** | 41254 | `pnpm agent:planner` | "Plan trip to SF" |

---

## 🧪 Testing Different Agents

### Example 1: Analytics Agent (Generates Charts)

**Terminal:**
```bash
cd /Users/Drew_Garratt/Development/a2a-js-sdk-examples
pnpm agent:analytics
```

**A2A Inspector:**
- Connect to: `http://localhost:41247`
- Prompt: `"Show me a bar chart for: Sales:1000 Revenue:1500 Profit:500"`
- **Expected**: Text response + PNG chart artifact
- **Check**: "Artifacts" tab in inspector should show the chart image

---

### Example 2: Dice Agent (Tool Calling)

**Terminal:**
```bash
cd /Users/Drew_Garratt/Development/a2a-js-sdk-examples
pnpm agent:dice
```

**A2A Inspector:**
- Connect to: `http://localhost:41245`
- Prompt: `"Roll a dice"`
- **Expected**: Random number 1-6 with explanation
- **Check**: "Debug" tab shows tool call to `rollDice`

---

### Example 3: Currency Agent (External API)

**Terminal:**
```bash
cd /Users/Drew_Garratt/Development/a2a-js-sdk-examples
pnpm agent:currency
```

**A2A Inspector:**
- Connect to: `http://localhost:41248`
- Prompt: `"Convert 100 USD to EUR"`
- **Expected**: Current exchange rate and converted amount
- **Check**: Live data from Frankfurter API

---

### Example 4: Movie Agent (Requires API Key)

**Terminal:**
```bash
# Set API key first
export TMDB_API_KEY=your_api_key_here

cd /Users/Drew_Garratt/Development/a2a-js-sdk-examples
pnpm agent:movie
```

**A2A Inspector:**
- Connect to: `http://localhost:41249`
- Prompt: `"Tell me about Inception"`
- **Expected**: Movie details from TMDB
- **Check**: Tool calls to `searchMovies`

---

## 🔍 Verification Checklist

Before connecting to A2A Inspector, verify the agent is running:

### 1. Check Agent is Listening

```bash
# In a new terminal (keep agent running in first terminal)
curl http://localhost:41244/.well-known/agent-card.json
```

**Expected:** JSON response with agent metadata

### 2. Check Agent Health

```bash
curl http://localhost:41244/.well-known/agent-card.json | jq -r '.name'
```

**Expected:** Agent name (e.g., "Hello World Agent")

### 3. Check Port is Open

```bash
lsof -i :41244
```

**Expected:** Shows node/tsx process

---

## 🐛 Troubleshooting

### Problem: "Command not found"

**Solution:** You're not in the repository root
```bash
# Check current directory
pwd

# Should be:
# /Users/Drew_Garratt/Development/a2a-js-sdk-examples

# If not, navigate there:
cd /Users/Drew_Garratt/Development/a2a-js-sdk-examples
```

---

### Problem: "Port already in use"

**Solution:** Kill existing process
```bash
# Find and kill process on port 41244
lsof -ti:41244 | xargs kill -9

# Then restart agent
pnpm agent:hello-world
```

---

### Problem: "Connection Failed" in A2A Inspector

**Checklist:**
1. ✅ Is the agent running? (Check terminal output)
2. ✅ Is the port correct? (Check agent startup message)
3. ✅ Can you curl the agent card? (See verification above)
4. ✅ Is the URL correct in inspector? (Use `http://localhost:PORT`)

---

### Problem: No response in chat

**Checklist:**
1. ✅ Does agent require API keys? (TMDB, GitHub, etc.)
2. ✅ Check terminal for errors
3. ✅ Check "Debug" tab in inspector for protocol messages
4. ✅ Try a simpler prompt

---

## 🎯 Complete Test Scenario

### Test All 3 Core Features:

#### 1. Basic Chat (Hello World)
```bash
pnpm agent:hello-world
```
Inspector: `http://localhost:41244`
Prompt: `"Hello!"`
✅ **Verify:** Text response

#### 2. Tool Calling (Dice)
```bash
pnpm agent:dice
```
Inspector: `http://localhost:41245`
Prompt: `"Roll a dice"`
✅ **Verify:** Random number + tool call in Debug tab

#### 3. Artifacts (Analytics)
```bash
pnpm agent:analytics
```
Inspector: `http://localhost:41247`
Prompt: `"Chart: Q1:100 Q2:150 Q3:200 Q4:180"`
✅ **Verify:** Text + PNG artifact in Artifacts tab

---

## 📊 What to Look for in A2A Inspector

### Agent Card Tab
- ✅ Agent name and description
- ✅ Protocol version (0.3.0)
- ✅ Capabilities (streaming, etc.)
- ✅ Skills list
- ✅ Green checkmarks (protocol compliance)

### Chat Tab
- ✅ Real-time streaming (if streaming enabled)
- ✅ Proper message formatting
- ✅ Clear, helpful responses

### Debug Tab
- ✅ JSON-RPC messages
- ✅ Tool calls (if agent uses tools)
- ✅ Request/response structure
- ✅ No error messages

### Artifacts Tab
- ✅ Generated files (charts, code, etc.)
- ✅ Proper MIME types
- ✅ Downloadable/viewable

---

## 🚦 Success Criteria

Your setup works correctly if:

1. ✅ You can start any agent with `pnpm agent:<name>`
2. ✅ Agent card loads in A2A Inspector
3. ✅ Chat responses appear correctly
4. ✅ No errors in terminal or inspector
5. ✅ Artifacts display (for agents that generate them)
6. ✅ Tool calls work (for agents with tools)

---

## 📚 Next Steps

After verifying agents work with A2A Inspector:

1. **Automated Testing**: Run `pnpm test` for unit tests
2. **Build Custom Agent**: Use examples as templates and reference implementations
3. **Deploy**: Examples demonstrate deployment patterns
4. **Multi-Agent**: Test the Travel Planner orchestrator

---

## 🎉 You're Ready!

Your pnpm commands + A2A Inspector workflow is fully functional. Start with `hello-world`, then explore the other agents.

**Quick Reference:**
```bash
# Start agent
pnpm agent:hello-world

# Open browser
open https://inspector.a2a.plus

# Connect to
http://localhost:41244

# Chat!
```

---

**Happy Testing! 🚀**

