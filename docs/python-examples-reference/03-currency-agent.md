# Currency Agent Reference

> **Source**: `samples/python/agents/langgraph/`
> **Our Implementation**: `examples/agents/currency-agent/`

## Overview

A currency conversion agent using LangGraph's ReAct pattern. Demonstrates structured response formats and external API integration.

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Client    │────►│  A2A Protocol   │────►│  ReAct Agent    │
│             │◄────│  (JSON-RPC)     │◄────│  (LangGraph)    │
└─────────────┘     └─────────────────┘     └────────┬────────┘
                                                     │
                                              ┌──────┴──────┐
                                              │    Tool     │
                                              ├─────────────┤
                                              │get_exchange │
                                              │   _rate     │
                                              └──────┬──────┘
                                                     │
                                              ┌──────▼──────┐
                                              │ Frankfurter │
                                              │    API      │
                                              └─────────────┘
```

## Agent Card

```json
{
  "name": "Currency Agent",
  "description": "A specialized assistant for currency conversions",
  "version": "1.0.0",
  "default_input_modes": ["text"],
  "default_output_modes": ["text"],
  "capabilities": {
    "streaming": true
  },
  "skills": [
    {
      "id": "currency_conversion",
      "name": "Currency Conversion",
      "description": "Convert between currencies using real-time exchange rates",
      "tags": ["currency", "conversion", "exchange"],
      "examples": [
        "Convert 100 USD to EUR",
        "What is the exchange rate from GBP to JPY?"
      ]
    }
  ]
}
```

## System Prompt

```
You are a specialized assistant for currency conversions.
Your sole purpose is to use the 'get_exchange_rate' tool to answer questions about currency exchange rates.
If the user asks about anything other than currency conversion or exchange rates,
politely state that you cannot help with that topic and can only assist with currency-related queries.
Do not attempt to answer unrelated questions or use tools for other purposes.
```

## Structured Response Format

```python
class ResponseFormat(BaseModel):
    """Respond to the user in this format."""
    status: Literal['input_required', 'completed', 'error'] = 'input_required'
    message: str
```

**Format Instruction**:
```
Set response status to input_required if the user needs to provide more information to complete the request.
Set response status to error if there is an error while processing the request.
Set response status to completed if the request is complete.
```

## Tool

### get_exchange_rate

```python
@tool
def get_exchange_rate(
    currency_from: str = 'USD',
    currency_to: str = 'EUR',
    currency_date: str = 'latest',
):
    """Use this to get current exchange rate.

    Args:
        currency_from: The currency to convert from (e.g., "USD").
        currency_to: The currency to convert to (e.g., "EUR").
        currency_date: The date for the exchange rate or "latest". Defaults to "latest".

    Returns:
        A dictionary containing the exchange rate data, or an error message if the request fails.
    """
    try:
        response = httpx.get(
            f'https://api.frankfurter.app/{currency_date}',
            params={'from': currency_from, 'to': currency_to},
        )
        response.raise_for_status()

        data = response.json()
        if 'rates' not in data:
            return {'error': 'Invalid API response format.'}
        return data
    except httpx.HTTPError as e:
        return {'error': f'API request failed: {e}'}
    except ValueError:
        return {'error': 'Invalid JSON response from API.'}
```

**API Response Example**:
```json
{
  "amount": 1.0,
  "base": "USD",
  "date": "2024-01-15",
  "rates": {
    "EUR": 0.91234
  }
}
```

## Key Components

### 1. Agent Creation (LangGraph)

```python
class CurrencyAgent:
    SYSTEM_INSTRUCTION = """..."""  # System prompt above
    FORMAT_INSTRUCTION = """..."""  # Format instruction above

    def __init__(self):
        model_source = os.getenv('model_source', 'google')
        if model_source == 'google':
            self.model = ChatGoogleGenerativeAI(model='gemini-2.0-flash')
        else:
            self.model = ChatOpenAI(...)
            
        self.tools = [get_exchange_rate]

        self.graph = create_react_agent(
            self.model,
            tools=self.tools,
            checkpointer=memory,
            prompt=self.SYSTEM_INSTRUCTION,
            response_format=(self.FORMAT_INSTRUCTION, ResponseFormat),
        )
```

### 2. Streaming with Intermediate Updates

```python
async def stream(self, query, context_id) -> AsyncIterable[dict[str, Any]]:
    inputs = {'messages': [('user', query)]}
    config = {'configurable': {'thread_id': context_id}}

    for item in self.graph.stream(inputs, config, stream_mode='values'):
        message = item['messages'][-1]
        
        if isinstance(message, AIMessage) and message.tool_calls:
            # LLM is about to call a tool
            yield {
                'is_task_complete': False,
                'require_user_input': False,
                'content': 'Looking up the exchange rates...',
            }
        elif isinstance(message, ToolMessage):
            # Tool has returned
            yield {
                'is_task_complete': False,
                'require_user_input': False,
                'content': 'Processing the exchange rates..',
            }

    # Final response from structured output
    yield self.get_agent_response(config)
