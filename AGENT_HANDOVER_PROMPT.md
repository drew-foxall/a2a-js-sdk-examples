# 🤖 Agent Handover Prompt

Copy and paste this prompt to hand over to another AI agent:

---

## Context

I need your help completing the publication and testing of a new GitHub repository containing AI SDK + Hono examples for the a2a-js-sdk library.

## Current State

**Repository Location**: `/Users/Drew_Garratt/Development/a2a-js-sdk-examples/`

**Status**: 
- ✅ Repository created and initialized
- ✅ All code complete (3 agents: Movie Info, Coder, Content Editor)
- ✅ Comprehensive documentation written
- ✅ Git committed (commit 977e6a0, 21 files, 2810 lines)
- ⏳ NOT YET pushed to GitHub
- ⏳ NOT YET runtime tested

**Related Repository**: `/Users/Drew_Garratt/Development/a2a-js/` (main library, needs cleanup after examples are published)

## Your Tasks

### 1. Push Examples Repository to GitHub (Priority 1)

```bash
cd /Users/Drew_Garratt/Development/a2a-js-sdk-examples
git remote add origin git@github.com:drew-foxall/a2a-js-sdk-examples.git
git push -u origin main
```

**Expected**: Repository visible at `https://github.com/drew-foxall/a2a-js-sdk-examples`

### 2. Runtime Test the Examples (Priority 2)

Test each agent to verify functionality. You'll need API keys from the user:
- One LLM provider key (OpenAI, Anthropic, or Google)
- TMDB API key (for Movie Agent only)

**Test Movie Agent** (port 41241):
```bash
cd movie-agent-ai-sdk
pnpm install
export TMDB_API_KEY=xxx
export OPENAI_API_KEY=xxx
pnpm start
# Test: curl http://localhost:41241/.well-known/agent-card.json
```

**Test Coder Agent** (port 41242):
```bash
cd coder-agent-ai-sdk
pnpm install
export ANTHROPIC_API_KEY=xxx
export AI_PROVIDER=anthropic
pnpm start
```

**Test Content Editor** (port 41243):
```bash
cd content-editor-agent-ai-sdk
pnpm install
export OPENAI_API_KEY=xxx
pnpm start
```

### 3. Update Main Library Repository (Priority 3)

**Location**: `/Users/Drew_Garratt/Development/a2a-js/`

**Changes Needed**:
1. Add examples reference to README.md (after main features section):
   ```markdown
   ## 📚 Examples
   
   Comprehensive examples using AI SDK + Hono:
   👉 **[a2a-js-sdk-examples](https://github.com/drew-foxall/a2a-js-sdk-examples)**
   
   - Movie Info Agent - TMDB API integration
   - Coder Agent - Streaming code generation
   - Content Editor Agent - Professional editing
   ```

2. Remove AI SDK example directories:
   ```bash
   git rm -r src/samples/agents/ai-sdk-samples
   git rm -r src/samples/agents/ai-sdk-sample-agent
   ```

3. Remove these scripts from package.json:
   - `agents:ai-sdk-sample-agent`
   - `agents:ai-sdk-movie-agent`
   - `agents:ai-sdk-coder-agent`
   - `agents:ai-sdk-content-editor-agent`

4. Commit and push:
   ```bash
   git add -A
   git commit -m "Move AI SDK examples to separate repository"
   git push origin main
   ```

## Important Files to Review

**In Examples Repo**:
- `HANDOVER.md` - Complete handover documentation (READ THIS FIRST)
- `README.md` - Main documentation
- Each example has its own README

**In Main Repo**:
- `EXAMPLES_MIGRATION.md` - Migration rationale
- `WORK_SUMMARY.md` - Complete work summary

## Key Context

- **Why separate repos?** Enables easy upstream merges, smaller npm package, follows original a2a project pattern
- **Import paths use `.js`**: This is correct for TypeScript ES modules (even though files are `.ts`)
- **Examples use published package**: `@drew-foxall/a2a-js-sdk` (not local paths)
- **All agents have 100% feature parity** with original Genkit implementations from a2aproject/a2a-samples

## Questions for User

Before proceeding, ask:
1. Do they have the necessary API keys for testing?
2. Which AI provider do they prefer? (OpenAI, Anthropic, Google)
3. Should you create the GitHub repository if it doesn't exist?
4. Ready to remove AI SDK examples from main library repo?

## Success Criteria

- ✅ Examples repository published on GitHub
- ✅ All 3 agents tested and working
- ✅ Main library repo updated and cleaned
- ✅ Documentation accurate and complete
- ✅ Users can clone and run examples independently

## Estimated Time

1-2 hours for GitHub setup, testing, and main repo cleanup.

---

**Start by reading** `/Users/Drew_Garratt/Development/a2a-js-sdk-examples/HANDOVER.md` for complete details!

