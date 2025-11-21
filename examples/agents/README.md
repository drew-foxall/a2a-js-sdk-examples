# JavaScript/TypeScript A2A Samples

This directory contains JavaScript/TypeScript examples using the A2A protocol with [Vercel AI SDK](https://sdk.vercel.ai) + [Hono](https://hono.dev).

## Available Agents

All agents are in `src/agents/`:

- **[movie-agent](./src/agents/movie-agent/)** - TMDB API integration with conversation history
- **[coder](./src/agents/coder/)** - Streaming code generation with multi-file support
- **[content-editor](./src/agents/content-editor/)** - Professional content editing and proof-reading

## Prerequisites

- Node.js >= 18.0.0
- pnpm (recommended) or npm
- API keys:
  - One LLM provider (OpenAI, Anthropic, or Google)
  - TMDB API key (for movie agent only)

## Setup

```bash
# Install dependencies
pnpm install

# Set environment variables
export OPENAI_API_KEY=your_key
export TMDB_API_KEY=your_tmdb_key  # For movie agent
export AI_PROVIDER=openai  # or: anthropic, google
```

## Running Agents

```bash
# From this directory (examples/agents)
pnpm agents:movie-agent       # Port 41241
pnpm agents:coder             # Port 41242
pnpm agents:content-editor    # Port 41243
```

Or from the repository root:

```bash
pnpm agents:movie-agent
pnpm agents:coder
pnpm agents:content-editor
```

## Architecture

These examples demonstrate high-fidelity ports of the original Genkit-based samples, achieving 100% feature parity while using the AI SDK's provider-agnostic API.

### Key Features

- **Provider Agnostic**: Works with OpenAI, Anthropic, or Google AI
- **Streaming**: Native streaming support with AI SDK
- **TypeScript**: Full type safety
- **Modern Stack**: AI SDK + Hono (lightweight, fast)

## Resources

- [AI SDK Documentation](https://sdk.vercel.ai/docs)
- [Hono Documentation](https://hono.dev)
- [A2A Protocol](https://github.com/a2aproject/A2A)
- [Original Genkit Samples](https://github.com/a2aproject/a2a-samples)

## License

Apache-2.0