```

### 3. Structured Response Extraction

```python
def get_agent_response(self, config):
    current_state = self.graph.get_state(config)
    structured_response = current_state.values.get('structured_response')
    
    if structured_response and isinstance(structured_response, ResponseFormat):
        if structured_response.status == 'input_required':
            return {
                'is_task_complete': False,
                'require_user_input': True,
                'content': structured_response.message,
            }
        if structured_response.status == 'error':
            return {
                'is_task_complete': False,
                'require_user_input': True,
                'content': structured_response.message,
            }
        if structured_response.status == 'completed':
            return {
                'is_task_complete': True,
                'require_user_input': False,
                'content': structured_response.message,
            }

    # Fallback
    return {
        'is_task_complete': False,
        'require_user_input': True,
        'content': 'We are unable to process your request. Please try again.',
    }
```

## A2A Protocol Flow

### Request
```json
{
  "jsonrpc": "2.0",
  "method": "message/send",
  "id": "1",
  "params": {
    "message": {
      "role": "user",
      "messageId": "msg-1",
      "parts": [{"type": "text", "text": "Convert 100 USD to EUR"}]
    }
  }
}
```

### Streaming Events

1. **Working - Tool Call**
```json
{
  "status": {
    "state": "working",
    "message": {
      "parts": [{"type": "text", "text": "Looking up the exchange rates..."}]
    }
  }
}
```

2. **Working - Processing**
```json
{
  "status": {
    "state": "working",
    "message": {
      "parts": [{"type": "text", "text": "Processing the exchange rates.."}]
    }
  }
}
```

3. **Completed**
```json
{
  "status": {
    "state": "completed",
    "message": {
      "parts": [{"type": "text", "text": "100 USD is approximately 91.23 EUR (rate: 0.9123)"}]
    }
  }
}
```

## Our TypeScript Implementation

### Agent (`examples/agents/currency-agent/agent.ts`)

```typescript
import { ToolLoopAgent, tool } from "ai";
import { z } from "zod";

export function createCurrencyAgent(model: LanguageModel) {
  return new ToolLoopAgent({
    model,
    instructions: getCurrencyAgentPrompt(),
    tools: {
      get_exchange_rate: tool({
        description: "Get current exchange rate between currencies",
        parameters: z.object({
          currency_from: z.string().default("USD").describe("Source currency code"),
          currency_to: z.string().default("EUR").describe("Target currency code"),
          currency_date: z.string().default("latest").describe("Date or 'latest'"),
        }),
        execute: async ({ currency_from, currency_to, currency_date }) => {
          const response = await fetch(
            `https://api.frankfurter.app/${currency_date}?from=${currency_from}&to=${currency_to}`
          );
          const data = await response.json();
          return data;
        },
      }),
    },
  });
}
```

### Key Differences

| Aspect | Python (LangGraph) | Our TypeScript (AI SDK) |
|--------|-------------------|-------------------------|
| Framework | `create_react_agent` | `ToolLoopAgent` |
| Response Format | Pydantic `ResponseFormat` | A2A task states |
| Memory | `MemorySaver` checkpointer | A2A task store |
| Status Mapping | `input_required/completed/error` | Task state machine |

## Frankfurter API Reference

**Base URL**: `https://api.frankfurter.app`

**Endpoints**:
- `/latest` - Latest rates
- `/2024-01-15` - Historical rates for specific date
- `/2024-01-01..2024-01-31` - Time series

**Parameters**:
- `from` - Base currency (default: EUR)
- `to` - Target currency (comma-separated for multiple)
- `amount` - Amount to convert

**Example**:
```bash
curl "https://api.frankfurter.app/latest?from=USD&to=EUR,GBP"
```

```json
{
  "amount": 1.0,
  "base": "USD",
  "date": "2024-01-15",
  "rates": {
    "EUR": 0.91234,
    "GBP": 0.78901
  }
}
```

## Testing

```bash
# Test currency conversion
curl -X POST http://localhost:3002/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "id": "test",
    "params": {
      "message": {
        "role": "user",
        "messageId": "msg-1",
        "parts": [{"kind": "text", "text": "What is 500 GBP in Japanese Yen?"}]
      }
    }
  }'
```

## Checklist for Implementation

- [x] Agent Card with currency skill
- [x] System prompt (currency-focused)
- [x] `get_exchange_rate` tool
- [x] Frankfurter API integration
- [x] Streaming responses
- [x] Error handling for API failures
- [x] Worker deployment (`workers/currency-agent/`)
- [ ] Structured response format (`input_required`, `completed`, `error`)
- [ ] Historical rate lookups
- [ ] Multi-currency conversion

