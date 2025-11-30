# Hello World Agent Reference

> **Source**: `samples/python/agents/helloworld/`
> **Our Implementation**: `examples/agents/hello-world/`

## Overview

The simplest possible A2A agent - returns "Hello World" for any input. Demonstrates the core A2A protocol structure without any LLM or tool complexity.

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│   Client    │────►│  A2A Protocol   │────►│ HelloWorld  │
│             │◄────│  (JSON-RPC)     │◄────│   Agent     │
└─────────────┘     └─────────────────┘     └─────────────┘
```

## Agent Card

```json
{
  "name": "Hello World Agent",
  "description": "Just a hello world agent",
  "url": "http://localhost:9999/",
  "version": "1.0.0",
  "default_input_modes": ["text"],
  "default_output_modes": ["text"],
  "capabilities": {
    "streaming": true
  },
  "skills": [
    {
      "id": "hello_world",
      "name": "Returns hello world",
      "description": "just returns hello world",
      "tags": ["hello world"],
      "examples": ["hi", "hello world"]
    }
  ],
  "supports_authenticated_extended_card": true
}
```

## Key Components

### 1. Agent Class (No LLM)

```python
class HelloWorldAgent:
    """Hello World Agent."""

    async def invoke(self) -> str:
        return 'Hello World'
```

**Key Point**: No LLM, no tools - just returns a hardcoded string.

### 2. Agent Executor

```python
class HelloWorldAgentExecutor(AgentExecutor):
    def __init__(self):
        self.agent = HelloWorldAgent()

    async def execute(
        self,
        context: RequestContext,
        event_queue: EventQueue,
    ) -> None:
        result = await self.agent.invoke()
        await event_queue.enqueue_event(new_agent_text_message(result))

    async def cancel(
        self, context: RequestContext, event_queue: EventQueue
    ) -> None:
        raise Exception('cancel not supported')
```

**Key Points**:
- `execute()` is the main entry point
- Uses `EventQueue` to emit responses
- `new_agent_text_message()` helper creates proper A2A message format

### 3. Server Setup

```python
request_handler = DefaultRequestHandler(
    agent_executor=HelloWorldAgentExecutor(),
    task_store=InMemoryTaskStore(),
)

server = A2AStarletteApplication(
    agent_card=public_agent_card,
    http_handler=request_handler,
    extended_agent_card=specific_extended_agent_card,
)

uvicorn.run(server.build(), host='0.0.0.0', port=9999)
```

## A2A Protocol Flow

### 1. Agent Discovery
```
GET /.well-known/agent-card.json
→ Returns AgentCard JSON
```

### 2. Send Message
```json
POST /
{
  "jsonrpc": "2.0",
  "method": "message/send",
  "id": "1",
  "params": {
    "message": {
      "role": "user",
      "messageId": "msg-1",
      "parts": [{"type": "text", "text": "hi"}]
    }
  }
}
```

### 3. Response
```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "result": {
    "id": "task-123",
    "status": {
      "state": "completed",
      "message": {
        "role": "agent",
        "parts": [{"type": "text", "text": "Hello World"}]
      }
    }
  }
}
```

## Extended Agent Card Feature

The Python example demonstrates authenticated extended cards:

```python
# Public card (unauthenticated)
public_agent_card = AgentCard(
    name='Hello World Agent',
    skills=[skill],  # Basic skill only
    supports_authenticated_extended_card=True,
)

# Extended card (authenticated)
extended_agent_card = public_agent_card.model_copy(
    update={
        'name': 'Hello World Agent - Extended Edition',
        'skills': [skill, extended_skill],  # Additional skills
    }
)
```

## Our TypeScript Implementation

### Agent (`examples/agents/hello-world/agent.ts`)

```typescript
import { ToolLoopAgent } from "ai";

export function createHelloWorldAgent(model: LanguageModel) {
  return new ToolLoopAgent({
    model,
    instructions: getHelloWorldPrompt(),
    // No tools needed for hello world
  });
}
```

### Prompt (`examples/agents/hello-world/prompt.ts`)

```typescript
export function getHelloWorldPrompt(): string {
  return `You are a friendly greeting agent. 
When someone says hello or greets you, respond with a warm, friendly greeting.
Keep responses brief and cheerful.`;
}
```

### Key Differences

| Aspect | Python | Our TypeScript |
|--------|--------|----------------|
| LLM | None (hardcoded) | Uses AI SDK with model |
| Response | Always "Hello World" | Dynamic greeting via LLM |
| Complexity | Minimal | Slightly more (LLM call) |

## Testing

```bash
# Start agent
cd examples/agents && pnpm dev

# Test via curl
curl -X POST http://localhost:3000/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "id": "test",
    "params": {
      "message": {
        "role": "user",
        "messageId": "msg-1",
        "parts": [{"kind": "text", "text": "Hello!"}]
      }
    }
  }'
```

## Checklist for Implementation

- [x] Agent Card with skills
- [x] Basic message handling
- [x] Text response
- [x] Streaming support
- [ ] Extended agent card for authenticated users
- [x] Worker deployment (`workers/hello-world/`)

