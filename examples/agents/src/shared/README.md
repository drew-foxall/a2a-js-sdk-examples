# Shared Utilities

Common utilities for A2A agents using AI SDK.

## A2AAdapter

Bridge between AI SDK `ToolLoopAgent` and the A2A Protocol.

### Overview

The `A2AAdapter` enables you to define agents using AI SDK's `ToolLoopAgent` and expose them via the A2A protocol. This provides:

- ✅ **Protocol-agnostic agents**: Same agent, multiple protocols (A2A, MCP, REST, CLI)
- ✅ **Separation of concerns**: Agent logic separate from protocol integration
- ✅ **Reusability**: Use agents across projects, tests, and contexts
- ✅ **AI SDK features**: Leverage Call Options, prepareCall, stopWhen, etc.

### Architecture

```text
ToolLoopAgent (AI SDK)  →  A2AAdapter  →  A2A Server (Hono / Workers / Edge)
   [Agent Logic]           [Protocol Bridge]     [HTTP Transport]
```

### Basic Usage

```typescript
import { ToolLoopAgent } from "ai";
import { A2AAdapter } from "@drew-foxall/a2a-ai-sdk-adapter";
import { DefaultRequestHandler } from '@drew-foxall/a2a-js-sdk/server';

// 1. Define your agent (protocol-agnostic)
const myAgent = new ToolLoopAgent({
  model: 'openai/gpt-4o',
  instructions: 'You are a helpful assistant',
  tools: {
    // your tools here
  },
});

// 2. Wrap it with A2A adapter
const executor = new A2AAdapter(myAgent, { mode: "stream" });

// 3. Expose via A2A server
const requestHandler = new DefaultRequestHandler(
  agentCard,
  taskStore,
  executor
);
```

### Advanced Usage

#### Custom Task State Parsing (multi-turn)

Some agents may output special state indicators:

```typescript
const executor = new A2AAdapter(myAgent, {
  mode: "generate",
  parseTaskState: (text) => {
    const lastLine = text.trim().split('\n').at(-1)?.toUpperCase();
    if (lastLine === 'AWAITING_USER_INPUT') return 'input-required';
    if (lastLine === 'COMPLETED') return 'completed';
    return 'completed';
  },
  transformResponse: (result) => {
    // Remove state indicator from final message
    const lines = result.text.split('\n');
    return lines.slice(0, -1).join('\n');
  },
});
```

#### Include Conversation History

```typescript
const executor = new A2AAdapter(myAgent, {
  mode: "stream",
  includeHistory: true, // Pass previous messages to agent
  debug: true,
});
```

#### Agent-owned response routing (Message vs Task)

Per A2A, the server may respond with either a stateless `Message` or a stateful `Task`.
Use `selectResponseType` as an **agent-owned routing step** (AI SDK “Routing” pattern):

```typescript
import { createLLMResponseTypeRouter } from "@drew-foxall/a2a-ai-sdk-adapter";

const executor = new A2AAdapter(myAgent, {
  mode: "stream", // default execution mode for Task responses
  selectResponseType: createLLMResponseTypeRouter({
    model: routingModel, // choose a small/cheap model
  }),
});
```

### Reusing the Same Agent

Once defined, use your agent in multiple contexts:

```typescript
// Via A2A protocol
const a2aExecutor = new A2AAdapter(myAgent, { mode: "stream" });

// Via REST API
app.post('/api/chat', async (req, res) => {
  const result = await myAgent.generate({ prompt: req.body.message });
  res.json({ response: result.text });
});

// Via CLI
const result = await myAgent.generate({ prompt: process.argv[2] });
console.log(result.text);

// In tests
describe('myAgent', () => {
  it('should respond correctly', async () => {
    const result = await myAgent.generate({ prompt: 'Hello' });
    expect(result.text).toContain('Hi');
  });
});
```

### Configuration Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `parseTaskState` | `(text: string) => TaskState` | Parse custom task states from response | Returns `"completed"` |
| `transformResponse` | `(result: any) => string` | Transform agent response before A2A message | Returns `result.text` |
| `includeHistory` | `boolean` | Include conversation history in agent calls | `false` |
| `workingMessage` | `string` | Message to show while processing | `"Processing your request..."` |
| `debug` | `boolean` | Log debug information | `true` |

### Examples

See the migrated agents for complete examples:

- **Content Editor Agent**: Simple agent with no tools
- **Movie Agent**: Agent with tools and Call Options
- **Coder Agent**: Complex streaming agent (may use different approach)

### Migration Guide

#### Before (Tightly Coupled)

```typescript
class MyAgentExecutor implements AgentExecutor {
  async execute(requestContext, eventBus) {
    // 200+ lines of mixed concerns:
    // - A2A task management
    // - AI generation
    // - Event publishing
    // - State parsing
  }
}
```

#### After (Separated)

```typescript
// Define agent (50 lines, portable)
export const myAgent = new ToolLoopAgent({
  model: 'openai/gpt-4o',
  instructions: 'You are helpful',
  // ... agent logic
});

// Use with A2A (1 line!)
const executor = new A2AAdapter(myAgent, { mode: "stream" });
```

### Benefits

1. **Testability**: Test agent logic without A2A infrastructure
2. **Portability**: Same agent works with A2A, MCP, REST, CLI
3. **Maintainability**: Update agent or protocol independently
4. **AI SDK Features**: Leverage Call Options, prepareCall, stopWhen
5. **Code Reduction**: ~80% less boilerplate in agent files

### See Also

- [AI SDK v6 Agents Documentation](https://v6.ai-sdk.dev/docs/agents/overview)
- [AI SDK Call Options](https://v6.ai-sdk.dev/docs/agents/configuring-call-options)
- [A2A Protocol Specification](https://github.com/a2aproject)
- [Architecture Assessment](../../../AI_SDK_AGENT_CLASS_ASSESSMENT.md)

---

## Other Utilities

### `getModel()`

Returns the configured AI SDK model based on environment variables:

```typescript
import { getModel } from './shared/utils.js';

const model = getModel(); // Returns openai, anthropic, or google model
```

Set environment variables:

- `AI_PROVIDER`: `openai`, `anthropic`, or `google` (default: `openai`)
- `OPENAI_API_KEY`: For OpenAI
- `ANTHROPIC_API_KEY`: For Anthropic
- `GOOGLE_GENERATIVE_AI_API_KEY`: For Google
