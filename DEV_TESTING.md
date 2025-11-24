# Development Testing with A2A Inspector

This document explains the improved testing workflow using **Docker** for the inspector and proper process orchestration.

## Quick Start

```bash
# Start interactive testing (inspector + agent)
pnpm start-testing

# Or directly
pnpm dev:test
```

## Prerequisites

- **Docker** (for running the inspector)
  - macOS: https://docs.docker.com/desktop/install/mac-install/
  - Linux: https://docs.docker.com/engine/install/
  - Windows: https://docs.docker.com/desktop/install/windows-install/

## Features

### ✅ **Docker-Based Inspector**

The inspector runs in a Docker container:
- No Python/Node.js dependencies required
- Self-contained and reproducible
- Works identically on all machines
- Easy cleanup (no files outside project)

### ✅ **Auto-Open Browser**

The script automatically opens your browser to the inspector:
- Opens `http://127.0.0.1:5001`
- Displays the agent URL to copy/paste
- Works on macOS, Linux, and Windows

### ✅ **Proper Dependency Management**

The new `dev-test` script ensures:
- Inspector starts **first** and becomes healthy before agents start
- Health checks verify the inspector is ready (not just timeouts)
- Agents only start after inspector is confirmed running

### ✅ **Complete Process Cleanup**

When you press `Ctrl+C`:
1. All child processes receive `SIGTERM` for graceful shutdown
2. After 2 seconds, any remaining processes get `SIGKILL`
3. Parent process waits 3 seconds total, then exits cleanly

**No more orphaned processes!**

### ✅ **Multi-Agent Support**

Test multiple agents simultaneously:

```bash
# Single agent
pnpm start-testing
# Choose: hello-world

# Multiple agents
pnpm start-testing
# Choose: weather,airbnb

# Automatic multi-agent scenario
pnpm start-testing
# Choose: planner  (auto-starts weather + airbnb + planner)
```

## Architecture

### Process Hierarchy

```
dev-test (parent)
├── inspector (child 1)
│   ├── backend server
│   └── frontend build
└── agent(s) (child 2+)
    └── hono server
```

When parent dies, all children die with it.

### Health Checks

The script actively checks if the inspector is ready:

```typescript
while (Date.now() - startTime < INSPECTOR_MAX_WAIT) {
  if (await checkPort(INSPECTOR_PORT)) {
    console.log("✅ Inspector is ready!");
    return;
  }
  await new Promise(resolve => setTimeout(resolve, 500));
}
```

This ensures agents don't try to connect to a non-responsive inspector.

## Turborepo Integration

The `turbo.json` now includes tasks for orchestrated development:

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

These tasks can be used for future Turbo-native orchestration.

## Available Agents

| Agent | Port | Description |
|-------|------|-------------|
| `hello-world` | 41244 | Simple greetings |
| `dice` | 41245 | Roll dice & check primes |
| `github` | 41246 | GitHub queries |
| `analytics` | 41247 | Generate charts |
| `currency` | 41248 | Currency conversion |
| `movie` | 41249 | Movie search (TMDB) |
| `coder` | 41250 | Code generation |
| `content-editor` | 41251 | Text editing |
| `weather` | 41252 | Weather forecasts |
| `airbnb` | 41253 | Airbnb search |
| `planner` | 41254 | Multi-agent planner |

## Multi-Agent Scenarios

### Travel Planner (Orchestrator)

The planner agent coordinates weather and airbnb agents:

```bash
pnpm start-testing
# Choose: planner
```

This automatically starts:
1. Weather Agent (port 41252)
2. Airbnb Agent (port 41253)
3. Planner Orchestrator (port 41254)

The planner uses `a2a-ai-provider` to delegate tasks to the specialist agents.

### Custom Multi-Agent

Start any combination:

```bash
pnpm start-testing
# Choose: weather,airbnb,github
```

## Troubleshooting

### Inspector Not Starting

If the inspector fails to start within 30 seconds:

```bash
# Check if inspector is installed
ls ~/Development/a2a-inspector

# If not, install it
cd ~/Development
git clone https://github.com/a2aproject/a2a-inspector.git
cd a2a-inspector
uv sync
cd frontend && npm install
```

### Port Already in Use

If a port is already in use:

```bash
# Find and kill the process
lsof -ti :5001 | xargs kill -9   # Inspector
lsof -ti :41244 | xargs kill -9  # Agent
```

Or use the cleanup script:

```bash
pnpm inspector:stop
```

### Orphaned Processes

The new script should prevent orphaned processes, but if you find any:

```bash
# Kill all node processes (⚠️ WARNING: kills ALL node!)
pkill -9 node

# Or more targeted
pkill -f "start-inspector"
pkill -f "agent:hello-world"
```

## Implementation Details

### Process Spawning

```typescript
const proc = spawn(command, args, {
  stdio: options.stdio || "inherit",
  shell: true,
  env: { ...process.env },
  detached: false,  // Keep attached to parent
});
```

- `detached: false` ensures child dies when parent dies
- `shell: true` allows running npm/pnpm scripts
- `stdio` can be "inherit" (show output) or "pipe" (hide output)

### Cleanup Strategy

```typescript
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", cleanup);

function cleanup() {
  for (const proc of childProcesses) {
    proc.kill("SIGTERM");  // Graceful
    setTimeout(() => {
      proc.kill("SIGKILL"); // Force after 2s
    }, 2000);
  }
}
```

This ensures:
1. Graceful shutdown first (SIGTERM)
2. Force kill if needed (SIGKILL)
3. All cleanup handlers are registered

## Migration from Old Script

The old `start-testing.ts` had issues:
- ❌ Used `spawn("pnpm", ["inspector"])` with 3s timeout
- ❌ Only killed the agent on Ctrl+C
- ❌ Inspector could remain running

The new `dev-test.ts` fixes all of these:
- ✅ Proper health checks with port polling
- ✅ Kills all child processes on Ctrl+C
- ✅ Supports multi-agent scenarios

## Future Enhancements

Potential improvements:
- [ ] Add agent health checks before showing "ready"
- [ ] Support for restarting individual agents
- [ ] Integration with Turbo's native task runner
- [ ] Parallel agent startup (currently sequential)
- [ ] Agent dependency graph (e.g., planner needs weather + airbnb)

## References

- [Turborepo Persistent Tasks](https://turbo.build/repo/docs/crafting-your-repository/running-tasks#persistent-tasks)
- [Node.js Child Processes](https://nodejs.org/api/child_process.html)
- [A2A Inspector Setup](./INSPECTOR_SETUP.md)
- [Test Workflow](./TEST_WORKFLOW.md)

