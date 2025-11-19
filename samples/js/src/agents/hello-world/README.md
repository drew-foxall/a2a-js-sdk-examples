# Hello World Agent

The simplest possible A2A agent implementation using AI SDK + Hono.

## Overview

This agent demonstrates the **foundation pattern** for all AI SDK + A2A agents:
- ✅ Pure AI SDK `ToolLoopAgent` (protocol-agnostic)
- ✅ A2A protocol integration via `A2AAdapter`
- ✅ Clean separation of concerns
- ✅ No external dependencies
- ✅ No tools (pure text generation)

## What It Does

Responds to greetings with friendly hello messages:
- **Input**: "Hi", "Hello World", "Greet me"
- **Output**: Warm, cheerful greeting responses

## Architecture

```
hello-world/
├── agent.ts    # Pure AI SDK agent (protocol-agnostic)
├── index.ts    # A2A integration via A2AAdapter
├── prompt.ts   # System prompt
└── README.md   # This file
```

## Quick Start

### 1. Install Dependencies

```bash
cd samples/js
pnpm install
```

### 2. Set Environment Variables

```bash
# Required: AI provider API key
export OPENAI_API_KEY=your_openai_api_key

# Optional: Change provider/model
export AI_PROVIDER=openai  # openai, anthropic, google, etc.
export AI_MODEL=gpt-4o-mini
```

### 3. Start the Agent

```bash
# From project root
pnpm start:hello-world

# Or from samples/js
pnpm tsx src/agents/hello-world/index.ts
```

The agent will start on **port 41244** by default.

## Usage

### Test with curl

```bash
# Simple greeting
curl -X POST http://localhost:41244/message/send \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "role": "user",
      "parts": [{"kind": "text", "text": "Hello!"}]
    }
  }'
```

### Test with A2A Client

```bash
# Using the A2A CLI client (if available)
a2a-client http://localhost:41244 "Hello World!"
```

### Agent Card

```bash
curl http://localhost:41244/.well-known/agent-card.json
```

## Technical Details

### Agent Implementation

The agent uses AI SDK's `ToolLoopAgent` with:
- **Model**: Configurable via environment variables (supports 8+ providers)
- **Tools**: None (simplest possible implementation)
- **Instructions**: Simple greeting prompt

```typescript
export function createHelloWorldAgent(model: LanguageModel) {
  return new ToolLoopAgent({
    model,
    instructions: getHelloWorldPrompt(),
    tools: {}, // No tools - pure text generation
  });
}
```

### A2A Integration

Uses the unified `A2AAdapter` pattern:
```typescript
const adapter = new A2AAdapter({
  agent,
  agentCard,
  logger: console,
});
```

This adapter automatically:
- ✅ Handles A2A protocol communication
- ✅ Manages conversation history
- ✅ Emits task status updates
- ✅ Streams responses
- ✅ Parses artifacts (if configured)

### Key Features

- **Protocol-Agnostic**: Agent code has zero A2A coupling
- **Reusable**: Same agent can be exposed via A2A, MCP, REST, CLI
- **Type-Safe**: Full TypeScript typing, no `any` types
- **Flexible**: Supports 8+ LLM providers

## Why This Example?

This is the **foundation example** because it demonstrates:

1. **Minimal Complexity**: No tools, no external APIs, no artifacts
2. **Clear Pattern**: Shows the core AI SDK + A2A architecture
3. **Validation**: Tests that `A2AAdapter` works correctly
4. **Learning**: Easy to understand for developers new to A2A

All other agent examples build on this foundation by adding:
- **Tools** (Dice Agent, Movie Agent, GitHub Agent)
- **Streaming Artifacts** (Coder Agent, Analytics Agent)
- **External APIs** (Movie Agent, GitHub Agent)
- **Multi-Agent Orchestration** (Airbnb Planner)

## Port

- **Default**: 41244
- **Configurable**: Edit `PORT` constant in `index.ts`

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | ✅ (or other provider) | - | API key for LLM provider |
| `AI_PROVIDER` | ❌ | `openai` | Provider: openai, anthropic, google, etc. |
| `AI_MODEL` | ❌ | `gpt-4o-mini` | Model to use |

## Next Steps

After understanding this example, explore:
1. **Dice Agent** - Adds simple tools (roll dice, check prime)
2. **Movie Agent** - Adds external API integration (TMDB)
3. **Coder Agent** - Adds streaming artifacts
4. **GitHub Agent** - Adds complex API integration

## Learn More

- [A2A Protocol Documentation](https://google.github.io/A2A/)
- [AI SDK Documentation](https://sdk.vercel.ai/docs)
- [A2A JS SDK](https://github.com/drew-foxall/a2a-js)
- [Conversion Plan](../../../../../../../PYTHON_TO_JS_CONVERSION_PLAN.md)

