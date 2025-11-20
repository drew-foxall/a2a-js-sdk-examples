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

## 📋 Creating a New Agent?

**⚠️ Read this first:** [A2A Integration Pattern Guide](./A2A_INTEGRATION_PATTERN.md)

This guide shows the **correct** way to integrate AI SDK agents with the A2A protocol:
- ✅ Proper import paths (common pitfall!)
- ✅ Correct API usage patterns
- ✅ Complete working example
- ✅ Troubleshooting guide for common errors

**Reference Implementation:** [`samples/js/src/agents/hello-world/index.ts`](./samples/js/src/agents/hello-world/index.ts) - fully annotated example following the correct pattern.

## 🔍 Comparing with Python Examples

**New to multi-agent systems?** See [Python vs JavaScript Multi-Agent Comparison](./PYTHON_VS_JS_MULTIAGENT_COMPARISON.md)

This document compares our JavaScript `travel-planner-multiagent` with the original Python `airbnb_planner_multiagent`, including:
- Architecture similarities and differences
- **Real APIs vs Mock Data** (important!)
- Implementation trade-offs
- Production considerations

**TL;DR:** Our weather agent uses real global data (Open-Meteo API), but the Airbnb agent uses mock data for demonstration. See the comparison doc for upgrade paths to production.

### Python ↔ JavaScript Agent Mapping

