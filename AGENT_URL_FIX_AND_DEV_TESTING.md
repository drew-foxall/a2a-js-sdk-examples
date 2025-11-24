# Agent URL Fix & Development Testing Improvements

## Summary

This update addresses two critical issues:
1. **Fixed incorrect `url` field in all agent cards** - Inspector was receiving 404 errors
2. **Improved development testing workflow** - Proper process orchestration and cleanup

---

## 🔧 Issue 1: Agent Card URL Field

### Problem

All agents had incorrect `url` values in their `AgentCard`:

```typescript
// ❌ WRONG - Points to agent card, not agent API
url: `${BASE_URL}/.well-known/agent-card.json`
url: "http://localhost:41241/"  // Hardcoded wrong port
```

The inspector was trying to POST messages to the agent card URL, which only accepts GET requests, resulting in **404 errors**.

### Root Cause

The `url` field in `AgentCard` should point to the **agent's base URL** where it accepts requests, NOT the agent card's URL:

- ✅ Correct: `http://localhost:41244` (base URL)
- ❌ Wrong: `http://localhost:41244/.well-known/agent-card.json` (agent card URL)

### Solution

Fixed all 11 agents:

**Pattern Fix (6 agents):**
- `analytics-agent` - `${BASE_URL}/.well-known/agent-card.json` → `BASE_URL`
- `dice-agent` - `${BASE_URL}/.well-known/agent-card.json` → `BASE_URL`
- `currency-agent` - `${BASE_URL}/.well-known/agent-card.json` → `BASE_URL`
- `github-agent` - `${BASE_URL}/.well-known/agent-card.json` → `BASE_URL`
- `weather-agent` - `${BASE_URL}/.well-known/agent-card.json` → `BASE_URL`
- `airbnb-agent` - `${BASE_URL}/.well-known/agent-card.json` → `BASE_URL`

**Hardcoded URL + Port Fix (3 agents):**
- `movie-agent` - `http://localhost:41241/` → `BASE_URL` (port 41241 → 41249)
- `coder` - `http://localhost:41242/` → `BASE_URL` (port 41242 → 41250)
- `content-editor` - `http://localhost:41243/` → `BASE_URL` (port 41243 → 41251)

**Already Fixed (2 agents):**
- `hello-world` ✓
- `planner` ✓

### Impact

- ✅ Inspector can now successfully send messages to agents
- ✅ All agent ports are now correct and consistent
- ✅ Agent cards properly identify the agent's API endpoint

---

## 🚀 Issue 2: Development Testing Workflow

### Problems with Old Approach

The original `start-testing.ts` had several issues:

1. **No health checks** - Used arbitrary 3-second timeout for inspector
2. **Incomplete cleanup** - Only killed the agent, inspector kept running
3. **Manual process management** - Didn't leverage Turborepo capabilities
4. **No multi-agent support** - Couldn't test orchestrator scenarios

### New Approach

Created `scripts/dev-test.ts` with proper orchestration:

#### Key Features

✅ **Health Checks**
```typescript
// Poll inspector port until it's ready (max 30s)
while (Date.now() - startTime < INSPECTOR_MAX_WAIT) {
  if (await checkPort(INSPECTOR_PORT)) {
    console.log("✅ Inspector is ready!");
    return;
  }
  await new Promise(resolve => setTimeout(resolve, 500));
}
```

✅ **Complete Process Cleanup**
```typescript
function cleanup() {
  for (const proc of childProcesses) {
    proc.kill("SIGTERM");  // Graceful shutdown
    setTimeout(() => {
      if (!proc.killed) proc.kill("SIGKILL");  // Force after 2s
    }, 2000);
  }
}

process.on("SIGINT", cleanup);   // Ctrl+C
process.on("SIGTERM", cleanup);  // Kill
process.on("exit", cleanup);     // Process exit
```

✅ **Multi-Agent Support**
```bash
# Single agent
pnpm start-testing
> hello-world

# Multiple agents
pnpm start-testing
> weather,airbnb

# Auto-scenario (starts weather + airbnb + planner)
pnpm start-testing
> planner
```

✅ **Turborepo Integration**

Added persistent dev tasks to `turbo.json`:

```json
{
  "tasks": {
    "dev:inspector": {
      "cache": false,
      "persistent": true
    },
    "dev:agent": {
      "cache": false,
      "persistent": true,
      "dependsOn": ["#dev:inspector"]
    }
  }
}
```

### Process Hierarchy

```
dev-test (parent process)
├── inspector (child 1)
│   ├── backend server (port 5001)
│   └── frontend build
└── agent(s) (child 2+)
    └── hono server (port 41244+)
```

When parent dies → all children die automatically.

### Usage

```bash
# Start testing workflow
pnpm start-testing

# Available agents:
#   hello-world, dice, github, analytics, currency,
#   movie, coder, content-editor, weather, airbnb, planner

# Multi-agent example
> planner
🎭 Multi-agent scenario: Travel Planner
   Starting: weather → airbnb → planner

📋 Testing Setup Ready:
  • Inspector: http://127.0.0.1:5001
  • weather:   http://localhost:41252
  • airbnb:    http://localhost:41253
  • planner:   http://localhost:41254

💡 Press Ctrl+C to stop all services
```

---

## 📋 Updated Commands

### Root `package.json`

```json
{
  "scripts": {
    "dev:inspector": "tsx scripts/start-inspector.ts",
    "dev:test": "tsx scripts/dev-test.ts",
    "start-testing": "pnpm dev:test",
    // ... rest unchanged
  }
}
```

