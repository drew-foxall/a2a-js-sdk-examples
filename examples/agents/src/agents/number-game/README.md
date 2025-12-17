# Number Guessing Game

A minimalist multi-agent demo with two cooperating agents playing a number guessing game. **No LLMs required** - demonstrates core A2A concepts with pure TypeScript logic.

## Architecture

```
┌─────────────┐
│   Client    │ (Uses any A2A client)
│             │
└──────┬──────┘
       │
       ├─────────────────────┐
       │                     │
┌──────▼──────┐       ┌──────▼──────┐
│ AgentAlice  │       │ AgentCarol  │
│  Port 8000  │       │  Port 8001  │
│  (Grader)   │       │ (Visualizer)│
└─────────────┘       └─────────────┘
```

## Agent Roles

| Agent | Role | Port |
|-------|------|------|
| **Alice** | Picks secret number (1-100), grades guesses | 8000 |
| **Carol** | Visualizes guess history, provides hints | 8001 |

## Usage

### Start Agents

```bash
# Terminal 1: Start Alice (grader)
pnpm agents:number-game-alice

# Terminal 2: Start Carol (visualizer)
pnpm agents:number-game-carol
```

### Play the Game

Use any A2A client to interact:

```bash
# Make a guess to Alice
curl -X POST http://localhost:8000/message/send \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "id": "1",
    "params": {
      "message": {
        "role": "user",
        "parts": [{"kind": "text", "text": "50"}]
      }
    }
  }'
# Response: "too high" or "too low" or "correct! attempts: N"

# Get visualization from Carol
curl -X POST http://localhost:8001/message/send \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "id": "1",
    "params": {
      "message": {
        "role": "user",
        "parts": [{"kind": "text", "text": "visualize 50,25,37"}]
      }
    }
  }'
```

## Key Features

1. **No LLM**: Pure logic, no API keys required
2. **Multi-Agent**: Two cooperating A2A agents
3. **Local**: All agents run on localhost
4. **Educational**: Minimal complexity, demonstrates A2A patterns

## Why This Matters

This example proves that A2A works for **any agent**, not just LLM-based ones:

- **Game logic** can be exposed as A2A agents
- **Workflow coordination** doesn't need AI
- **Testing infrastructure** benefits from deterministic agents
- **Educational purposes** - learn A2A without API complexity

## Files

```
number-game/
├── README.md           # This file
├── alice/
│   └── index.ts       # Alice agent (grader)
└── carol/
    └── index.ts       # Carol agent (visualizer)
```

## State Persistence

### Implementation

| Agent | Local (Node.js) | Worker (Cloudflare) |
|-------|-----------------|---------------------|
| **Alice** | ✅ In-memory class | ✅ Redis (Upstash) |
| **Carol** | ✅ Stateless | ✅ Stateless |

### How It Works

**Worker Alice** uses Redis to persist game state:

```typescript
interface GameState {
  secret: number;      // The number to guess
  attempts: number;    // Number of guesses made
  createdAt: string;   // When game started
  guesses: number[];   // History of guesses
}
```

Session identification (in priority order):
1. `contextId` from A2A request params
2. `X-Session-ID` header
3. Auto-generated UUID (returned in response)

### Commands

| Command | Description |
|---------|-------------|
| `50` | Make a guess |
| `new` / `reset` | Start a new game |
| `status` / `info` | Show current game status |

### Configuration

Without Redis, Alice still works but warns that state won't persist:

```bash
# Set Redis credentials for persistence
wrangler secret put UPSTASH_REDIS_REST_URL
wrangler secret put UPSTASH_REDIS_REST_TOKEN
```

### Why Custom Implementation?

These agents use **custom JSON-RPC** handlers instead of the SDK's `A2AServer` and `TaskStore`:
- Demonstrates A2A works with any implementation
- Game state is domain-specific, not task-specific
- Simpler for educational purposes