For developers familiar with the [Python examples](https://github.com/a2aproject/a2a-samples/tree/main/samples/python):

| Python Agent | JavaScript Agent | Port | Status |
|-------------|------------------|------|--------|
| `helloworld` | `hello-world` | 41244 | ✅ |
| `dice_agent_rest` | `dice-agent` | 41249 | ✅ |
| `github-agent` | `github-agent` | 41240 | ✅ |
| `analytics` | `analytics-agent` | 41247 | ✅ |
| `langgraph` | `currency-agent` | 41248 | ✅ |
| `airbnb_planner_multiagent` | `travel-planner-multiagent` | 41245-41247 | ✅ |

**JavaScript-Only Agents** (no Python equivalent):
- `movie-agent` (41241) - TMDB API integration
- `coder` (41242) - Streaming code generation
- `content-editor` (41243) - Text editing

See [AGENT_NAMING_ALIGNMENT.md](./AGENT_NAMING_ALIGNMENT.md) for detailed naming decisions and cross-reference information.

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
| [Hello World](./samples/js/src/agents/hello-world/) | 41244 | [Link](https://github.com/a2aproject/a2a-samples/tree/main/samples/python/agents/helloworld) | Simplest agent, greeting responses, foundation pattern |
| [Dice Agent](./samples/js/src/agents/dice-agent/) | 41245 | [Link](https://github.com/a2aproject/a2a-samples/tree/main/samples/python/agents/dice_agent_rest) | Tool usage, roll dice, check primes, pure computational tools |
| [GitHub Agent](./samples/js/src/agents/github-agent/) | 41246 | [Link](https://github.com/a2aproject/a2a-samples/tree/main/samples/python/agents/github-agent) | GitHub API, Octokit integration, repo queries, commit history |
| [Analytics Agent](./samples/js/src/agents/analytics-agent/) | 41247 | [Link](https://github.com/a2aproject/a2a-samples/tree/main/samples/python/agents/analytics) | Chart generation, Chart.js + canvas, PNG artifacts, streaming |
| [Currency Agent](./samples/js/src/agents/currency-agent/) | 41248 | [Link](https://github.com/a2aproject/a2a-samples/tree/main/samples/python/agents/langgraph) | Multi-turn conversation, currency conversion, Frankfurter API, memory |
| [**Travel Planner** 🆕](./samples/js/src/agents/travel-planner-multiagent/) | 41250-41252 | [Link](https://github.com/a2aproject/a2a-samples/tree/main/samples/python/agents/airbnb_planner_multiagent) | **Multi-agent orchestration**, a2a-ai-provider, specialist delegation, 3 agents |
| [Movie Agent](./samples/js/src/agents/movie-agent/) | 41241 | [Link](https://github.com/a2aproject/a2a-samples/tree/main/samples/js/src/agents/movie-agent) | TMDB API, conversation history, multi-turn, tool calling |
| [Coder Agent](./samples/js/src/agents/coder/) | 41242 | [Link](https://github.com/a2aproject/a2a-samples/tree/main/samples/js/src/agents/coder) | Streaming, multi-file output, markdown parsing, artifacts |
| [Content Editor](./samples/js/src/agents/content-editor/) | 41243 | [Link](https://github.com/a2aproject/a2a-samples/tree/main/samples/js/src/agents/content-editor) | Proof-reading, grammar checking, style improvement |

### 🎭 Multi-Agent Orchestration

The **Travel Planner** demonstrates advanced multi-agent coordination using `a2a-ai-provider`:

```
User Request → Travel Planner (Orchestrator)
                    ├─→ Weather Agent (Specialist)
                    └─→ Airbnb Agent (Specialist)
```

**Key Innovation:** A2A agents consumed as "models" using `a2a-ai-provider`:

```typescript
import { a2a } from "a2a-ai-provider";
import { generateText } from "ai";

// A2A agent consumed as a "model"!
const result = await generateText({
  model: a2a('http://localhost:41250/.well-known/agent-card.json'),
  prompt: 'What is the weather in Paris?',
});
```

**3 Agents:**
- **Weather Agent** (Port 41250) - Weather forecasts via Open-Meteo API
- **Airbnb Agent** (Port 41251) - ✨ Accommodation search via **real MCP** (@openbnb/mcp-server-airbnb)
- **Travel Planner** (Port 41252) - Orchestrates both specialists

**✅ PRODUCTION-READY**: All agents now use real APIs!

**Start All**:
```bash
pnpm agents:weather-agent  # Terminal 1
pnpm agents:airbnb-agent   # Terminal 2
pnpm agents:travel-planner # Terminal 3
```

**Test**:
```bash
curl -X POST http://localhost:41252/plan \
  -H "Content-Type: application/json" \
  -d '{"query": "Plan a trip to Paris for 2 people"}'
```

See [Multi-Agent README](./samples/js/src/agents/travel-planner-multiagent/) for details.

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
export AI_PROVIDER=openai  # or: anthropic, google, azure, cohere, mistral, groq, ollama

# For Movie Agent only
export TMDB_API_KEY=your_tmdb_key
```

### 🤖 Model Selection

The examples support **all AI SDK providers** through three flexible approaches:

#### Option 1: Environment Variables (Quickest) ⚡

Set `AI_PROVIDER` and `AI_MODEL` to use any supported provider:

```bash
# OpenAI (default)
export AI_PROVIDER=openai
export AI_MODEL=gpt-4o          # optional, defaults to gpt-4o-mini

# Anthropic
export AI_PROVIDER=anthropic
export AI_MODEL=claude-3-opus-20240229  # optional, defaults to claude-3-5-sonnet

# Google
export AI_PROVIDER=google
export AI_MODEL=gemini-2.0-flash-exp    # optional

# Azure OpenAI
export AI_PROVIDER=azure
export AZURE_RESOURCE_NAME=my-resource  # required
export AZURE_OPENAI_API_KEY=your_key    # required
export AI_MODEL=gpt-4                   # deployment name

# Cohere
export AI_PROVIDER=cohere
export AI_MODEL=command-r-plus          # optional

# Mistral
export AI_PROVIDER=mistral
export AI_MODEL=mistral-large-latest    # optional

# Groq (fast inference)
export AI_PROVIDER=groq
export GROQ_API_KEY=your_key            # required
export AI_MODEL=llama-3.1-70b-versatile # optional

# Ollama (local models)
export AI_PROVIDER=ollama
export AI_MODEL=llama3.2                # optional
export OLLAMA_BASE_URL=http://localhost:11434  # optional
```

#### Option 2: Custom Model (Most Flexible) 🎯

For providers not covered by `getModel()` or custom configurations:

```typescript
import { createContentEditorAgent } from './agents/content-editor/agent.js';
import { createOpenAI } from '@ai-sdk/openai';
import { A2AAdapter } from './shared/a2a-adapter.js';

// Use Together AI
const together = createOpenAI({
  baseURL: 'https://api.together.xyz/v1',
  apiKey: process.env.TOGETHER_API_KEY,
});
const agent = createContentEditorAgent(together('meta-llama/Llama-3-70b-chat-hf'));
const executor = new A2AAdapter(agent);

// Use Replicate
import { createOpenAI } from '@ai-sdk/openai';
const replicate = createOpenAI({
  baseURL: 'https://openai-proxy.replicate.com/v1',
  apiKey: process.env.REPLICATE_API_KEY,
});
const agent = createContentEditorAgent(replicate('meta/llama-2-70b-chat'));

// Use local model via Ollama
const ollama = createOpenAI({
  baseURL: 'http://localhost:11434/v1',
  apiKey: 'ollama', // required but unused
});
const agent = createCoderAgent(ollama('codellama:13b'));
```

#### Option 3: Runtime Override 🔄

Override model at runtime without changing agent code:

```typescript
import { contentEditorAgent } from './agents/content-editor/agent.js';
import { anthropic } from '@ai-sdk/anthropic';
import { A2AAdapter } from './shared/a2a-adapter.js';

// Agent uses env vars by default, but you can override here
const executor = new A2AAdapter(contentEditorAgent, {
  // Use standard options...
  workingMessage: "Editing...",
});

// Or create a new agent with different model
import { createContentEditorAgent } from './agents/content-editor/agent.js';
const customAgent = createContentEditorAgent(anthropic('claude-3-opus-20240229'));
const customExecutor = new A2AAdapter(customAgent);
```

#### Supported Providers

| Provider | Via getModel() | Via Custom | Notes |
|----------|---------------|------------|-------|
| OpenAI | ✅ | ✅ | Default, most models |
| Anthropic | ✅ | ✅ | Claude family, best for code/writing |
| Google | ✅ | ✅ | Gemini family |
| Azure OpenAI | ✅ | ✅ | Enterprise, requires resource config |
| Cohere | ✅ | ✅ | Command models |
| Mistral | ✅ | ✅ | Mistral family |
| Groq | ✅ | ✅ | Fast inference |
| Ollama | ✅ | ✅ | Local models |
| AWS Bedrock | ❌ | ✅ | Via custom setup |
| Together AI | ❌ | ✅ | OpenAI-compatible |
| Replicate | ❌ | ✅ | OpenAI-compatible |
| Perplexity | ❌ | ✅ | OpenAI-compatible |
| Custom | ❌ | ✅ | Any OpenAI-compatible API |

**All AI SDK providers are supported!** Use `getModel()` for convenience, or agent factory functions for maximum flexibility.

See [MODEL_SELECTION_ASSESSMENT.md](./MODEL_SELECTION_ASSESSMENT.md) for detailed guidance.

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

