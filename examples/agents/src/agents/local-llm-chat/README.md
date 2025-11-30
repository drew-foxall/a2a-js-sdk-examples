# Local LLM Chat Agent

A chat agent designed to work with local LLMs (via Ollama) or cloud models. Demonstrates that A2A works with any LLM backend.

## Overview

This agent demonstrates:

- **Provider Agnostic**: Works with Ollama, OpenAI, Anthropic, etc.
- **Tool Integration**: Web search and weather tools
- **Self-Hosted Option**: Run entirely locally with Ollama
- **A2A Compatibility**: Same protocol regardless of LLM backend

## Features

### Tools

1. **Web Search**: Search the internet for information
2. **Weather**: Get current weather using Open-Meteo API (free, no key required)

### LLM Providers

The agent works with any AI SDK compatible provider:

- **OpenAI**: Default, requires `OPENAI_API_KEY`
- **Ollama**: Local, requires Ollama running
- **Anthropic**: Requires `ANTHROPIC_API_KEY`
- **Google**: Requires `GOOGLE_API_KEY`

## Usage

### With OpenAI (default)

```bash
export OPENAI_API_KEY=your-key
pnpm run dev:local-llm-chat
```

### With Ollama (local)

```bash
# First, ensure Ollama is running with a model
ollama pull llama3
ollama serve

# Then start the agent
AI_PROVIDER=ollama AI_MODEL=llama3 pnpm run dev:local-llm-chat
```

### Example Requests

```bash
# Weather query
curl -X POST http://localhost:4012/message/send \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "message/send",
    "params": {
      "message": {
        "role": "user",
        "parts": [{"type": "text", "text": "What is the weather in London?"}]
      }
    }
  }'

# General chat
curl -X POST http://localhost:4012/message/send \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "message/send",
    "params": {
      "message": {
        "role": "user",
        "parts": [{"type": "text", "text": "Tell me about yourself"}]
      }
    }
  }'
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     Client      │────►│  A2A Protocol   │────►│  Chat Agent     │
│                 │◄────│  (JSON-RPC)     │◄────│  (Any LLM)      │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                         ┌───────────────┼───────────────┐
                                         │               │               │
                                    ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
                                    │ LLM     │    │  Web    │    │ Weather │
                                    │ Provider│    │ Search  │    │  Tool   │
                                    └─────────┘    └─────────┘    └─────────┘
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AI_PROVIDER` | LLM provider | `openai` |
| `AI_MODEL` | Model name | `gpt-4o-mini` |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `OLLAMA_BASE_URL` | Ollama server URL | `http://localhost:11434` |

## Comparison to Python Example

The Python BeeAI Chat example uses:
- BeeAI Framework
- Ollama for local LLM
- Built-in web search and weather tools

Our implementation:
- AI SDK (provider agnostic)
- Any LLM provider (Ollama, OpenAI, etc.)
- Same tools (web search, weather)
- Same A2A interface

## Worker Deployment

The worker version (`workers/local-llm-chat/`) uses:
- OpenAI by default (Cloudflare Workers can't run Ollama)
- Could use Cloudflare Workers AI for edge inference

See `examples/workers/local-llm-chat/` for details.

## Extending

### Add a New Tool

```typescript
// In agent.ts
const newToolSchema = z.object({
  param: z.string().describe("Parameter description"),
});

// Add to tools object
new_tool: {
  description: "Tool description",
  inputSchema: newToolSchema,
  execute: async (params) => {
    // Implementation
    return { success: true, result: "..." };
  },
},
```

### Use Different Provider

```typescript
// In utils.ts or directly
import { ollama } from 'ollama-ai-provider';

const model = ollama('llama3');
const agent = createLocalLLMChatAgent(model);
```

