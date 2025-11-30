# Semantic Kernel Travel Agent Reference

> **Source**: `samples/python/agents/semantickernel/`
> **Our Implementation**: Not started

## Overview

A multi-agent travel system built with Microsoft's Semantic Kernel framework. Features a TravelManagerAgent that delegates to CurrencyExchangeAgent and ActivityPlannerAgent plugins.

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────────┐
│   Client    │────►│  A2A Protocol   │────►│  TravelManagerAgent │
│             │◄────│  (JSON-RPC)     │◄────│     (SK Agent)      │
└─────────────┘     └─────────────────┘     └──────────┬──────────┘
                                                       │
                                         ┌─────────────┼─────────────┐
                                         │             │             │
                                    ┌────▼────┐  ┌─────▼─────┐  ┌────▼────┐
                                    │Currency │  │ Activity  │  │Frankfur-│
                                    │Exchange │  │ Planner   │  │ter API  │
                                    │ Agent   │  │  Agent    │  │         │
                                    └─────────┘  └───────────┘  └─────────┘
```

## Key Components

### 1. Agent Hierarchy

```python
# Currency Exchange Agent (Plugin)
currency_exchange_agent = ChatCompletionAgent(
    service=chat_service,
    name='CurrencyExchangeAgent',
    instructions='You specialize in handling currency-related requests...',
    plugins=[CurrencyPlugin()],
)

# Activity Planner Agent (Plugin)
activity_planner_agent = ChatCompletionAgent(
    service=chat_service,
    name='ActivityPlannerAgent',
    instructions='You specialize in planning and recommending activities...',
)

# Main Travel Manager Agent
self.agent = ChatCompletionAgent(
    service=chat_service,
    name='TravelManagerAgent',
    instructions='Analyze traveler requests and forward to appropriate agent...',
    plugins=[currency_exchange_agent, activity_planner_agent],
    arguments=KernelArguments(
        settings=OpenAIChatPromptExecutionSettings(
            response_format=ResponseFormat,
        )
    ),
)
```

### 2. Currency Plugin (Tool)

```python
class CurrencyPlugin:
    @kernel_function(description='Retrieves exchange rate...')
    def get_exchange_rate(
        self,
        currency_from: Annotated[str, 'Currency code to convert from'],
        currency_to: Annotated[str, 'Currency code to convert to'],
        date: Annotated[str, "Date or 'latest'"] = 'latest',
    ) -> str:
        response = httpx.get(
            f'https://api.frankfurter.app/{date}',
            params={'from': currency_from, 'to': currency_to},
        )
        rate = response.json()['rates'][currency_to]
        return f'1 {currency_from} = {rate} {currency_to}'
```

### 3. Response Format

```python
class ResponseFormat(BaseModel):
    status: Literal['input_required', 'completed', 'error'] = 'input_required'
    message: str
```

### 4. Streaming with Intermediate Messages

```python
async def stream(self, user_input: str, session_id: str):
    async for chunk in self.agent.invoke_stream(
        messages=user_input,
        thread=self.thread,
        on_intermediate_message=_handle_intermediate_message,
    ):
        if plugin_event.is_set():
            yield {'content': 'Processing function calls...'}
        if text_notice_seen:
            yield {'content': 'Building the output...'}
    
    yield self._get_agent_response(sum(chunks))
```

## Key Features

1. **Agent-as-Plugin**: Sub-agents are used as plugins by the manager
2. **Structured Output**: Enforced response format via Pydantic
3. **Streaming with Events**: Intermediate function call notifications
4. **Session Memory**: ChatHistoryAgentThread for conversation context

## Comparison with Our Approach

| Aspect | Semantic Kernel | Our AI SDK Approach |
|--------|-----------------|---------------------|
| Sub-agents | Plugins within main agent | Separate A2A agents |
| Communication | Internal function calls | A2A protocol (HTTP/bindings) |
| Deployment | Single process | Distributed workers |
| Extensibility | Add plugins | Add A2A agents |

## TypeScript Implementation Considerations

Semantic Kernel has a JavaScript/TypeScript version, but our AI SDK approach offers:

1. **True distribution**: Agents can run anywhere
2. **Protocol compliance**: Full A2A interoperability
3. **Cloud-native**: Cloudflare Workers deployment
4. **Framework agnostic**: Any A2A client can use our agents

### Equivalent Pattern with AI SDK

```typescript
// Our approach uses A2A for sub-agent communication
const travelPlannerAgent = new ToolLoopAgent({
  model,
  instructions: TRAVEL_MANAGER_PROMPT,
  tools: {
    sendMessage: {
      description: "Send a task to a specialist agent",
      parameters: z.object({
        agentName: z.string(),
        task: z.string(),
      }),
      execute: async ({ agentName, task }) => {
        // Route to A2A agent via HTTP or Service Binding
        return await callA2AAgent(agentName, task);
      },
    },
  },
});
```

## Checklist for Implementation

- [x] Multi-agent orchestration (via our travel planner)
- [x] Currency exchange tool (via currency agent)
- [x] Activity planning (via LLM prompting)
- [x] Streaming responses
- [x] Worker deployment
- [ ] Exact Semantic Kernel parity (not needed - different approach)

## Notes

Our implementation achieves similar goals through:
- **A2A protocol** instead of internal plugins
- **Distributed agents** instead of single-process
- **Service Bindings** for efficient worker-to-worker communication

This provides better scalability and true multi-agent interoperability.

