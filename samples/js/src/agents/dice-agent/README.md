# Dice Agent

An A2A agent that demonstrates tool usage with pure computational functions.

## Overview

This agent showcases **AI SDK tool integration** with two simple tools:
- 🎲 **Roll Dice** - Roll N-sided dice (any number of sides)
- 🔢 **Check Prime** - Determine which numbers are prime

## What It Does

**Capabilities:**
- Roll dice of arbitrary sizes (6-sided, 20-sided, 100-sided, etc.)
- Check if numbers are prime
- Combine operations (e.g., "roll a die and check if it's prime")
- Discuss previous rolls and outcomes

**Example Interactions:**
- "Roll a 20-sided die" → Rolls and returns result
- "Which of 7, 8, 9 are prime?" → Checks each number
- "Roll a die and check if it's prime" → Rolls, then checks result

## Architecture

```
dice-agent/
├── tools.ts    # Pure computational functions (rollDice, checkPrime)
├── agent.ts    # AI SDK ToolLoopAgent with tool definitions
├── index.ts    # A2A integration via A2AAdapter
├── prompt.ts   # System prompt with tool usage instructions
└── README.md   # This file
```

## Why This Example?

The Dice Agent is the **second foundation example** because it demonstrates:

1. **Tool Definition** - How to define tools with `inputSchema`
2. **Zod Validation** - Type-safe parameter validation
3. **Pure Functions** - Tools with no external dependencies
4. **Type Safety** - Generic types for tool parameters
5. **AI SDK Patterns** - Standard tool integration workflow

This builds on the Hello World Agent by adding **tools** while keeping complexity low (no APIs, no artifacts, no streaming).

## Quick Start

### 1. Install Dependencies

```bash
cd samples/js
pnpm install
```

### 2. Set Environment Variables

```bash
# Required: AI provider API key
export OPENAI_API_KEY=your_openai_api_key

# Optional: Change provider/model
export AI_PROVIDER=openai  # openai, anthropic, google, etc.
export AI_MODEL=gpt-4o-mini
```

### 3. Start the Agent

```bash
# From project root
pnpm agents:dice-agent

# Or from samples/js
pnpm tsx src/agents/dice-agent/index.ts
```

The agent will start on **port 41245** by default.

## Usage Examples

### Roll a Dice

```bash
curl -X POST http://localhost:41245/message/send \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "role": "user",
      "parts": [{"kind": "text", "text": "Roll a 20-sided die"}]
    }
  }'
```

### Check Prime Numbers

```bash
curl -X POST http://localhost:41245/message/send \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "role": "user",
      "parts": [{"kind": "text", "text": "Which of 7, 8, 9, 11 are prime?"}]
    }
  }'
```

### Combined Operation

```bash
curl -X POST http://localhost:41245/message/send \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "role": "user",
      "parts": [{"kind": "text", "text": "Roll a 6-sided die and check if it is prime"}]
    }
  }'
```

### Agent Card

```bash
curl http://localhost:41245/.well-known/agent-card.json
```

## Technical Details

### Tool Definitions

The agent uses AI SDK's `ToolLoopAgent` with two tools:

```typescript
{
  rollDice: {
    description: "Rolls an N-sided dice...",
    inputSchema: z.object({
      sides: z.number().int().positive().default(6),
    }),
    execute: async (params) => rollDice(params.sides),
  },
  
  checkPrime: {
    description: "Determines which numbers are prime...",
    inputSchema: z.object({
      numbers: z.array(z.number().int()),
    }),
    execute: async (params) => checkPrime(params.numbers),
  },
}
```

### Zod Schema Validation

Each tool uses Zod schemas for:
- ✅ **Type Safety** - Parameters are strongly typed
- ✅ **Runtime Validation** - Invalid inputs are caught
- ✅ **Documentation** - Schemas describe expected inputs
- ✅ **Defaults** - E.g., `sides` defaults to 6

### Pure Functions

The tool implementations are pure computational functions:
- **No I/O** - No file system, network, or database access
- **No Side Effects** - Deterministic for testing
- **No External APIs** - Self-contained logic
- **Fast Execution** - Instant responses

### Type Safety Example

```typescript
// Define schema
const rollDiceSchema = z.object({
  sides: z.number().int().positive().default(6),
});

// Infer type from schema
type RollDiceParams = z.infer<typeof rollDiceSchema>;

// Type-safe execute function
execute: async (params: RollDiceParams) => {
  return rollDice(params.sides); // params.sides is type number
}
```

### A2A Integration

Uses the unified `A2AAdapter` pattern:
```typescript
const adapter = new A2AAdapter({
  agent,
  agentCard,
  logger: console,
});
```

No special configuration needed - adapter auto-detects this is a simple agent (no artifacts).

## Comparison to Hello World

| Feature | Hello World | Dice Agent |
|---------|-------------|------------|
| Tools | ❌ None | ✅ Two tools |
| Schema Validation | ❌ N/A | ✅ Zod schemas |
| Type Safety | ✅ Basic | ✅ Advanced |
| Complexity | ⭐ Very Simple | ⭐⭐ Simple |
| Purpose | Foundation | Tool usage |

## Port

- **Default**: 41245
- **Configurable**: Edit `PORT` constant in `index.ts`

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | ✅ (or other provider) | - | API key for LLM provider |
| `AI_PROVIDER` | ❌ | `openai` | Provider: openai, anthropic, google, etc. |
| `AI_MODEL` | ❌ | `gpt-4o-mini` | Model to use |

## Learning Path

This agent teaches:

### 1. Tool Definition Pattern
```typescript
tools: {
  toolName: {
    description: "What the tool does",
    inputSchema: zodSchema,
    execute: async (params) => implementation(params),
  }
}
```

### 2. Schema-First Design
- Define Zod schema first
- Infer TypeScript type from schema
- Use type in execute function

### 3. Tool Results
- Return structured data from tools
- LLM interprets results
- Can return objects, strings, numbers

### 4. Sequential Tool Calls
- Agent can chain tools
- Example: roll dice → check if result is prime
- LLM orchestrates the workflow

## Next Steps

After understanding the Dice Agent:
1. **Movie Agent** - Adds external API integration (TMDB)
2. **GitHub Agent** - More complex API with authentication
3. **Coder Agent** - Adds streaming and artifacts
4. **Analytics Agent** - Image generation artifacts

## Learn More

- [A2A Protocol Documentation](https://google.github.io/A2A/)
- [AI SDK Documentation](https://sdk.vercel.ai/docs)
- [Zod Documentation](https://zod.dev)
- [A2A JS SDK](https://github.com/drew-foxall/a2a-js)
- [Conversion Plan](../../../../../../../PYTHON_TO_JS_CONVERSION_PLAN.md)

