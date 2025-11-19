# Agent2Agent (A2A) Samples - JavaScript

JavaScript/TypeScript implementations of [a2a-samples](https://github.com/a2aproject/a2a-samples) using **Vercel AI SDK** and **Hono**.

> **Note**: These examples use [@drew-foxall/a2a-js-sdk](https://github.com/drew-foxall/a2a-js-sdk), a fork of [a2a-js](https://github.com/a2aproject/a2a-js) with Hono adapter support.

## Repository Structure

This repository mirrors the structure of [a2a-samples](https://github.com/a2aproject/a2a-samples) but focuses on JavaScript/TypeScript examples:

```
a2a-js-sdk-examples/
├── samples/
│   └── js/              # JavaScript/TypeScript samples
│       └── src/
│           └── agents/  # Agent implementations
├── demo/                # Demo applications (coming soon)
├── extensions/          # VS Code extensions (coming soon)
└── notebooks/           # Jupyter notebooks (coming soon)
```

## 🏗️ Architecture

All agents use **AI SDK v6** with a **Unified Automatic Adapter** for clean separation of concerns:

### Layered Architecture
```
┌─────────────────────────────────────┐
│   AI Agent (agent.ts)               │  ← Protocol-agnostic
│   - ToolLoopAgent                   │     Portable to CLI, Tests,
│   - Pure AI logic                   │     REST, MCP, A2A
│   - No protocol knowledge           │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   A2AAdapter (shared/)              │  ← Unified automatic adapter
│   - Auto-detects mode               │     Single adapter for all cases
│   - Simple or Streaming             │     Config-driven behavior
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Server (index.ts)                 │  ← Hono + A2A routes
│   - Hono web server                 │
│   - A2A protocol routes             │
└─────────────────────────────────────┘
```

### Automatic Mode Detection

The `A2AAdapter` automatically detects execution mode from configuration:

```typescript
// Simple mode (auto-detected - no artifacts)
new A2AAdapter(agent, {
  workingMessage: "Processing...",
});

// Streaming mode (auto-detected - parseArtifacts triggers it)
new A2AAdapter(agent, {
  parseArtifacts: extractCodeBlocks,  // ← Triggers streaming automatically!
  workingMessage: "Generating...",
});
```

**Key Innovation:** Configuration determines behavior - no manual mode selection needed!

### Three Usage Patterns

1. **Simple Agent** (Content Editor)
   - Basic configuration only
   - Automatically uses `agent.generate()`
   - Text-only responses
   - **Example:** Content editing, Q&A, chat

2. **Advanced Agent** (Movie Agent)
   - Custom state parsing, response transformation
   - Conversation history management
   - Tool integration (TMDB API)
   - **Example:** Multi-turn conversations, stateful agents

3. **Streaming Agent** (Coder Agent)
   - `parseArtifacts` configured → streaming auto-enabled
   - Incremental artifact emission (code files)
   - Real-time progress updates
   - **Example:** Code generation, image creation, large outputs

### Code Metrics

**Before (Manual Selection):**
- 2 separate adapter classes (Simple + Streaming)
- 1,567 lines of adapter code
- ~900 lines of duplicated logic
- Manual mode selection required

**After (Unified Automatic):**
- 1 adapter class (`A2AAdapter`)
- 693 lines of adapter code
- 0 lines of duplication
- Automatic mode detection

**Result:** -55% code, -67% files, 100% automatic

### Benefits
- ✅ **Zero decision overhead** - Adapter auto-detects mode from config
- ✅ **Protocol-agnostic agents** - Work in CLI, tests, REST, MCP, A2A
- ✅ **Single adapter** - One class for all use cases (no confusion)
- ✅ **55% code reduction** - Eliminated duplicate adapters
- ✅ **Self-documenting** - Configuration shows what agent does
- ✅ **Impossible to misuse** - Config determines behavior
- ✅ **Single source of truth** - All logic in one place

### Documentation
- 📖 [**Unified Adapter Complete**](./UNIFIED_ADAPTER_COMPLETE.md) - Automatic adapter implementation
- 📖 [**Automatic Adapter Assessment**](./AUTOMATIC_ADAPTER_ASSESSMENT.md) - Why automatic detection
- 📖 [**Migration Complete**](./MIGRATION_COMPLETE.md) - Full migration summary
- 📖 [**Architecture Assessment**](./AI_SDK_AGENT_CLASS_ASSESSMENT.md) - Technical rationale

## 📦 Available Examples

| Example | Port | Original | Features |
|---------|------|----------|----------|
| [Movie Agent](./samples/js/src/agents/movie-agent/) | 41241 | [Link](https://github.com/a2aproject/a2a-samples/tree/main/samples/js/src/agents/movie-agent) | TMDB API, conversation history, multi-turn, tool calling |
| [Coder Agent](./samples/js/src/agents/coder/) | 41242 | [Link](https://github.com/a2aproject/a2a-samples/tree/main/samples/js/src/agents/coder) | Streaming, multi-file output, markdown parsing, artifacts |
| [Content Editor](./samples/js/src/agents/content-editor/) | 41243 | [Link](https://github.com/a2aproject/a2a-samples/tree/main/samples/js/src/agents/content-editor) | Proof-reading, grammar checking, style improvement |

## 🚀 Quick Start

### Prerequisites

1. **Node.js** >= 18.0.0
2. **pnpm** (recommended) or npm
3. **API Keys**:
   - One LLM provider (OpenAI, Anthropic, or Google)
   - TMDB API key (for Movie Agent only)

### Installation

```bash
# Clone the repository
git clone https://github.com/drew-foxall/a2a-js-sdk-examples.git
cd a2a-js-sdk-examples

# Install all dependencies
pnpm install
```

### Setup Environment Variables

```bash
# LLM Provider (pick one)
export OPENAI_API_KEY=your_key          # OpenAI (default)
export ANTHROPIC_API_KEY=your_key       # Anthropic (recommended for code/writing)
export GOOGLE_GENERATIVE_AI_API_KEY=your_key  # Google

# Optionally set provider (defaults to openai)
export AI_PROVIDER=openai  # or: anthropic, google

# For Movie Agent only
export TMDB_API_KEY=your_tmdb_key
```

### Run an Example

#### Start All Agents at Once

```bash
# Start all three agents simultaneously
./start-all-agents.sh

# Stop all agents
./stop-all-agents.sh
```

#### Start Individual Agents

```bash
# Movie Info Agent
pnpm agents:movie-agent

# Coder Agent
pnpm agents:coder

# Content Editor Agent
pnpm agents:content-editor
```

## 📖 Example Details

### 🎬 Movie Info Agent

**Features:**
- TMDB API integration for movies and people
- Conversation history management
- Multi-turn conversations
- Goal metadata support
- State parsing (COMPLETED/AWAITING_USER_INPUT)

**Quick Start:**
```bash
cd samples/js
export TMDB_API_KEY=your_key
export OPENAI_API_KEY=your_key
pnpm agents:movie-agent
```

[Full Documentation](./samples/js/src/agents/movie-agent/README.md)

### 💻 Coder Agent

**Features:**
- Streaming code generation
- Multi-file output support
- Markdown code block parsing
- Separate artifacts per file
- Preamble/postamble support

**Quick Start:**
```bash
cd samples/js
export ANTHROPIC_API_KEY=your_key
export AI_PROVIDER=anthropic
pnpm agents:coder
```

[Full Documentation](./samples/js/src/agents/coder/README.md)

### ✍️ Content Editor Agent

**Features:**
- Professional content editing
- Grammar and spelling corrections
- Style improvements
- Voice preservation

**Quick Start:**
```bash
cd samples/js
export OPENAI_API_KEY=your_key
pnpm agents:content-editor
```

[Full Documentation](./samples/js/src/agents/content-editor/README.md)

## 🆚 Why AI SDK over Genkit?

| Aspect | Genkit (Original) | AI SDK (These Examples) |
|--------|------------------|------------------------|
| **Provider Support** | Plugin-based | Native, unified API |
| **TypeScript** | Good | Excellent |
| **Bundle Size** | Larger | Smaller |
| **Edge Runtime** | Limited | Full support |
| **Streaming** | Custom | Built-in |
| **Tool Calling** | Custom format | Standardized |
| **Community** | Growing | Large |

## 📚 Documentation

Each example includes:
- Comprehensive README with usage instructions
- Feature comparison with original Genkit implementation
- Environment variable documentation
- Troubleshooting guide
- Code examples showing Genkit vs AI SDK patterns

## 🏗️ Architecture

All examples follow the same pattern:

```
example-name/
├── index.ts           # Main agent executor + server
├── prompt.ts          # System prompts
├── [utils].ts         # Agent-specific utilities
├── package.json       # Dependencies
└── README.md          # Full documentation
```

### Shared Utilities

Located in `shared/utils.ts`:
- `getModel()` - Provider-agnostic model selection
- Supports: OpenAI, Anthropic, Google
- Configured via `AI_PROVIDER` environment variable

## 🔧 Development

### Running Locally

Each example can be run independently:

```bash
cd movie-agent-ai-sdk
pnpm install
pnpm start
```

Or use the workspace commands from the root:

```bash
pnpm movie-agent
pnpm coder-agent
pnpm content-editor
```

### Using with Development Version of SDK

If you're developing the SDK locally:

```json
// In example's package.json
{
  "dependencies": {
    "@drew-foxall/a2a-js-sdk": "file:../../a2a-js-sdk"
  }
}
```

## 🧪 Testing

### Manual Testing

```bash
# Start an agent
pnpm movie-agent

# In another terminal, test with curl
curl http://localhost:41241/.well-known/agent-card.json
```

## 📝 Environment Variables

### Required for All Examples

| Variable | Description | Default |
|----------|-------------|---------|
| `AI_PROVIDER` | AI provider to use | `openai` |

**One of these (based on provider):**
- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic API key  
- `GOOGLE_GENERATIVE_AI_API_KEY` - Google AI API key

### Movie Agent Specific

| Variable | Description | Required |
|----------|-------------|----------|
| `TMDB_API_KEY` | TMDB API key from [themoviedb.org](https://developer.themoviedb.org/docs/getting-started) | ✅ Yes |

### Optional for All

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | Example-specific |

## 🔗 Resources

- **SDK Library**: [@drew-foxall/a2a-js-sdk](https://github.com/drew-foxall/a2a-js-sdk)
- **Original Samples**: [a2aproject/a2a-samples](https://github.com/a2aproject/a2a-samples)
- **Vercel AI SDK**: [sdk.vercel.ai](https://sdk.vercel.ai/docs)
- **Hono**: [hono.dev](https://hono.dev)
- **A2A Protocol**: [github.com/google-a2a/A2A](https://github.com/google-a2a/A2A)

## 🐛 Troubleshooting

### "No API key found"
- Make sure you've set the correct environment variable for your provider
- Check that `AI_PROVIDER` matches your API key

### "TMDB_API_KEY required" (Movie Agent)
- Get a free API key from [TMDB](https://developer.themoviedb.org/docs/getting-started)
- Export it: `export TMDB_API_KEY=your_key`

### Port already in use
```bash
# Find and kill the process
lsof -ti:41241 | xargs kill -9
```

### Module not found
```bash
# Reinstall dependencies
pnpm install
```

## 🤝 Contributing

Contributions are welcome! Please:

1. Check the [original implementation](https://github.com/a2aproject/a2a-samples) for reference
2. Maintain feature parity with originals
3. Add tests if adding new features
4. Update documentation

## 📄 License

Apache-2.0 (same as parent projects)

## 🙏 Acknowledgments

- Original [a2a-samples](https://github.com/a2aproject/a2a-samples) by the A2A project team
- [a2a-js](https://github.com/a2aproject/a2a-js) SDK
- [Vercel AI SDK](https://sdk.vercel.ai/) team
- [Hono](https://hono.dev) framework

---

**Made with 🤖 by Drew Foxall**

These ports are intended to match the original implementations while leveraging AI SDK's, provider-agnostic API.

