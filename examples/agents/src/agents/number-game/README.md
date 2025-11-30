# Number Guessing Game

A minimalist multi-agent demo with three cooperating agents playing a number guessing game. **No LLMs required** - demonstrates core A2A concepts with pure TypeScript logic.

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

