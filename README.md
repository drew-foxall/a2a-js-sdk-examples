# A2A AI SDK Adapter + Examples

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![AI SDK](https://img.shields.io/badge/AI%20SDK-v6-purple)](https://ai-sdk.dev/)
[![pnpm](https://img.shields.io/badge/pnpm-10.11-orange)](https://pnpm.io/)

**Multi-Purpose Repository:**
1. **[@drew-foxall/a2a-ai-sdk-adapter](packages/a2a-ai-sdk-adapter)** - NPM package for bridging Vercel AI SDK agents with the A2A protocol
2. **[Agent Examples](examples/agents)** - 10 working A2A agent examples demonstrating the adapter in action
3. **[Cloudflare Workers](examples/workers)** - Example workers demonstrating multi-agent orchestration via Service Bindings

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

# Start a demo agent (use Ctrl+C to stop)
pnpm agent:hello-world
# Opens on http://localhost:41244

# Available agents:
# pnpm agent:movie          # Movie search agent
# pnpm agent:coder          # Code generation
# pnpm agent:dice           # Dice rolling
# pnpm agent:github         # GitHub integration
# pnpm agent:analytics      # Chart generation
# pnpm agent:currency       # Currency conversion
# pnpm agent:weather        # Weather forecasts
# pnpm agent:airbnb         # Airbnb search
# pnpm agent:planner        # Travel planning (multi-agent)
```

**Test with A2A Inspector**:

**Recommended - Local Inspector:**
```bash
# Terminal 1: Start inspector
pnpm inspector

# Terminal 2: Start agent
pnpm agent:hello-world

# Browser: http://127.0.0.1:5001
# Connect: http://localhost:41244
```

**Quick Commands:**
```bash
pnpm inspector          # Start local inspector
pnpm inspector:stop     # Stop inspector
pnpm inspector:logs     # View logs
pnpm start-testing      # Interactive mode
```

📖 **Testing Guides**:
- **[Inspector Setup](INSPECTOR_SETUP.md)** - Local A2A Inspector (Docker)
- **[Test Workflow](TEST_WORKFLOW.md)** - Step-by-step: Start agents + use A2A Inspector
- **[Quick Start (3 min)](QUICKSTART_A2A_INSPECTOR.md)** - Get testing immediately
- **[Full Testing Guide](examples/TESTING_WITH_A2A_INSPECTOR.md)** - Comprehensive scenarios

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
│   ├── agents/                   # 🤖 10 Working Agents (Node.js/Hono)
│   │   ├── src/agents/
│   │   │   ├── hello-world/     # Simplest example
│   │   │   ├── dice-agent/      # Tool usage
│   │   │   ├── github-agent/    # External APIs
│   │   │   ├── analytics-agent/ # Artifacts (PNG charts)
│   │   │   ├── currency-agent/  # Real-time data
│   │   │   ├── movie-agent/     # Multi-turn conversations
│   │   │   ├── coder/           # Code generation
│   │   │   ├── content-editor/  # Text processing
│   │   │   └── travel-planner-multiagent/
│   │   │       ├── weather-agent/   # Weather specialist
│   │   │       ├── airbnb-agent/    # MCP integration
│   │   │       └── planner/         # Multi-agent orchestrator
│   │   └── package.json
│   │
│   ├── workers/                  # ☁️ Cloudflare Workers
│   │   ├── shared/              # Shared utilities
│   │   │   ├── types.ts         # Environment types
│   │   │   └── utils.ts         # Model providers
│   │   ├── hello-world/         # Simple agent worker
│   │   ├── dice-agent/          # Tool-using worker
│   │   ├── currency-agent/      # External API worker
│   │   ├── weather-agent/       # Specialist (Service Binding)
│   │   ├── airbnb-agent/        # MCP-powered specialist
│   │   ├── airbnb-mcp-server/   # MCP server worker
│   │   ├── travel-planner/      # Orchestrator worker
│   │   └── README.md            # Workers documentation
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

### Running Agents Locally

Each agent runs on its own port. Start them individually:

```bash
# Hello World - Simplest example (port 41244)
pnpm agent:hello-world

# Coder - Stream mode with real-time artifacts (port 41242)
pnpm agent:coder

# Travel Planner - Multi-agent orchestration (port 41252)
pnpm agent:planner

# All available commands:
# pnpm agent:movie           # Movie search (41241)
# pnpm agent:coder           # Code generation (41242)
# pnpm agent:content-editor  # Content editing (41243)
# pnpm agent:hello-world     # Simple example (41244)
# pnpm agent:dice            # Dice rolling (41245)
# pnpm agent:github          # GitHub API (41246)
# pnpm agent:analytics       # Chart generation (41247)
# pnpm agent:currency        # Currency conversion (41248)
# pnpm agent:weather         # Weather forecasts (41250)
# pnpm agent:airbnb          # Airbnb search (41251)
# pnpm agent:planner         # Travel planning (41252)
```

**Process Management**:
- Start: `pnpm agent:<name>`
- Stop: `Ctrl+C` in the terminal
- Multiple agents: Open separate terminals for each agent

**Testing**: See [examples/TESTING_WITH_A2A_INSPECTOR.md](examples/TESTING_WITH_A2A_INSPECTOR.md) for comprehensive testing instructions.

---

## ☁️ Cloudflare Workers Deployment

Deploy A2A agents to Cloudflare Workers for globally distributed agents.

### Quick Deploy

```bash
# 1. Set your OpenAI API key as a secret
pnpm --filter a2a-hello-world-worker exec wrangler secret put OPENAI_API_KEY

# 2. Deploy a single worker
pnpm worker:deploy:hello-world

# 3. Deploy all workers
pnpm workers:deploy:all
```

### Available Worker Commands

```bash
# Local Development (with wrangler dev)
pnpm worker:hello-world      # Hello World agent
pnpm worker:dice             # Dice Agent
pnpm worker:currency         # Currency Agent
pnpm worker:weather          # Weather Agent (specialist)
pnpm worker:airbnb-agent     # Airbnb Agent (specialist)
pnpm worker:planner          # Travel Planner (orchestrator)
pnpm worker:airbnb-mcp-server # Airbnb MCP Server

# Deploy to Cloudflare
pnpm worker:deploy:hello-world
pnpm worker:deploy:dice
pnpm worker:deploy:currency
pnpm worker:deploy:weather
pnpm worker:deploy:airbnb-agent
pnpm worker:deploy:planner
pnpm worker:deploy:airbnb-mcp-server
pnpm workers:deploy:all      # Deploy everything
```

### Worker Architecture

```
examples/workers/
├── shared/                  # Shared utilities (a2a-workers-shared)
│   ├── worker-config.ts    # Framework-agnostic configuration
│   ├── hono-adapter.ts     # createA2AHonoWorker() factory
│   ├── agent-card.ts       # buildAgentCard() utility
│   ├── types.ts            # Environment type definitions
│   ├── utils.ts            # Model provider setup
│   └── redis.ts            # Redis task store utilities
├── hello-world/            # Simple A2A agent
├── dice-agent/             # Tool-using agent
├── dice-agent-durable/     # Durable version (Workflow DevKit)
├── currency-agent/         # External API integration
├── weather-agent/          # Specialist (Service Binding target)
├── airbnb-agent/           # MCP-powered specialist
├── airbnb-mcp-server/      # MCP server as a Worker
├── travel-planner/         # Multi-agent orchestrator
├── travel-planner-durable/ # Durable orchestrator (Workflow DevKit)
└── image-generator-durable/ # Durable image generation
```

### Multi-Agent System with Service Bindings

The Travel Planner demonstrates a multi-agent architecture using Cloudflare Service Bindings for secure, private worker-to-worker communication:

```
┌─────────────────────────────────────────────────────────────┐
│                     PUBLIC INTERNET                          │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   Travel Planner      │  ◄── Public A2A endpoint
              │   (Orchestrator)      │
              └───────────┬───────────┘
                          │
            ┌─────────────┴─────────────┐
            │    Service Bindings       │  ◄── Private, no public access
            │    (Internal Only)        │
            ▼                           ▼
┌───────────────────┐       ┌───────────────────┐
│  Weather Agent    │       │  Airbnb Agent     │
│  (Specialist)     │       │  (Specialist)     │
└───────────────────┘       └─────────┬─────────┘
                                      │
                                      ▼
                            ┌───────────────────┐
                            │ Airbnb MCP Server │
                            │ (Internal Only)   │
                            └───────────────────┘
```

**Key Features:**
- **Service Bindings**: Private worker-to-worker calls (no public URLs)
- **INTERNAL_ONLY flag**: Specialist workers reject public requests
- **Zero network latency**: Service Bindings bypass the public internet

### Setting Secrets

Each worker needs an `OPENAI_API_KEY` secret:

```bash
# Set secret for each worker
pnpm --filter a2a-hello-world-worker exec wrangler secret put OPENAI_API_KEY
pnpm --filter a2a-dice-agent-worker exec wrangler secret put OPENAI_API_KEY
pnpm --filter a2a-currency-agent-worker exec wrangler secret put OPENAI_API_KEY
pnpm --filter a2a-weather-agent-worker exec wrangler secret put OPENAI_API_KEY
pnpm --filter a2a-airbnb-agent-worker exec wrangler secret put OPENAI_API_KEY
pnpm --filter a2a-travel-planner-worker exec wrangler secret put OPENAI_API_KEY

# Verify secrets are set
pnpm --filter a2a-hello-world-worker exec wrangler secret list
```

### Local Development with Workers

For local development, create a `.dev.vars` file in each worker directory:

```bash
# examples/workers/hello-world/.dev.vars
OPENAI_API_KEY=sk-your-key-here
```

Then run with `wrangler dev`:

```bash
cd examples/workers/hello-world
pnpm dev  # Starts on http://localhost:8787
```

### Important: Zod Schema Limitation

**Zod schemas don't work correctly in Cloudflare Workers** due to bundling issues. The workers use explicit JSON Schema objects instead:

```typescript
// ❌ Doesn't work in Workers (Zod schema gets stripped)
const schema = z.object({ location: z.string() });

// ✅ Works in Workers (explicit JSON Schema)
const schemaSymbol = Symbol.for("vercel.ai.schema");
const schema = {
  [schemaSymbol]: true,
  jsonSchema: {
    type: "object",
    properties: { location: { type: "string" } },
    required: ["location"],
  },
  validate: async (value) => ({ success: true, value }),
};
```

See `examples/workers/weather-agent/src/index.ts` for a complete example.

📖 **Full Documentation**: [examples/workers/README.md](examples/workers/README.md)

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
# Run all tests (adapter + all agents)
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run with coverage
pnpm test:coverage

# Run tests for adapter only
pnpm turbo run test --filter @drew-foxall/a2a-ai-sdk-adapter

# Run tests for specific agent
pnpm test src/agents/hello-world/agent.test.ts

# Run all tests for an agent (agent + tools)
pnpm test src/agents/analytics-agent/
```

**Test Coverage**:
- **Adapter**: 12 unit tests (configuration, loggers, modes, type safety)
- **Durable Adapter**: Tests for `DurableA2AAdapter` with Workflow DevKit
- **Agents**: 84 tests across 21 test files covering 11 agents
  - Each agent has `agent.test.ts` (ToolLoopAgent behavior)
  - Agents with utilities have `tools.test.ts` (pure functions)
  - All tests follow [AGENT_TEST_PRINCIPLES.md](examples/agents/AGENT_TEST_PRINCIPLES.md)
- **Shared Workers**: Tests for `worker-config.ts` and `agent-card.ts`
- **Test Quality**: All test files have ratio < 1.0x (test lines < source lines)
- **Type Safety**: No `as any` or `as unknown as` casts in test files

📖 **Documentation:**
- **[Agent Test Principles](examples/agents/AGENT_TEST_PRINCIPLES.md)** - Testing standards and patterns
- **[Full Testing Guide](examples/agents/TESTING.md)** - Comprehensive testing documentation

### Integration Tests (A2A Inspector)

1. Start an agent:
   ```bash
   pnpm agent:hello-world
   ```

2. Start local inspector: `pnpm inspector` (runs in Docker)

3. Enter: `http://localhost:41244`

4. Test interactively!

**Full Guide**: [examples/TESTING_WITH_A2A_INSPECTOR.md](examples/TESTING_WITH_A2A_INSPECTOR.md)

---

## 🛠️ Development

### Prerequisites

- **Node.js**: ≥ 24.0.0 (Active LTS - Krypton)
- **pnpm**: ≥ 10.0.0 (v10.23.0, installed automatically via `packageManager` field)
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
