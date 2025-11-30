# A2A Without Framework Reference

> **Source**: `samples/python/agents/a2a-mcp-without-framework/`
> **Our Implementation**: Not started (educational reference)

## Overview

Demonstrates using the a2a-python SDK directly without any agent framework. Shows the raw mechanics of A2A server and client communication.

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Client    │────►│  A2A Protocol   │────►│  Raw Handler    │
│  (a2a-sdk)  │◄────│  (JSON-RPC)     │◄────│  (+ Gemini)     │
└─────────────┘     └─────────────────┘     └─────────────────┘
```

## Key Components

### 1. Raw Server Implementation

```python
from a2a.server import A2AServer
from a2a.types import AgentCard, Message, Task

class RawAgentExecutor:
    """Agent executor without any framework."""
    
    async def execute(self, context, event_queue):
        # Get user input
        user_input = context.get_user_input()
        
        # Call Gemini directly
        response = await gemini.generate_content(user_input)
        
        # Emit response
        await event_queue.enqueue_event(
            new_agent_text_message(response.text)
        )

# Create server
agent_card = AgentCard(
    name="Raw A2A Agent",
    description="Agent without framework",
    url="http://localhost:9999",
    version="1.0.0",
)

server = A2AServer(
    agent_card=agent_card,
    executor=RawAgentExecutor(),
)

# Run
uvicorn.run(server.build(), port=9999)
```

### 2. Raw Client Implementation

```python
from a2a.client import A2AClient

async def main():
    client = A2AClient("http://localhost:9999")
    
    # Get agent card
    card = await client.get_agent_card()
    print(f"Connected to: {card.name}")
    
    # Send message
    response = await client.send_message(
        "What is A2A protocol?"
    )
    
    # Process response
    for artifact in response.artifacts:
        for part in artifact.parts:
            if part.type == "text":
                print(part.text)

asyncio.run(main())
```

## A2A Protocol Details

### Agent Card Request
```http
GET /.well-known/agent-card.json HTTP/1.1
Host: localhost:9999
```

### Agent Card Response
```json
{
  "name": "Raw A2A Agent",
  "description": "Agent without framework",
  "url": "http://localhost:9999",
  "version": "1.0.0",
  "capabilities": {
    "streaming": false,
    "pushNotifications": false
  }
}
```

### Message Send Request
```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "message/send",
  "params": {
    "message": {
      "role": "user",
      "messageId": "msg-1",
      "parts": [{"type": "text", "text": "What is A2A?"}]
    }
  }
}
```

### Message Send Response
```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "result": {
    "id": "task-123",
    "status": {"state": "completed"},
    "artifacts": [{
      "parts": [{"type": "text", "text": "A2A is..."}]
    }]
  }
}
```

## Key Features

1. **No Framework**: Direct SDK usage
2. **Educational**: Shows protocol mechanics
3. **Minimal**: No unnecessary abstractions
4. **Reference**: Understand what frameworks do

## TypeScript Implementation

### Raw Server with Hono

```typescript
import { Hono } from "hono";

const app = new Hono();

// Agent Card endpoint
app.get("/.well-known/agent-card.json", (c) => {
  return c.json({
    name: "Raw A2A Agent",
    description: "Agent without framework",
    url: "http://localhost:9999",
    version: "1.0.0",
    capabilities: { streaming: false },
  });
});

// Message handler
app.post("/", async (c) => {
  const { jsonrpc, id, method, params } = await c.req.json();
  
  if (method === "message/send") {
    const userText = params.message.parts
      .filter((p: any) => p.type === "text")
      .map((p: any) => p.text)
      .join(" ");
    
    // Call LLM directly
    const response = await generateText({
      model: openai("gpt-4o"),
      prompt: userText,
    });
    
    return c.json({
      jsonrpc: "2.0",
      id,
      result: {
        id: crypto.randomUUID(),
        status: { state: "completed" },
        artifacts: [{
          parts: [{ type: "text", text: response.text }],
        }],
      },
    });
  }
  
  return c.json({
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: "Method not found" },
  });
});

export default app;
```

### Raw Client

```typescript
async function sendMessage(agentUrl: string, message: string) {
  // Get agent card
  const cardResponse = await fetch(`${agentUrl}/.well-known/agent-card.json`);
  const card = await cardResponse.json();
  console.log(`Connected to: ${card.name}`);
  
  // Send message
  const response = await fetch(agentUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "1",
      method: "message/send",
      params: {
        message: {
          role: "user",
          messageId: crypto.randomUUID(),
          parts: [{ type: "text", text: message }],
        },
      },
    }),
  });
  
  const result = await response.json();
  return result.result.artifacts[0].parts[0].text;
}
```

## Why Use Frameworks?

This raw implementation shows what our SDK abstractions provide:
- **Type Safety**: Zod schemas for validation
- **Error Handling**: Proper JSON-RPC errors
- **Streaming**: SSE implementation
- **Task Management**: State tracking
- **Agent Abstraction**: ToolLoopAgent integration

## Checklist for Implementation

- [x] Understanding only - not for implementation
- [x] Reference for protocol details
- [x] Useful for debugging

## Notes

This example is primarily educational:
- Understand A2A protocol mechanics
- Debug communication issues
- Build custom integrations

For production, use:
- `@drew-foxall/a2a-js-sdk` for server
- `@drew-foxall/a2a-ai-sdk-adapter` for AI SDK integration
- `a2a-ai-provider` for consuming A2A agents

