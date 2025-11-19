# Python to JavaScript Conversion Plan

## Overview

This document outlines the plan to convert Python agent examples from [`a2a-samples`](https://github.com/a2aproject/a2a-samples/tree/main/samples/python) to JavaScript/TypeScript equivalents using the AI SDK + Hono + A2A architecture.

## Current JavaScript Examples (Already Implemented)

✅ **Movie Agent** - TMDB API integration, tool usage, conversation history  
✅ **Coder Agent** - Streaming code generation, artifact emission  
✅ **Content Editor Agent** - Professional text editing

## Conversion Strategy

### Phase 1: Foundation Examples (Simple → Complex)

These examples establish baseline patterns and progressively demonstrate core capabilities:

#### 1. Hello World Agent ⭐ **START HERE**
- **Source**: `/samples/python/agents/helloworld/`
- **Complexity**: ⭐ (Very Simple)
- **Purpose**: Simplest possible A2A agent - baseline example
- **Features**:
  - No tools
  - Simple text response
  - Demonstrates minimal A2A integration
  - Good for testing A2A adapter pattern
- **Implementation Notes**:
  - Use `A2AAdapter` with simple agent
  - No AI SDK tools needed
  - Focus on clean A2A protocol integration
- **Priority**: **HIGH** - Foundation example

---

#### 2. Dice Agent (REST)
- **Source**: `/samples/python/agents/dice_agent_rest/`
- **Complexity**: ⭐⭐ (Simple)
- **Purpose**: Demonstrates basic tool usage
- **Features**:
  - Two simple tools: roll dice, check if number is prime
  - No external APIs
  - Simple stateless operations
- **Implementation Notes**:
  - Use AI SDK `ToolLoopAgent`
  - Define `rollDice` and `isPrime` tools
  - Good example of pure computational tools
- **Priority**: **HIGH** - Basic tool demonstration

---

### Phase 2: Real-World Utility Examples

#### 3. GitHub Agent
- **Source**: `/samples/python/agents/github-agent/`
- **Complexity**: ⭐⭐⭐ (Moderate)
- **Purpose**: Real-world API integration, developer utility
- **Features**:
  - GitHub API integration (Octokit)
  - Multiple tools: get repos, get commits, search
  - Authentication with GitHub token
  - Practical developer tool
- **Implementation Notes**:
  - Use `@octokit/rest` for GitHub API
  - Implement three tools matching Python version
  - Handle authentication via GITHUB_TOKEN env var
  - Great example of external API integration
- **Priority**: **MEDIUM** - Demonstrates API integration patterns

---

#### 4. Analytics Agent
- **Source**: `/samples/python/agents/analytics/`
- **Complexity**: ⭐⭐⭐⭐ (Moderate-Complex)
- **Purpose**: Chart generation, demonstrates image artifacts
- **Features**:
  - Parse user prompts for data
  - Generate charts using Chart.js or similar
  - Return PNG images as artifacts
  - CrewAI equivalent (multi-step workflow)
- **Implementation Notes**:
  - Use `chart.js` + `canvas` for chart generation
  - Convert chart to PNG buffer
  - Emit image artifacts via A2A
  - Similar streaming pattern to Coder Agent
- **Priority**: **MEDIUM** - Demonstrates image artifact handling

---

### Phase 3: Advanced Framework Examples

#### 5. LangGraph Currency Converter
- **Source**: `/samples/python/agents/langgraph/`
- **Complexity**: ⭐⭐⭐ (Moderate)
- **Purpose**: Multi-turn conversation, tool usage, streaming
- **Features**:
  - Currency conversion API integration
  - Multi-turn conversation handling
  - Streaming updates
  - Tool usage with external API
- **Implementation Notes**:
  - Use AI SDK `ToolLoopAgent`
  - Integrate with currency API (e.g., exchangerate-api.com)
  - Demonstrate conversation state management
  - Good comparison point to LangGraph
- **Priority**: **LOW** - Framework comparison example

---

## Comparison: Existing vs. New Examples

| Feature | Movie | Coder | Content Editor | Hello World | Dice | GitHub | Analytics | LangGraph |
|---------|-------|-------|----------------|-------------|------|--------|-----------|-----------|
| **Tools** | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Streaming** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **External API** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| **Artifacts** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Multi-turn** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| **Complexity** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |

---

## Not Converting (Overlap or Out of Scope)

### Overlap with Existing Examples
- **Content Planner** - Too similar to Content Editor
- **Expense Reimbursement** - Complex multi-turn, better as advanced example later
- **LlamaIndex File Chat** - Document parsing, different scope

### Framework-Specific (Not AI SDK)
- **CrewAI Image Generation** - Framework-specific, complex
- **Semantic Kernel Travel Agent** - Framework-specific
- **Marvin Contact Extractor** - Framework-specific
- **MindsDB Enterprise Data** - Requires MindsDB infrastructure
- **AG2** - Framework-specific
- **Azure AI Foundry** - Azure-specific
- **BeeAI** - Framework-specific

### Too Complex for Initial Conversion
- **Multi-agent systems** (Airbnb Planner, Birthday Planner, etc.)
- **Adversarial Multi-Agent**
- **Number Guessing Game** - Multi-agent coordination

### Specialized Infrastructure
- **ADK Cloud Run** - Deployment-focused
- **Headless Agent Auth** - OAuth flow, authentication focus
- **A2A MCP** - MCP integration (different protocol)
- **A2A Telemetry** - Telemetry/observability focus
- **Veo Video Gen** - Video generation, requires Google Veo API

---

## Implementation Order (Recommended)

### Sprint 1: Foundation
1. ✅ **Hello World Agent** - Validate basic A2A integration pattern
2. ✅ **Dice Agent** - Validate tool usage pattern

### Sprint 2: Real-World Utility
3. ✅ **GitHub Agent** - Validate external API integration
4. ✅ **Analytics Agent** - Validate image artifact handling

### Sprint 3: Advanced (Optional)
5. ⏸️ **LangGraph Currency Converter** - Framework comparison

---

## Technical Architecture (All New Agents)

All converted agents will follow the established architecture:

```
samples/js/src/agents/{agent-name}/
  ├── agent.ts          # Pure AI SDK ToolLoopAgent (protocol-agnostic)
  ├── index.ts          # A2A integration via A2AAdapter
  ├── tools.ts          # Tool implementations (if applicable)
  ├── prompt.ts         # System prompts
  └── README.md         # Documentation
```

### Key Patterns
- **Pure Agent Layer**: AI SDK `ToolLoopAgent` with no A2A coupling
- **A2A Adapter**: Unified `A2AAdapter` for A2A protocol integration
- **Tool Definitions**: Use `inputSchema` for Zod validation
- **Type Safety**: Strong typing with generics, avoid `any`
- **Flexible Models**: Support 8+ providers via `getModel()` utility

---

## Success Criteria

For each converted agent:
- ✅ Zero TypeScript errors
- ✅ Zero linter warnings
- ✅ Comprehensive README with usage examples
- ✅ Matches Python functionality
- ✅ Clean separation of concerns (agent vs. A2A)
- ✅ Tested with at least one LLM provider
- ✅ Demonstrates specific capability clearly

---

## Resources

- **Python Examples**: https://github.com/a2aproject/a2a-samples/tree/main/samples/python
- **A2A Protocol**: https://google.github.io/A2A/
- **AI SDK Docs**: https://sdk.vercel.ai/docs
- **A2A JS SDK**: https://github.com/drew-foxall/a2a-js

---

## Next Steps

1. **Review and approve this plan** with stakeholders
2. **Start with Hello World Agent** (Sprint 1, Item 1)
3. **Iterate and refine** adapter pattern as needed
4. **Document learnings** for each conversion
5. **Update main README** as examples are completed

