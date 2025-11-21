# A2A AI SDK Adapter + Examples

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![AI SDK](https://img.shields.io/badge/AI%20SDK-v6-purple)](https://ai-sdk.dev/)
[![pnpm](https://img.shields.io/badge/pnpm-10.11-orange)](https://pnpm.io/)

**Dual-Purpose Repository:**
1. **[@drew-foxall/a2a-ai-sdk-adapter](packages/a2a-ai-sdk-adapter)** - NPM package for bridging Vercel AI SDK agents with the A2A protocol
2. **[Agent Examples](examples/agents)** - 10 production-ready A2A agents demonstrating the adapter in action

> Built with **Vercel AI SDK v6**, **Hono**, **TypeScript**, and [@drew-foxall/a2a-js-sdk](https://github.com/drew-foxall/a2a-js-sdk)

---

## 🚀 Quick Start

### Option 1: Use the NPM Package

```bash
npm install @drew-foxall/a2a-ai-sdk-adapter
# or
pnpm add @drew-foxall/a2a-ai-sdk-adapter
```

```typescript
import { ToolLoopAgent } from "ai";
import { openai } from "@ai-sdk/openai";
import { A2AAdapter } from "@drew-foxall/a2a-ai-sdk-adapter";

// Create your AI agent
const agent = new ToolLoopAgent({
  model: openai("gpt-4o"),
  instructions: "You are a helpful assistant",
  tools: {}, // Add your tools here
});

// Wrap it for A2A protocol
const adapter = new A2AAdapter(agent, {
  mode: "stream", // or "generate"
});

// Use with A2A server (Hono, Express, etc.)
// See packages/a2a-ai-sdk-adapter/README.md for details
```

**Full Documentation**: [packages/a2a-ai-sdk-adapter/README.md](packages/a2a-ai-sdk-adapter)

---

### Option 2: Run the Examples

```bash
# Clone and install
git clone https://github.com/drew-foxall/a2a-js-sdk-examples.git
cd a2a-js-sdk-examples
pnpm install

# Build all packages
pnpm build

# Start a demo agent
pnpm agents:hello-world

# Or start all agents in parallel
pnpm dev
```

**Test with [A2A Inspector](https://inspector.a2a.plus)**:
- Open https://inspector.a2a.plus
- Enter: `http://localhost:41244`
- Start chatting!

📖 **[Full Testing Guide](examples/TESTING_WITH_A2A_INSPECTOR.md)**

---

## 📦 Repository Structure

```
a2a-js-sdk-examples/
├── packages/
│   └── a2a-ai-sdk-adapter/       # 📦 NPM Package
│       ├── src/
│       │   ├── adapter.ts        # Core A2AAdapter class
│       │   ├── adapter.test.ts   # Vitest unit tests
│       │   └── index.ts          # Package exports
│       ├── package.json          # @drew-foxall/a2a-ai-sdk-adapter
│       └── README.md             # API documentation
│
├── examples/
│   ├── agents/                   # 🤖 10 Working Agents
│   │   ├── src/agents/
│   │   │   ├── hello-world/     # Simplest example
│   │   │   ├── dice-agent/      # Tool usage
│   │   │   ├── github-agent/    # External APIs
│   │   │   ├── analytics-agent/ # Artifacts (PNG charts)
│   │   │   ├── currency-agent/  # Real-time data
│   │   │   ├── movie-agent/     # Multi-turn conversations
│   │   │   ├── coder/           # Code generation
│   │   │   ├── content-editor/  # Text processing
│   │   │   ├── weather-agent/   # Weather data
│   │   │   ├── airbnb-agent/    # MCP integration
│   │   │   └── travel-planner-multiagent/
│   │   │       └── planner/     # Multi-agent orchestration
│   │   └── package.json
│   │
│   └── TESTING_WITH_A2A_INSPECTOR.md  # Testing guide
│
├── turbo.json                    # Turborepo configuration
├── pnpm-workspace.yaml           # pnpm monorepo setup
└── README.md                     # This file
```

---

## 🤖 Example Agents

All examples demonstrate different adapter capabilities:

| Agent | Port | Purpose | Mode | Key Feature |
|-------|------|---------|------|-------------|
| **[Hello World](examples/agents/src/agents/hello-world)** | 41244 | Simplest A2A agent | Generate | Baseline example |
| **[Dice Agent](examples/agents/src/agents/dice-agent)** | 41245 | Simple tool usage | Stream | Tool calling |
| **[GitHub Agent](examples/agents/src/agents/github-agent)** | 41246 | External API integration | Stream | Octokit API |
| **[Analytics Agent](examples/agents/src/agents/analytics-agent)** | 41247 | Artifact generation | Generate | PNG charts |
| **[Currency Agent](examples/agents/src/agents/currency-agent)** | 41248 | Real-time data | Stream | Frankfurter API |
| **[Movie Agent](examples/agents/src/agents/movie-agent)** | 41249 | Multi-turn conversations | Generate | Custom state |
| **[Coder](examples/agents/src/agents/coder)** | 41250 | Code generation | Stream | Real-time artifacts |
| **[Content Editor](examples/agents/src/agents/content-editor)** | 41251 | Text processing | Generate | Simple transforms |
| **[Weather Agent](examples/agents/src/agents/travel-planner-multiagent/weather-agent)** | 41252 | Weather data | Stream | Open-Meteo API |
| **[Airbnb Agent](examples/agents/src/agents/travel-planner-multiagent/airbnb-agent)** | 41253 | MCP integration | Stream | Real Airbnb data |
| **[Travel Planner](examples/agents/src/agents/travel-planner-multiagent/planner)** | 41254 | Multi-agent orchestration | Stream | Agent networks |

### Run Individual Agents

```bash
# Hello World - Simplest example
pnpm agents:hello-world

# Coder - Stream mode with real-time artifacts
pnpm agents:coder

# Travel Planner - Multi-agent orchestration
pnpm agents:travel-planner
```

### Run All Agents

```bash
# Start all 11 agents in parallel using Turborepo
pnpm dev
```

**Testing**: See [examples/TESTING_WITH_A2A_INSPECTOR.md](examples/TESTING_WITH_A2A_INSPECTOR.md) for comprehensive testing instructions.

---

## 🏗️ Architecture

### Unified Adapter Pattern

All agents use the same `A2AAdapter` class with explicit mode switching:

```typescript
import { ToolLoopAgent } from "ai";
import { A2AAdapter } from "@drew-foxall/a2a-ai-sdk-adapter";
import { openai } from "@ai-sdk/openai";

// 1. Create AI SDK agent (protocol-agnostic)
const agent = new ToolLoopAgent({
  model: openai("gpt-4o"),
  instructions: "You are a helpful assistant",
  tools: { /* your tools */ },
});

// 2. Wrap with A2A adapter (mode: 'stream' or 'generate')
const executor = new A2AAdapter(agent, {
  mode: "stream", // Real-time text streaming
  parseArtifacts: (text) => {
    // Extract artifacts from text (optional)
    return [];
  },
});

// 3. Use with A2A server
import { A2AHonoApp } from "@drew-foxall/a2a-js-sdk/hono";
import { serve } from "@hono/node-server";

const app = new A2AHonoApp({ card: agentCard, executor });
serve({ fetch: app.fetch, port: 41244 });
```

### Mode Selection

| Mode | Use When | Capabilities |
|------|----------|--------------|
| **`stream`** | Long responses, code generation, real-time updates | ✅ Text streaming<br>✅ Real-time artifact parsing<br>✅ Post-completion artifacts |
| **`generate`** | Quick responses, API-style interactions | ✅ Single awaited response<br>✅ Post-completion artifacts |

**See**: [packages/a2a-ai-sdk-adapter/README.md](packages/a2a-ai-sdk-adapter) for full API documentation

---

## 🧪 Testing

### Unit Tests (Vitest)

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests for adapter only
pnpm turbo run test --filter @drew-foxall/a2a-ai-sdk-adapter
```

**Test Coverage**: 12 unit tests covering configuration, loggers, modes, and type safety

### Integration Tests (A2A Inspector)

1. Start an agent:
   ```bash
   pnpm agents:hello-world
   ```

2. Open [https://inspector.a2a.plus](https://inspector.a2a.plus)

3. Enter: `http://localhost:41244`

4. Test interactively!

**Full Guide**: [examples/TESTING_WITH_A2A_INSPECTOR.md](examples/TESTING_WITH_A2A_INSPECTOR.md)

---

## 🛠️ Development

### Prerequisites

- **Node.js**: ≥ 18.0.0
- **pnpm**: 10.11.1 (installed automatically via `packageManager` field)
- **OpenAI API Key**: For running examples

### Setup

```bash
# 1. Clone repository
git clone https://github.com/drew-foxall/a2a-js-sdk-examples.git
cd a2a-js-sdk-examples

# 2. Install dependencies
pnpm install

# 3. Build all packages
pnpm build

# 4. Set up environment variables
cp examples/agents/.env.example examples/agents/.env
# Edit .env and add your OPENAI_API_KEY

# 5. Start an agent
pnpm agents:hello-world
```

### Monorepo Commands

```bash
# Build
pnpm build                  # Build all packages (with caching)

# Development
pnpm dev                    # Start all agents in parallel

# Testing
pnpm test                   # Run all unit tests
pnpm test:watch             # Run tests in watch mode

# Code Quality
pnpm typecheck              # Type checking
pnpm lint                   # Lint all code
pnpm lint:fix               # Auto-fix lint issues
pnpm format                 # Check formatting
pnpm format:write           # Auto-format code

# Individual Agents
pnpm agents:hello-world     # Start hello-world agent
pnpm agents:coder           # Start coder agent
# ... etc (see package.json for all commands)
```

**Powered by**: [Turborepo](https://turbo.build/) for parallel execution and caching

---

## 📚 Documentation

### Package Documentation
- **[A2AAdapter API](packages/a2a-ai-sdk-adapter/README.md)** - Adapter class API reference
- **[Testing Guide](examples/TESTING_WITH_A2A_INSPECTOR.md)** - Testing with a2a-inspector
- **[Repository Refocus Plan](REPO_REFOCUS_PLAN.md)** - Architecture and design decisions

### External Documentation
- **[A2A Protocol](https://a2a.plus/docs)** - Official A2A protocol documentation
- **[Vercel AI SDK](https://ai-sdk.dev/)** - AI SDK v6 documentation
- **[AI SDK Testing](https://ai-sdk.dev/docs/ai-sdk-core/testing)** - Official testing guide
- **[@drew-foxall/a2a-js-sdk](https://github.com/drew-foxall/a2a-js-sdk)** - A2A JS SDK (Hono fork)

---

## 🔗 Related Projects

- **[a2a-samples](https://github.com/a2aproject/a2a-samples)** - Official Python/JavaScript examples
- **[a2a-inspector](https://github.com/a2aproject/a2a-inspector)** - Web-based A2A agent inspector
- **[a2a-js](https://github.com/google/a2a-js)** - Official A2A JavaScript SDK
- **[@drew-foxall/a2a-js-sdk](https://github.com/drew-foxall/a2a-js-sdk)** - A2A JS SDK with Hono support (this project's dependency)

---

## 🤝 Contributing

Contributions welcome! Areas of interest:

1. **New Agent Examples**: Add agents demonstrating new patterns
2. **Adapter Improvements**: Enhance `A2AAdapter` functionality
3. **Documentation**: Improve guides and API docs
4. **Testing**: Add more unit/integration tests
5. **Provider Support**: Examples using other AI SDK providers (Anthropic, Google, etc.)

### Contribution Workflow

```bash
# 1. Fork and clone
git clone https://github.com/YOUR_USERNAME/a2a-js-sdk-examples.git

# 2. Create a branch
git checkout -b feature/my-new-feature

# 3. Make changes and test
pnpm build
pnpm test
pnpm lint

# 4. Commit and push
git commit -m "feat: add my new feature"
git push origin feature/my-new-feature

# 5. Open a Pull Request
```

**Style Guide**: We use Biome for linting/formatting. Run `pnpm lint:fix` and `pnpm format:write` before committing.

---

## 📄 License

Apache 2.0 - See [LICENSE](LICENSE) for details

---

## 🙏 Acknowledgments

- **[Vercel AI SDK Team](https://github.com/vercel/ai)** - For the excellent AI SDK v6
- **[A2A Project](https://a2a.plus/)** - For the Agent2Agent protocol
- **[Hono](https://hono.dev/)** - For the lightweight web framework
- **[Total TypeScript](https://github.com/total-typescript/tsconfig)** - For strict TypeScript configurations

---

## 📬 Support

- **Issues**: [GitHub Issues](https://github.com/drew-foxall/a2a-js-sdk-examples/issues)
- **Discussions**: [GitHub Discussions](https://github.com/drew-foxall/a2a-js-sdk-examples/discussions)
- **A2A Protocol**: [a2a.plus](https://a2a.plus/)
- **AI SDK**: [ai-sdk.dev](https://ai-sdk.dev/)

---

**Happy Building! 🚀**
