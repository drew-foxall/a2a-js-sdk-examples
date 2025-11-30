# BeeAI Chat Agent Reference

> **Source**: `samples/python/agents/beeai-chat/`
> **Our Implementation**: `examples/agents/local-llm-chat/` + `examples/workers/local-llm-chat/` ✅

## Overview

A chat agent built with the BeeAI Framework that runs on local LLMs via Ollama. Includes web search and weather tools, demonstrating A2A with self-hosted models.

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Client    │────►│  A2A Protocol   │────►│  BeeAI Agent    │
│             │◄────│  (JSON-RPC)     │◄────│  (Local LLM)    │
└─────────────┘     └─────────────────┘     └────────┬────────┘
                                                     │
                                         ┌───────────┼───────────┐
                                         │           │           │
                                    ┌────▼────┐ ┌────▼────┐ ┌────▼────┐
                                    │ Ollama  │ │  Web    │ │ Weather │
                                    │ (LLM)   │ │ Search  │ │  Tool   │
                                    └─────────┘ └─────────┘ └─────────┘
```

## Key Components

### 1. Local LLM via Ollama

```bash
# Pull the model
ollama pull granite3.3:8b
```

```python
# BeeAI with Ollama backend
agent = BeeAgent(
    model="ollama/granite3.3:8b",
    tools=[web_search, weather],
)
```

### 2. Built-in Tools

- **Web Search**: Search the internet for information
- **Weather**: Get current weather conditions

### 3. A2A Server

```python
# Expose BeeAI agent via A2A
from a2a import A2AServer

server = A2AServer(agent)
server.run(host="0.0.0.0", port=9999)
```

## Key Features

1. **Local LLM**: No cloud API required
2. **Self-Hosted**: Full control over model and data
3. **Tool Support**: Extensible with custom tools
4. **A2A Compatible**: Standard protocol interface

## Use Cases

- Privacy-sensitive applications
- Offline/air-gapped environments
- Cost optimization (no API fees)
- Custom model fine-tuning

## TypeScript Implementation Considerations

### Using Ollama with AI SDK

```typescript
import { ollama } from 'ollama-ai-provider';

const model = ollama('granite3.3:8b');

const agent = new ToolLoopAgent({
  model,
  instructions: "You are a helpful assistant with web search and weather tools.",
  tools: {
    web_search: tool({
      description: "Search the web",
      parameters: z.object({
        query: z.string(),
      }),
      execute: async ({ query }) => {
        // Use search API
        const results = await searchWeb(query);
        return results;
      },
    }),
    get_weather: tool({
      description: "Get current weather",
      parameters: z.object({
        location: z.string(),
      }),
      execute: async ({ location }) => {
        // Use weather API
        return await getWeather(location);
      },
    }),
  },
});
```

### Challenges for Workers

1. **No Local LLM**: Workers can't run Ollama
2. **External Ollama**: Would need network access to Ollama server
3. **Latency**: Network calls to local LLM add latency

### Alternative: Cloudflare Workers AI

```typescript
import { CloudflareWorkersAI } from '@cloudflare/ai';

// Use Cloudflare's hosted models instead
const model = new CloudflareWorkersAI({
  model: '@cf/meta/llama-3-8b-instruct',
});
```

## Docker Deployment

```bash
# Build
docker build -t beeai_chat_agent .

# Run (connecting to host's Ollama)
docker run -p 9999:9999 \
  -e OLLAMA_API_BASE="http://host.docker.internal:11434" \
  beeai_chat_agent
```

## Checklist for Implementation

- [x] Local LLM support (via Ollama provider)
- [x] Web search tool
- [x] Weather tool (Open-Meteo API)
- [x] A2A server (`agents/local-llm-chat/`)
- [x] Workers deployment (`workers/local-llm-chat/`)
- [ ] Docker deployment (optional)
- [ ] Cloudflare Workers AI integration (optional)

## Notes

This example highlights the flexibility of A2A:
- Same protocol works with cloud or local LLMs
- Agents can be deployed anywhere
- Tools are independent of model provider

For our implementation:
- **Local development**: Use Ollama provider
- **Workers deployment**: Use Cloudflare Workers AI or OpenAI
- **Self-hosted**: Docker with Ollama

