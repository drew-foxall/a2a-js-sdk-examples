# LangGraph Currency Agent Reference

> **Source**: `samples/python/agents/langgraph/`
> **Our Implementation**: `examples/agents/currency-agent/`

## Overview

A currency conversion agent built with LangGraph using the ReAct pattern. Demonstrates multi-turn conversations, streaming responses, and the `input-required` state for gathering missing information.

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Client    │────►│  A2A Protocol   │────►│ LangGraph Agent │
│             │◄────│  (JSON-RPC)     │◄────│   (ReAct)       │
└─────────────┘     └─────────────────┘     └────────┬────────┘
                                                     │
                                              ┌──────┴──────┐
                                              │    Tools    │
                                              ├─────────────┤
                                              │ get_exchange│
                                              │ _rate       │
                                              └─────────────┘
```

## Key Components

### 1. LangGraph ReAct Agent

```python
self.graph = create_react_agent(
    self.model,
    tools=self.tools,
    checkpointer=memory,
    prompt=self.SYSTEM_INSTRUCTION,
    response_format=(self.FORMAT_INSTRUCTION, ResponseFormat),
)
```

### 2. System Prompt

```python
SYSTEM_INSTRUCTION = (
    'You are a specialized assistant for currency conversions. '
    "Your sole purpose is to use the 'get_exchange_rate' tool to answer "
    "questions about currency exchange rates. "
    'If the user asks about anything other than currency conversion, '
    'politely state that you cannot help with that topic.'
)
```

### 3. Exchange Rate Tool

```python
@tool
def get_exchange_rate(
    currency_from: str = 'USD',
    currency_to: str = 'EUR',
    currency_date: str = 'latest',
):
    """Use this to get current exchange rate."""
    response = httpx.get(
        f'https://api.frankfurter.app/{currency_date}',
        params={'from': currency_from, 'to': currency_to},
    )
    return response.json()
```

### 4. Response Format (Structured Output)

```python
class ResponseFormat(BaseModel):
    status: Literal['input_required', 'completed', 'error'] = 'input_required'
    message: str
```

### 5. Multi-Turn State Handling

```python
async def stream(self, query, context_id) -> AsyncIterable[dict[str, Any]]:
    inputs = {'messages': [('user', query)]}
    config = {'configurable': {'thread_id': context_id}}
    
    for item in self.graph.stream(inputs, config, stream_mode='values'):
        message = item['messages'][-1]
        if isinstance(message, AIMessage) and message.tool_calls:
            yield {'content': 'Looking up the exchange rates...'}
        elif isinstance(message, ToolMessage):
            yield {'content': 'Processing the exchange rates..'}
    
    yield self.get_agent_response(config)
```

## A2A Protocol Flow

### Multi-Turn Example

**Request 1** (incomplete):
```json
{
  "method": "message/send",
  "params": {
    "message": {
      "parts": [{"text": "How much is the exchange rate for 1 USD?"}]
    }
  }
}
```

**Response 1** (input-required):
```json
{
  "result": {
    "status": {
      "state": "input-required",
      "message": {
        "parts": [{"text": "Please specify which currency you would like to convert to."}]
      }
    }
  }
}
```

**Request 2** (follow-up with context):
```json
{
  "method": "message/send",
  "params": {
    "message": {
      "contextId": "a7cc0bef-17b5-41fc-9379-40b99f46a101",
      "parts": [{"text": "CAD"}]
    }
  }
}
```

**Response 2** (completed):
```json
{
  "result": {
    "artifacts": [{
      "parts": [{"text": "The exchange rate for 1 USD to CAD is 1.3739."}]
    }],
    "status": { "state": "completed" }
  }
}
```

## Our TypeScript Implementation

### Key Differences

| Aspect | Python (LangGraph) | Our TypeScript (AI SDK) |
|--------|-------------------|-------------------------|
| Framework | LangGraph ReAct | AI SDK ToolLoopAgent |
| Memory | MemorySaver checkpointer | A2A task context |
| Structured Output | Pydantic ResponseFormat | Zod schema |
| Multi-turn | Thread ID based | Context ID based |

### Implementation

```typescript
export function createCurrencyAgent(model: LanguageModel) {
  return new ToolLoopAgent({
    model,
    instructions: getCurrencyPrompt(),
    tools: {
      get_exchange_rate: tool({
        description: "Get current exchange rate between currencies",
        parameters: z.object({
          from: z.string().describe("Source currency code"),
          to: z.string().describe("Target currency code"),
        }),
        execute: async ({ from, to }) => {
          const response = await fetch(
            `https://api.frankfurter.app/latest?from=${from}&to=${to}`
          );
          return response.json();
        },
      }),
    },
  });
}
```

## Checklist for Implementation

- [x] Agent Card with currency skill
- [x] Exchange rate tool (Frankfurter API)
- [x] Basic currency conversion
- [x] Streaming responses
- [x] Worker deployment
- [ ] Multi-turn with input-required state
- [ ] Conversation memory across turns

## Cloudflare Worker Considerations

- Frankfurter API is publicly accessible (no auth needed)
- No special Worker compatibility issues
- Consider caching exchange rates for performance

