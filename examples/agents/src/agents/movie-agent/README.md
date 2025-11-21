# Movie Info Agent (AI SDK + Hono)

A high-fidelity port of the original [Genkit-based Movie Agent](https://github.com/a2aproject/a2a-samples/tree/main/examples/agents/src/agents/movie-agent) using **Vercel AI SDK** and **Hono**.

## Features

✅ **Full Feature Parity with Original**
- 🎬 TMDB API integration for movie searches
- 👤 TMDB API integration for person searches  
- 💬 Conversation history management
- 🎯 Goal metadata support
- 🔄 Multi-turn conversations
- 📊 Task state parsing (COMPLETED/AWAITING_USER_INPUT)

## What's Different from Original?

| Feature | Original (Genkit) | AI SDK Port | Notes |
|---------|------------------|-------------|-------|
| Framework | Genkit | Vercel AI SDK | Provider-agnostic |
| Web Server | Express | Hono | Faster, edge-ready |
| Tool System | `ai.defineTool()` | AI SDK tools | Simpler API |
| Prompt Format | `.prompt` files | TypeScript functions | Type-safe |
| Model Config | `gemini-2.0-flash` | Any provider | Configurable |

## Prerequisites

1. **TMDB API Key**: Get one from [TMDB Developer Portal](https://developer.themoviedb.org/docs/getting-started)
2. **LLM API Key**: One of:
   - OpenAI API Key (default)
   - Anthropic API Key
   - Google AI API Key

## Installation

```bash
# From the project root
pnpm install
```

## Running the Agent

### Quick Start

```bash
# Set your API keys
export TMDB_API_KEY=your_tmdb_key_here
export OPENAI_API_KEY=your_openai_key_here  # or ANTHROPIC_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY

# Run the agent
pnpm agents:ai-sdk-movie-agent
```

The agent will start on `http://localhost:41241`.

### Using Different AI Providers

```bash
# Use Anthropic Claude
export AI_PROVIDER=anthropic
export ANTHROPIC_API_KEY=your_key

# Use Google Gemini
export AI_PROVIDER=google
export GOOGLE_GENERATIVE_AI_API_KEY=your_key

# Use OpenAI (default)
export AI_PROVIDER=openai
export OPENAI_API_KEY=your_key

pnpm agents:ai-sdk-movie-agent
```

## Testing with A2A CLI

In a separate terminal:

```bash
pnpm a2a:cli

# Then try these queries:
> Tell me about the plot of Inception
> Who directed The Matrix?
> What other movies has Keanu Reeves been in?
> Which came out first, Jurassic Park or Terminator 2?
```

## Architecture

```
movie-info-agent/
├── index.ts          # Main agent executor with conversation history
├── tmdb.ts           # TMDB API utilities (searchMovies, searchPeople)
├── prompt.ts         # System prompt (converted from .prompt file)
└── README.md         # This file
```

### Key Implementation Details

**1. Conversation History**
```typescript
// Maintains context across turns (matches original)
const contexts: Map<string, Message[]> = new Map();
```

**2. Tool Calling**
```typescript
// AI SDK tools (equivalent to Genkit tools)
const searchMoviesTool = {
  description: "search TMDB for movies by title",
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }) => await searchMovies(query),
};
```

**3. State Parsing**
```typescript
// Parses LLM output for task states (matches original)
if (finalStateLine === "COMPLETED") {
  finalA2AState = "completed";
} else if (finalStateLine === "AWAITING_USER_INPUT") {
  finalA2AState = "input-required";
}
```

## Comparison with Original

### Original (Genkit) Implementation
```typescript
// Genkit approach
import { genkit } from "genkit";
import { googleAI } from "@genkit-ai/googleai";

const ai = genkit({
  plugins: [googleAI()],
  model: googleAI.model("gemini-2.0-flash"),
});

const movieAgentPrompt = ai.prompt('movie_agent');
const response = await movieAgentPrompt({ goal, now }, {
  messages,
  tools: [searchMovies, searchPeople]
});
```

### AI SDK Port
```typescript
// AI SDK approach
import { generateText } from "ai";

const response = await generateText({
  model: getAIModel(), // Any provider
  system: getMovieAgentPrompt(goal),
  messages,
  tools: { searchMovies, searchPeople },
  maxSteps: 10,
});
```

## API Endpoints

Once running, the agent exposes:

- **Agent Card**: `GET http://localhost:41241/.well-known/agent-card.json`
- **JSON-RPC**: `POST http://localhost:41241/`

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TMDB_API_KEY` | ✅ Yes | - | TMDB API key |
| `AI_PROVIDER` | ❌ No | `openai` | AI provider (`openai`, `anthropic`, `google`) |
| `OPENAI_API_KEY` | ⚠️ If using OpenAI | - | OpenAI API key |
| `ANTHROPIC_API_KEY` | ⚠️ If using Anthropic | - | Anthropic API key |
| `GOOGLE_GENERATIVE_AI_API_KEY` | ⚠️ If using Google | - | Google AI API key |
| `PORT` | ❌ No | `41241` | Server port |

## Example Queries

**General Movie Questions:**
- "Tell me about the plot of Inception"
- "Recommend a good sci-fi movie"
- "What are the best movies of 2024?"

**Director Queries:**
- "Who directed The Matrix?"
- "What movies has Christopher Nolan directed?"

**Actor Queries:**
- "What other movies has Scarlett Johansson been in?"
- "Find action movies starring Keanu Reeves"

**Comparison Queries:**
- "Which came out first, Jurassic Park or Terminator 2?"
- "Compare the plots of Inception and Interstellar"

## Troubleshooting

**Error: TMDB_API_KEY environment variable is required**
- Make sure to export your TMDB API key before running the agent

**Error: No API key found for provider**
- Check that you've set the correct API key for your chosen provider
- Verify the `AI_PROVIDER` environment variable matches your API key

**Slow Responses:**
- TMDB API calls may take a moment
- Tool calling requires multiple LLM round-trips
- Consider using a faster model (e.g., `gpt-4o-mini`)

## Resources

- [Original Genkit Implementation](https://github.com/a2aproject/a2a-samples/tree/main/examples/agents/src/agents/movie-agent)
- [TMDB API Documentation](https://developer.themoviedb.org/docs)
- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)
- [A2A Protocol Specification](https://github.com/google-a2a/A2A)

## License

Same as parent project (Apache-2.0)

