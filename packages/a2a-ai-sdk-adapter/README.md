# @drew-foxall/a2a-ai-sdk-adapter

[![npm version](https://img.shields.io/npm/v/@drew-foxall/a2a-ai-sdk-adapter)](https://www.npmjs.com/package/@drew-foxall/a2a-ai-sdk-adapter)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)

**Unified adapter bridging Vercel AI SDK's ToolLoopAgent with the A2A (Agent-to-Agent) protocol.**

This package provides a robust and type-safe way to expose AI SDK agents as A2A-compliant services, supporting both simple (awaited) and streaming interactions, along with flexible artifact generation and logging.

**Two Adapters Available:**
- **`A2AAdapter`** - For standard `ToolLoopAgent` agents (non-durable)
- **`DurableA2AAdapter`** - For durable workflows using Workflow DevKit (import from `@drew-foxall/a2a-ai-sdk-adapter/durable`)

---

## 📦 Installation

```bash
npm install @drew-foxall/a2a-ai-sdk-adapter
# or
pnpm add @drew-foxall/a2a-ai-sdk-adapter
# or
yarn add @drew-foxall/a2a-ai-sdk-adapter
```

**Peer Dependencies**:
- `ai` ^6.0.0 (Vercel AI SDK)
- `@drew-foxall/a2a-js-sdk` ^0.3.5
- `uuid` ^11.0.0

---

## 🚀 Quick Start

```typescript
import { ToolLoopAgent } from "ai";
import { openai } from "@ai-sdk/openai";
import { A2AAdapter } from "@drew-foxall/a2a-ai-sdk-adapter";
import { A2AHonoApp } from "@drew-foxall/a2a-js-sdk/server/hono";
import { serve } from "@hono/node-server";

// 1. Create your AI SDK agent
const agent = new ToolLoopAgent({
  model: openai("gpt-4o"),
  instructions: "You are a helpful assistant",
  tools: {},
});

// 2. Wrap with A2A adapter
const executor = new A2AAdapter(agent, {
  mode: "stream", // or "generate"
});

// 3. Create A2A server
const app = new A2AHonoApp({
  card: {
    name: "My Agent",
    description: "A helpful AI agent",
    url: "http://localhost:3000",
    version: "1.0.0",
    protocolVersion: "0.3.0",
    capabilities: {
      streaming: true,
    },
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    skills: [],
  },
  executor,
});

// 4. Start server
serve({ fetch: app.fetch, port: 3000 });
```

---

## 📖 API Documentation

### `A2AAdapter<TTools extends ToolSet>`

The main adapter class that bridges AI SDK agents with the A2A protocol.

#### Constructor

```typescript
constructor(agent: ToolLoopAgent<never, TTools, never>, config: A2AAdapterConfig)
```

**Parameters**:
- `agent`: A configured `ToolLoopAgent` from Vercel AI SDK
- `config`: Configuration object (see below)

#### Configuration Options (`A2AAdapterConfig`)

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `mode` | `'stream' \| 'generate'` | **Yes** | Execution mode (see [Mode Selection](#mode-selection)) |
| `selectResponseType` | `(ctx) => 'message' \| 'task' \| Promise<'message' \| 'task'>` | No | **Agent-owned routing step** to choose A2A `Message` vs `Task` per request (defaults to `task`) |
| `systemPrompt` | `string` | No | System prompt for the agent (default: generic A2A prompt) |
| `maxSteps` | `number` | No | Max tool call iterations (default: 5) |
| `includeHistory` | `boolean` | No | Include conversation history (default: false) |
| `workingMessage` | `string` | No | Initial status message (default: "Processing...") |
| `logger` | `A2ALogger` | No | Custom logger (default: `ConsoleLogger`) |
| `parseArtifacts` | `(text: string, context: ArtifactGenerationContext) => ParsedArtifacts \| ParsedArtifact[]` | No | Parse artifacts from text (stream mode only) |
| `generateArtifacts` | `(context: ArtifactGenerationContext) => Promise<Artifact[]>` | No | Generate artifacts asynchronously |
| `parseTaskState` | `(text: string) => TaskState` | No | Custom task state parser (default: "completed") |

---

## 🧭 Dynamic Response Type (A2A `Message` vs `Task`)

A2A allows an agent to respond with either a stateless **`Message`** (immediate) or a stateful **`Task`** (lifecycle + streaming/progress). See “Agent Response: Task or Message” in the A2A core concepts doc ([A2A key concepts](https://raw.githubusercontent.com/a2aproject/A2A/main/docs/topics/key-concepts.md)).

### Why this must be decided “up front”

If the server starts emitting task lifecycle events (or starts SSE streaming), it has already committed to a **Task** response shape. Therefore the adapter needs a *routing decision* before it publishes any task events.

### Recommended pattern: agent-owned routing (AI SDK “Routing”)

Use `selectResponseType` as a small *routing/classification step* owned by your agentic system (not “the user telling the agent what to do”):

```ts
import { A2AAdapter } from "@drew-foxall/a2a-ai-sdk-adapter";

const executor = new A2AAdapter(agent, {
  mode: "stream", // default execution mode for Task responses

  // Agent-owned routing step (AI SDK "Routing" pattern)
  selectResponseType: async ({ userMessage, existingTask }) => {
    // Continuations should stay in Task mode
    if (existingTask) return "task";

    // Do a cheap classification step (e.g. generateObject / small model)
    const { responseType } = await classifyRequest(userMessage);
    return responseType; // "message" | "task"
  },
});
```

Notes:
- If you always want stateless behavior (e.g. “Hello World”), return `"message"`.
- If you want full lifecycle + streaming/progress/cancellation, return `"task"`.

### Utilities to reduce boilerplate

The adapter exports small helpers you can use when implementing routing:

```ts
import {
  extractTextFromA2AMessage,
  createLLMResponseTypeRouter,
  preferTaskForContinuations,
} from "@drew-foxall/a2a-ai-sdk-adapter";

const selectResponseType = preferTaskForContinuations(async ({ userMessage }) => {
  const text = extractTextFromA2AMessage(userMessage);
  // ... your agent-owned routing/classification logic ...
  return text ? "message" : "task";
});
```

If you want a ready-made LLM router (AI SDK `generateObject`), you can use:

```ts
import { createLLMResponseTypeRouter } from "@drew-foxall/a2a-ai-sdk-adapter";
import { z } from "zod";

const selectResponseType = createLLMResponseTypeRouter({
  model: routingModel, // choose a small/cheap model
  // Optional: omit schema to use the adapter’s default schema (requires zod installed)
  schema: z.object({
    responseType: z.enum(["message", "task"]),
    reasoning: z.string().optional(),
  }),
});
```

## 🎯 Mode Selection

### Stream Mode (`mode: 'stream'`)

**Best for**: Long-form content, code generation, chat interfaces

**Capabilities**:
- ✅ Real-time text streaming
- ✅ Incremental artifact parsing (via `parseArtifacts`)
- ✅ Post-completion artifacts (via `generateArtifacts`)

**Example**:
```typescript
const executor = new A2AAdapter(agent, {
  mode: "stream",
  parseArtifacts: (text) => {
    // Extract code blocks in real-time
    const codeBlocks = extractCodeBlocks(text);
    return codeBlocks.map(block => ({
      content: block.code,
      mimeType: "application/octet-stream",
      title: `${block.language} code`,
    }));
  },
});
```

---

### Generate Mode (`mode: 'generate'`)

**Best for**: Quick responses, API-style interactions, simple agents

**Capabilities**:
- ✅ Single awaited response
- ✅ Post-completion artifacts (via `generateArtifacts`)

**Example**:
```typescript
const executor = new A2AAdapter(agent, {
  mode: "generate",
  generateArtifacts: async (ctx) => {
    // Generate a chart after response is complete
    const chart = await generateChart(ctx.responseText);
    return [{
      content: chart.toString("base64"),
      mimeType: "image/png",
      title: "Analytics Chart",
    }];
  },
});
```

---

## 📊 Artifacts

Artifacts are supplementary data (images, code, files) attached to agent responses.

### Real-Time Artifact Parsing (Stream Mode Only)

```typescript
const executor = new A2AAdapter(agent, {
  mode: "stream",
  parseArtifacts: (text, context) => {
    // Called for each text chunk
    const artifacts: ParsedArtifact[] = [];
    
    // Extract code blocks
    const codeMatches = text.matchAll(/```(\w+)\n([\s\S]+?)```/g);
    for (const match of codeMatches) {
      artifacts.push({
        content: match[2],
        mimeType: "application/octet-stream",
        title: `${match[1]} code`,
      });
    }
    
    return artifacts;
  },
});
```

### Post-Completion Artifact Generation

```typescript
const executor = new A2AAdapter(agent, {
  mode: "generate", // or "stream"
  generateArtifacts: async (context) => {
    // Called after response is complete
    const { responseText, messages, task } = context;
    
    // Generate a PNG chart
    const canvas = createCanvas(800, 600);
    const ctx = canvas.getContext("2d");
    // ... draw chart ...
    
    return [{
      content: canvas.toBuffer("image/png").toString("base64"),
      mimeType: "image/png",
      title: "Sales Chart",
    }];
  },
});
```

---

## 🔧 Logging

### Built-in Loggers

```typescript
import { ConsoleLogger, NoOpLogger } from "@drew-foxall/a2a-ai-sdk-adapter";

// Console logging (default)
const executor = new A2AAdapter(agent, {
  mode: "stream",
  logger: new ConsoleLogger(),
});

// No logging
const executor = new A2AAdapter(agent, {
  mode: "stream",
  logger: new NoOpLogger(),
});
```

### Custom Logger

```typescript
import { A2ALogger } from "@drew-foxall/a2a-ai-sdk-adapter";

class CustomLogger implements A2ALogger {
  debug(message: string, meta?: Record<string, unknown>): void {
    // Your implementation
  }

  info(message: string, meta?: Record<string, unknown>): void {
    // Your implementation
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    // Your implementation
  }

  error(message: string, meta?: Record<string, unknown>): void {
    // Your implementation
  }
}

const executor = new A2AAdapter(agent, {
  mode: "stream",
  logger: new CustomLogger(),
});
```

---

## 🔄 Conversation History

Enable multi-turn conversations by including message history:

```typescript
const executor = new A2AAdapter(agent, {
  mode: "generate",
  includeHistory: true, // ← Include previous messages
});
```

**Example** (Movie Recommendation Agent):
```typescript
// Turn 1: User: "I want to watch a movie"
// Agent: "What genre do you prefer?"

// Turn 2: User: "Sci-fi"
// Agent: (has context from Turn 1) "I recommend Interstellar..."
```

---

## 🎭 Custom Task States

By default, all tasks complete with `state: "completed"`. Override for custom workflows:

```typescript
const executor = new A2AAdapter(agent, {
  mode: "generate",
  parseTaskState: (responseText) => {
    if (responseText.includes("NEED_MORE_INFO")) {
      return "input-required";
    }
    if (responseText.includes("ERROR")) {
      return "failed";
    }
    return "completed";
  },
  includeHistory: true, // Usually needed with custom states
});
```

**Valid States**: `"submitted" | "working" | "completed" | "failed" | "canceled" | "input-required"`

---

## 🛠️ Advanced Usage

### Multiple Tool Usage

```typescript
import { z } from "zod";

const agent = new ToolLoopAgent({
  model: openai("gpt-4o"),
  instructions: "You are a weather assistant",
  tools: {
    getWeather: {
      description: "Get current weather for a location",
      parameters: z.object({
        location: z.string().describe("City name"),
      }),
      execute: async ({ location }) => {
        const response = await fetch(`https://wttr.in/${location}?format=j1`);
        return await response.json();
      },
    },
    getForecast: {
      description: "Get 7-day forecast",
      parameters: z.object({
        location: z.string(),
      }),
      execute: async ({ location }) => {
        // ... fetch forecast ...
      },
    },
  },
});

const executor = new A2AAdapter(agent, {
  mode: "stream",
  maxSteps: 10, // Allow multiple tool calls
});
```

---

### Multi-Provider Support

Works with all AI SDK providers:

```typescript
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";

// OpenAI
const executor1 = new A2AAdapter(
  new ToolLoopAgent({ model: openai("gpt-4o"), ... }),
  { mode: "stream" }
);

// Anthropic
const executor2 = new A2AAdapter(
  new ToolLoopAgent({ model: anthropic("claude-3-5-sonnet-20241022"), ... }),
  { mode: "stream" }
);

// Google
const executor3 = new A2AAdapter(
  new ToolLoopAgent({ model: google("gemini-1.5-pro"), ... }),
  { mode: "stream" }
);
```

---

## 🧪 Testing

### Unit Tests with Vitest

```typescript
import { describe, it, expect } from "vitest";
import { ToolLoopAgent } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { A2AAdapter } from "@drew-foxall/a2a-ai-sdk-adapter";

describe("My Agent", () => {
  it("should respond correctly", () => {
    const agent = new ToolLoopAgent({
      model: new MockLanguageModelV3({
        doGenerate: async () => ({
          finishReason: "stop",
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [{ type: "text", text: "Hello, world!" }],
          warnings: [],
        }),
      }),
      instructions: "Test agent",
      tools: {},
    });

    const adapter = new A2AAdapter(agent, {
      mode: "generate",
    });

    expect(adapter).toBeDefined();
  });
});
```

**See**: [Official AI SDK Testing Guide](https://ai-sdk.dev/docs/ai-sdk-core/testing)

---

## 📚 Examples

For complete working examples of agents built with this adapter, see the [a2a-js-sdk-examples repository](https://github.com/drew-foxall/a2a-js-sdk-examples).

Examples include:
- **Hello World** - Simplest possible agent
- **Dice Agent** - Tool usage example
- **GitHub Agent** - External API integration
- **Analytics Agent** - PNG chart generation with artifacts
- **Currency Agent** - Real-time data fetching
- **Movie Agent** - Multi-turn conversations
- **Coder** - Streaming code generation
- **Content Editor** - Text processing
- **Travel Planner** - Multi-agent orchestration
- **Weather & Airbnb Agents** - MCP integration

---

## 🔗 Resources

- **[GitHub Repository](https://github.com/drew-foxall/a2a-js-sdk-examples)** - Source code and examples
- **[AI SDK Documentation](https://ai-sdk.dev/)** - Vercel AI SDK docs
- **[A2A Protocol](https://a2a-protocol.org/)** - Agent2Agent protocol specification
- **[@drew-foxall/a2a-js-sdk](https://github.com/drew-foxall/a2a-js-sdk)** - A2A JavaScript SDK with Hono support

---

## 🤝 Contributing

Contributions welcome! Please see the [GitHub repository](https://github.com/drew-foxall/a2a-js-sdk-examples) for contribution guidelines.

---

## 📄 License

Apache 2.0 - See [LICENSE](LICENSE) for details

---

## 🙏 Acknowledgments

- **[Vercel AI SDK](https://ai-sdk.dev/)** - Foundation for agent logic
- **[A2A Project](https://a2a-protocol.org/)** - Agent2Agent protocol
- **[@drew-foxall/a2a-js-sdk](https://github.com/drew-foxall/a2a-js-sdk)** - A2A JavaScript SDK

---

---

## 🔄 Durable Workflows (DurableA2AAdapter)

For agents that need durability (automatic retry, result caching, observability), use `DurableA2AAdapter`:

```typescript
import { DurableA2AAdapter } from "@drew-foxall/a2a-ai-sdk-adapter/durable";
import { diceAgentWorkflow } from "a2a-agents";

// Wrap a durable workflow for A2A protocol
const executor = new DurableA2AAdapter(diceAgentWorkflow, {
  workingMessage: "Rolling dice (with durability)...",
});

// For workflows with additional arguments:
const imageExecutor = new DurableA2AAdapter(imageGeneratorWorkflow, {
  workflowArgs: [env.OPENAI_API_KEY], // Additional args after messages
  workingMessage: "Generating image...",
});
```

### How Durability Works

The durability stack consists of three layers working together:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DurableA2AAdapter                            │
│  Bridges A2A protocol with Workflow DevKit via start()              │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │ calls start()
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Workflow DevKit Runtime                          │
│  - start() creates run in World, queues workflow execution          │
│  - "use workflow" and "use step" directives (SWC transform)         │
│  - getWritable() for streaming output                               │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │ persists to
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         World (Persistence)                         │
│  - @drew-foxall/upstash-workflow-world (Cloudflare Workers)         │
│  - @workflow/world-vercel (Vercel)                                  │
│  - @workflow/world-local (local dev)                                │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │ uses
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      @drew-foxall/workflow-ai                       │
│  - DurableAgent: AI SDK integration with "use step" internally      │
│  - Must run inside a workflow context                               │
└─────────────────────────────────────────────────────────────────────┘
```

**Key Insight:** Calling a workflow function directly does NOT provide durability. The workflow MUST be invoked via `start()` from `workflow/api`, which triggers the World's persistence mechanisms.

### DurableA2AAdapter Configuration

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `workflowArgs` | `TArgs` | No | Additional arguments to pass to the workflow (after messages) |
| `workingMessage` | `string` | No | Initial status message (default: "Processing...") |
| `includeHistory` | `boolean` | No | Include conversation history (default: false) |
| `parseTaskState` | `(text: string) => TaskState` | No | Custom task state parser |
| `generateArtifacts` | `(context) => Promise<Artifact[]>` | No | Generate artifacts after completion |
| `debug` | `boolean` | No | Enable debug logging (default: false) |
| `logger` | `Logger` | No | Custom logger implementation |

### When to Use DurableA2AAdapter

| Use DurableA2AAdapter When | Use A2AAdapter When |
|---------------------------|---------------------|
| Operations take >30 seconds | Quick responses |
| Expensive API calls (avoid duplicates) | Cheap/free operations |
| Multi-step coordination | Single operation |
| Need observability traces | Simple debugging |
| Operations must survive restarts | Stateless operations |

---

**Built with 🤖 by Drew Foxall**
