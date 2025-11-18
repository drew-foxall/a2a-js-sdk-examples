# Coder Agent (AI SDK + Hono)

A high-fidelity port of the original [Genkit-based Coder Agent](https://github.com/a2aproject/a2a-samples/tree/main/samples/js/src/agents/coder) using **Vercel AI SDK** and **Hono**.

## Features

✅ **Full Feature Parity with Original**
- 💻 High-quality code generation
- 📁 **Multi-file support** - Generate multiple files in one response
- 🌊 **Streaming** - Real-time code generation
- 📦 **Artifacts** - Each file emitted as a separate artifact
- 🔖 **Markdown parsing** - Extracts code from ` ```language filename` blocks
- 📝 **Preamble/Postamble** - Preserves explanatory text

## What's Different from Original?

| Feature | Original (Genkit) | AI SDK Port | Notes |
|---------|------------------|-------------|-------|
| Framework | Genkit | Vercel AI SDK | Provider-agnostic |
| Web Server | Express | Hono | Faster, edge-ready |
| Streaming API | `generateStream()` | `streamText()` | Native streaming |
| Output Format | Custom format | Markdown parsing | Simpler |
| Model Config | `gemini-2.0-flash` | Any provider | Configurable |

## Prerequisites

**LLM API Key**: One of:
- OpenAI API Key (default, recommended for code)
- Anthropic API Key (Claude 3.5 Sonnet excellent for code)
- Google AI API Key

## Installation

```bash
# From the project root
pnpm install
```

## Running the Agent

### Quick Start

```bash
# Set your API key
export OPENAI_API_KEY=your_openai_key_here  # or ANTHROPIC_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY

# Run the agent
pnpm agents:ai-sdk-coder-agent
```

The agent will start on `http://localhost:41242`.

### Using Different AI Providers

```bash
# Use Anthropic Claude (recommended for code!)
export AI_PROVIDER=anthropic
export ANTHROPIC_API_KEY=your_key

# Use Google Gemini
export AI_PROVIDER=google
export GOOGLE_GENERATIVE_AI_API_KEY=your_key

# Use OpenAI (default)
export AI_PROVIDER=openai
export OPENAI_API_KEY=your_key

pnpm agents:ai-sdk-coder-agent
```

> **💡 Tip**: Anthropic's Claude 3.5 Sonnet is excellent for code generation!

## Testing with A2A CLI

In a separate terminal:

```bash
pnpm a2a:cli

# Try these coding tasks:
> Write a TypeScript function to calculate fibonacci numbers
> Create a React component for a todo list
> Build a REST API endpoint for user authentication  
> Generate a Python script to scrape websites
```

## Architecture

```
coder-agent/
├── index.ts           # Main agent executor with streaming
├── code-format.ts     # Markdown code block parser
└── README.md          # This file
```

### Key Implementation Details

**1. Streaming Code Generation**
```typescript
// Real-time streaming (matches original behavior)
const { textStream, text: responsePromise } = streamText({
  model: getAIModel(),
  system: CODER_SYSTEM_PROMPT,
  messages,
});

for await (const chunk of textStream) {
  accumulatedText += chunk;
  // Parse and emit artifacts as they're completed
}
```

**2. Markdown Code Block Parsing**
```typescript
// Extracts ```language filename blocks
export function extractCodeBlocks(source: string): CodeMessageData {
  // Parses: ```typescript src/utils/helper.ts
  // Returns: { files: [...], postamble: "..." }
}
```

**3. Multi-File Artifacts**
```typescript
// Each file gets its own artifact (matches original)
const artifactUpdate: TaskArtifactUpdateEvent = {
  kind: "artifact-update",
  artifact: {
    index: fileOrder.indexOf(file.filename),
    id: `${taskId}-${file.filename}`,
    name: file.filename,
    mimeType: "text/plain",
    data: currentContent,
    metadata: { language, preamble },
  },
};
```

## Code Output Format

The agent expects and generates code in this format:

```typescript
Here's the implementation you requested:

\`\`\`typescript src/utils/fibonacci.ts
/**
 * Calculates the nth Fibonacci number
 */
export function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
\`\`\`

\`\`\`typescript src/utils/fibonacci.test.ts
/**
 * Tests for fibonacci function
 */
import { fibonacci } from './fibonacci';

describe('fibonacci', () => {
  it('should calculate fibonacci numbers', () => {
    expect(fibonacci(0)).toBe(0);
    expect(fibonacci(1)).toBe(1);
    expect(fibonacci(10)).toBe(55);
  });
});
\`\`\`

This implementation uses recursion for simplicity.
```

### Format Rules

✅ **DO:**
- Include filename on same line as ` ```
- Use format: ` ```language path/to/file.ext`
- Add a comment at the top describing the file's purpose
- Separate multiple files with blank lines

❌ **DON'T:**
- Use ` ``` without filename
- Include extra explanations inside code blocks
- Mix code and prose in the same block

## Example Queries

**Single File:**
- "Write a TypeScript function to calculate fibonacci numbers"
- "Create a simple HTTP server in Node.js"
- "Generate a Python script to read CSV files"

**Multiple Files:**
- "Create a React component for a todo list with tests"
- "Build a REST API with routes and middleware"
- "Generate a full CRUD application structure"

**Complex Tasks:**
- "Create a Next.js app with authentication"
- "Build a CLI tool with subcommands"
- "Generate a TypeScript library with types and docs"

## API Endpoints

Once running, the agent exposes:

- **Agent Card**: `GET http://localhost:41242/.well-known/agent-card.json`
- **JSON-RPC**: `POST http://localhost:41242/`

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AI_PROVIDER` | ❌ No | `openai` | AI provider (`openai`, `anthropic`, `google`) |
| `OPENAI_API_KEY` | ⚠️ If using OpenAI | - | OpenAI API key |
| `ANTHROPIC_API_KEY` | ⚠️ If using Anthropic | - | Anthropic API key |
| `GOOGLE_GENERATIVE_AI_API_KEY` | ⚠️ If using Google | - | Google AI API key |
| `PORT` | ❌ No | `41242` | Server port |

## Comparison with Original

### Original (Genkit) Streaming
```typescript
const { stream, response } = await ai.generateStream({
  system: 'You are an expert coding assistant...',
  output: { format: 'code' },
  messages,
});

for await (const event of stream) {
  const parsed = new CodeMessage(extractCode(event.accumulatedText));
  // Process files...
}
```

### AI SDK Port
```typescript
const { textStream } = streamText({
  model: getAIModel(),
  system: CODER_SYSTEM_PROMPT,
  messages,
});

for await (const chunk of textStream) {
  accumulatedText += chunk;
  const parsed = extractCodeBlocks(accumulatedText);
  // Process files...
}
```

Both achieve the same result - streaming code generation with multi-file support!

## Troubleshooting

**No artifacts generated:**
- Make sure your code is in ` ```language filename` blocks
- Check that filenames are specified on the same line as ` ```
- Verify the code blocks are properly closed with ` ```

**Incomplete files:**
- This is normal during streaming - files are updated as they complete
- Final files will be emitted when streaming finishes

**Multiple versions of same file:**
- The agent tracks file changes and only emits updates when content changes
- Latest version wins

## Best Practices

1. **Be specific** about file structure:
   - ✅ "Create a React component in src/components/TodoList.tsx"
   - ❌ "Create a React component"

2. **Request tests** explicitly if needed:
   - ✅ "Create a function with unit tests"
   - ❌ "Create a function" (may not include tests)

3. **Specify language/framework**:
   - ✅ "Create a Next.js app using TypeScript and Tailwind"
   - ❌ "Create a web app"

## Resources

- [Original Genkit Implementation](https://github.com/a2aproject/a2a-samples/tree/main/samples/js/src/agents/coder)
- [Vercel AI SDK Streaming](https://sdk.vercel.ai/docs/ai-sdk-core/generating-text#streaming)
- [A2A Artifacts Specification](https://github.com/google-a2a/A2A)

## License

Same as parent project (Apache-2.0)