### Turbo Tasks

```json
{
  "tasks": {
    "dev:inspector": {
      "cache": false,
      "persistent": true
    },
    "dev:agent": {
      "cache": false,
      "persistent": true,
      "dependsOn": ["#dev:inspector"]
    }
  }
}
```

---

## 🧪 Testing the Fixes

### 1. Test Single Agent

```bash
# Start hello-world with inspector
pnpm start-testing
> hello-world

# In inspector UI (http://127.0.0.1:5001):
# - Connect to: http://localhost:41244
# - Send: "Hello!"
# - Should get response ✅
```

### 2. Test Multi-Agent (Planner)

```bash
# Start planner scenario
pnpm start-testing
> planner

# In inspector UI:
# - Connect to: http://localhost:41254 (planner)
# - Send: "Plan a trip to Paris for 2 people"
# - Should coordinate weather + airbnb ✅
```

### 3. Test Cleanup

```bash
# Start any agent
pnpm start-testing
> analytics

# Press Ctrl+C
# ✅ Should see: "🛑 Stopping all services..."
# ✅ All processes should terminate
# ✅ No orphaned processes
```

Verify no orphans:
```bash
ps aux | grep -E "(inspector|agent)" | grep -v grep
# Should be empty ✅
```

---

## 📁 Files Changed

### New Files
- `scripts/dev-test.ts` - New orchestration script
- `DEV_TESTING.md` - Documentation for new workflow
- `AGENT_URL_FIX_AND_DEV_TESTING.md` - This file

### Modified Files
- `turbo.json` - Added `dev:inspector` and `dev:agent` tasks
- `package.json` - Added `dev:inspector`, `dev:test`, updated `start-testing`
- All 11 agent `index.ts` files - Fixed `url` field and ports

### Agent Index Files
- `examples/agents/src/agents/analytics-agent/index.ts`
- `examples/agents/src/agents/coder/index.ts`
- `examples/agents/src/agents/content-editor/index.ts`
- `examples/agents/src/agents/currency-agent/index.ts`
- `examples/agents/src/agents/dice-agent/index.ts`
- `examples/agents/src/agents/github-agent/index.ts`
- `examples/agents/src/agents/hello-world/index.ts`
- `examples/agents/src/agents/movie-agent/index.ts`
- `examples/agents/src/agents/travel-planner-multiagent/airbnb-agent/index.ts`
- `examples/agents/src/agents/travel-planner-multiagent/planner/index.ts`
- `examples/agents/src/agents/travel-planner-multiagent/weather-agent/index.ts`

---

## 🎯 Benefits

### For Development
- ✅ Faster iteration - health checks ensure inspector is ready
- ✅ Cleaner workflow - no manual cleanup needed
- ✅ Multi-agent testing - easy to test orchestrator scenarios
- ✅ Better debugging - clear process hierarchy

### For Testing
- ✅ Reliable connections - agents always have correct URLs
- ✅ Consistent ports - no more port conflicts
- ✅ Complete cleanup - no orphaned processes
- ✅ Scalable - supports any number of agents

### For Future Work
- ✅ Turborepo ready - tasks defined for native integration
- ✅ Extensible - easy to add new agents or scenarios
- ✅ Documented - clear process management patterns
- ✅ Type-safe - TypeScript implementation

---

## 🔮 Future Enhancements

Potential improvements for the testing workflow:

1. **Agent Health Checks**
   - Poll agent ports before showing "ready"
   - Verify agent card is accessible
   - Check OpenAI API key is loaded

2. **Hot Reload**
   - Watch agent files for changes
   - Restart individual agents without killing inspector
   - Preserve inspector state across agent restarts

3. **Turborepo Native**
   - Use `turbo run dev:agent` directly
   - Leverage Turbo's task caching
   - Better terminal UI with Turbo's output

4. **Agent Dependency Graph**
   - Declare agent dependencies (planner → [weather, airbnb])
   - Auto-start dependencies
   - Validate dependency health

5. **Test Scenarios**
   - Predefined test scenarios in JSON
   - Quick launch for common patterns
   - Automated test assertions

---

## 📚 Related Documentation

- [DEV_TESTING.md](./DEV_TESTING.md) - Detailed testing workflow
- [INSPECTOR_SETUP.md](./INSPECTOR_SETUP.md) - Inspector installation
- [TEST_WORKFLOW.md](./TEST_WORKFLOW.md) - Manual testing guide
- [AGENT_TEST_PRINCIPLES.md](./examples/agents/AGENT_TEST_PRINCIPLES.md) - Unit testing

---

## ✅ Verification Checklist

- [x] All 11 agents have correct `url` field
- [x] All agent ports match `scripts/start-testing.ts` definitions
- [x] Inspector health check works (30s timeout)
- [x] Process cleanup kills all children (SIGTERM → SIGKILL)
- [x] Multi-agent support (comma-separated, planner scenario)
- [x] Turborepo tasks defined (`dev:inspector`, `dev:agent`)
- [x] Documentation created (DEV_TESTING.md)
- [x] TypeScript errors fixed (typecheck passes)
- [x] Linting errors fixed (biome check passes)
- [x] Old `start-testing.ts` behavior preserved (via `dev:test`)

---

## 🎉 Result

**The A2A Inspector now works flawlessly with all agents!**

- No more 404 errors
- No more orphaned processes
- Multi-agent scenarios just work
- Clean, documented, type-safe implementation

Ready for comprehensive agent testing! 🚀

