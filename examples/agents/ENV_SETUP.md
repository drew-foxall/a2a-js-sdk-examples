# Environment Variable Setup

## Overview

Each agent can have its own `.env` file for API keys and configuration. Agent-specific `.env` files take precedence over the root `.env` file.

## Priority Order

1. **Agent-specific `.env`** (e.g., `src/agents/hello-world/.env`)
2. **Root `.env`** (e.g., `../../.env` from `examples/agents/`)
3. **System environment variables**

## Setup Options

### Option 1: Root `.env` (Shared Configuration)

Create a `.env` file in the repository root:

```bash
# /Users/Drew_Garratt/Development/a2a-js-sdk-examples/.env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=...
GITHUB_TOKEN=ghp_...
TMDB_API_KEY=...
```

All agents will use these keys.

### Option 2: Agent-Specific `.env` (Per-Agent Configuration)

Create a `.env` file in each agent's directory:

```bash
# examples/agents/src/agents/hello-world/.env
OPENAI_API_KEY=sk-proj-hello-world-key...

# examples/agents/src/agents/github-agent/.env
OPENAI_API_KEY=sk-proj-github-key...
GITHUB_TOKEN=ghp_github_specific_token...
```

Agent-specific values override root values.

### Option 3: Hybrid (Shared + Agent-Specific)

Use root `.env` for common keys, and agent `.env` for overrides:

```bash
# Root .env (shared)
OPENAI_API_KEY=sk-proj-default...

# examples/agents/src/agents/movie-agent/.env (override)
OPENAI_API_KEY=sk-proj-movie-specific...
TMDB_API_KEY=tmdb-specific-key...
```

## Required API Keys

### Core (Required for Most Agents)
- `OPENAI_API_KEY` - OpenAI API key (default model provider)

### Optional (Agent-Specific)
- `ANTHROPIC_API_KEY` - For Claude models
- `GOOGLE_GENERATIVE_AI_API_KEY` - For Gemini models
- `GITHUB_TOKEN` - For GitHub Agent
- `TMDB_API_KEY` - For Movie Agent

## Model Selection

You can override the default model in your `.env`:

```bash
# Use Claude instead of GPT-4
MODEL_PROVIDER=anthropic
MODEL_ID=claude-3-5-sonnet-20241022

# Use Gemini
MODEL_PROVIDER=google
MODEL_ID=gemini-2.0-flash-thinking-exp-1219
```

## Implementation

Each agent loads environment variables at startup using `loadEnv()`:

```typescript
// At the top of each agent's index.ts
import { loadEnv } from "../../shared/load-env";
loadEnv(import.meta.url);
```

This automatically:
1. Loads the root `.env` (if exists)
2. Loads the agent's `.env` (if exists, overriding root values)
3. Logs which files were loaded

## Security

⚠️ **Never commit `.env` files to version control!**

The `.gitignore` already excludes `.env` files:
```gitignore
.env
.env.local
.env.*.local
```



