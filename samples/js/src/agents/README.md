# A2A Agent Examples

This directory contains example agents implementing the A2A protocol using AI SDK + Hono.

## Available Agents

### 🎬 Movie Agent

**Port**: 41241  
**Features**: TMDB API integration, conversation history, multi-turn conversations

[View Documentation](./movie-agent/README.md)

### 💻 Coder Agent

**Port**: 41242  
**Features**: Streaming code generation, multi-file output, artifacts

[View Documentation](./coder/README.md)

### ✍️ Content Editor Agent

**Port**: 41243  
**Features**: Professional editing, grammar checking, style improvements

[View Documentation](./content-editor/README.md)

## Running an Agent

From the `samples/js` directory:

```bash
pnpm agents:movie-agent
pnpm agents:coder
pnpm agents:content-editor
```

## Testing Agents

Once an agent is running, test it using curl:

```bash
# Check agent card
curl http://localhost:41241/.well-known/agent-card.json

# Test with A2A Inspector or client
```

## Development

Each agent demonstrates different A2A patterns:

- **State Management**: Task stores and history tracking
- **Streaming**: Real-time response streaming
- **Tool Calling**: External API integration
- **Artifacts**: File generation and delivery

All agents use shared utilities in `../shared/utils.ts` for model selection.

## More Information

- See individual agent READMEs for detailed documentation
- Check [parent README](../../README.md) for setup instructions
