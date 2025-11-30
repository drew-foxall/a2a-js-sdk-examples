# Python Examples Reference

This directory contains reference documentation for the official Python A2A sample agents. These serve as target states for building equivalent TypeScript/AI SDK implementations.

## Implementation Summary

**Implemented**: 17 out of 23 examples (74%)

## Example Index

### Basic Examples (All Implemented ✅)
| # | Example | Framework | Description | Our Status |
|---|---------|-----------|-------------|------------|
| 01 | [Hello World](01-helloworld.md) | None | Simplest A2A agent - hardcoded response | ✅ Implemented |
| 02 | [Dice Agent](02-dice-agent.md) | Google ADK | Tool-using agent with dice rolling | ✅ Implemented |
| 03 | [Currency Agent](03-currency-agent.md) | LangGraph | Currency conversion with external API | ✅ Implemented |

### Multi-Agent Examples (All Implemented ✅)
| # | Example | Framework | Description | Our Status |
|---|---------|-----------|-------------|------------|
| 04 | [Airbnb Planner Multi-Agent](04-airbnb-planner-multiagent.md) | Google ADK | Dynamic routing orchestrator | ✅ Implemented |

### Tool & API Integration Examples
| # | Example | Framework | Description | Our Status |
|---|---------|-----------|-------------|------------|
| 05 | [GitHub Agent](05-github-agent.md) | OpenAI | GitHub API integration | ✅ Implemented |
| 06 | [A2A MCP Registry](06-a2a-mcp-registry.md) | FastMCP | MCP server as A2A agent | ⏸️ Deferred |
| 07 | [Analytics Agent](07-analytics-agent.md) | CrewAI | Chart generation from data | ✅ Implemented |
| 08 | [Travel Planner](08-travel-planner.md) | LangChain | Single-agent travel assistant | ⏭️ Skipped (simpler than 04) |
| 09 | [LangGraph Currency](09-langgraph-currency.md) | LangGraph | Multi-turn currency conversion | ✅ Implemented |

### Framework Showcase Examples
| # | Example | Framework | Description | Our Status |
|---|---------|-----------|-------------|------------|
| 10 | [CrewAI Image Gen](10-crewai-image-gen.md) | CrewAI | Image generation with DALL-E | ✅ Implemented |
| 11 | [Semantic Kernel Travel](11-semantic-kernel-travel.md) | Semantic Kernel | Multi-agent travel with plugins | ⏭️ Skipped (covered by 04) |
| 12 | [Marvin Contact Extractor](12-marvin-contact-extractor.md) | Marvin | Structured data extraction | ✅ Implemented |
| 13 | [LlamaIndex File Chat](13-llamaindex-file-chat.md) | LlamaIndex | File parsing and chat with citations | ⏸️ Deferred (Worker limits) |
| 14 | [MindsDB Data Agent](14-mindsdb-data-agent.md) | MindsDB | Federated data querying | ⏭️ Skipped (vendor-specific) |
| 15 | [AG2 Mypy Agent](15-ag2-mypy-agent.md) | AG2 | Code review with analysis tools | ✅ Implemented |
| 16 | [BeeAI Chat](16-beeai-chat.md) | BeeAI | Local/cloud LLM chat agent | ✅ Implemented |
| 17 | [Content Planner](17-content-planner.md) | Google ADK | Content outline generation | ✅ Implemented |

### Advanced Examples
| # | Example | Framework | Description | Our Status |
|---|---------|-----------|-------------|------------|
| 18 | [Headless Agent Auth](18-headless-agent-auth.md) | Google ADK | OAuth2/CIBA authentication | ⏸️ Deferred (complex setup) |
| 19 | [A2A Telemetry](19-a2a-telemetry.md) | Google ADK | OpenTelemetry tracing | ⏸️ Deferred |
| 20 | [ADK Expense Reimbursement](20-adk-expense-reimbursement.md) | Google ADK | Expense form handling | ✅ Implemented |
| 21 | [Number Guessing Game](21-number-guessing-game.md) | None | Multi-agent game (no LLM) | ✅ Implemented |
| 22 | [Adversarial Multi-Agent](22-adversarial-multiagent.md) | Any-Agent | Red team vs blue team | ✅ Implemented |
| 23 | [A2A Without Framework](23-a2a-without-framework.md) | None | Raw SDK usage | ⏭️ Skipped (educational) |

## Status Legend

- ✅ **Implemented** - Full local agent + Cloudflare Worker
- ⏸️ **Deferred** - Technical limitations or complexity
- ⏭️ **Skipped** - Covered by other examples or vendor-specific

## Our Implementations

### Local Agents (`examples/agents/src/agents/`)

| Agent | Description | Port |
|-------|-------------|------|
| `hello-world` | Simple greeting agent | 4000 |
| `dice-agent` | Dice rolling with prime checking | 4001 |
| `currency-agent` | Currency conversion (Frankfurter API) | 4002 |
| `travel-planner-multiagent` | Multi-agent orchestrator | 4003 |
| `github-agent` | GitHub API integration | 4004 |
| `analytics-agent` | Chart generation | 4005 |
| `content-planner` | Content outline generation | 4006 |
| `contact-extractor` | Structured data extraction | 4007 |
| `expense-agent` | Expense form handling | 4008 |
| `number-game` | Multi-agent guessing game | 4009-4010 |
| `image-generator` | DALL-E image generation | 4010 |
| `code-review` | Code analysis and review | 4011 |
| `local-llm-chat` | Ollama/cloud LLM chat | 4012 |
| `adversarial` | Red team / blue team | 4013 |

### Cloudflare Workers (`examples/workers/`)

| Worker | URL Pattern |
|--------|-------------|
| `hello-world` | `a2a-hello-world.*.workers.dev` |
| `dice-agent` | `a2a-dice-agent.*.workers.dev` |
| `currency-agent` | `a2a-currency-agent.*.workers.dev` |
| `travel-planner` | `a2a-travel-planner.*.workers.dev` |
| `weather-agent` | `a2a-weather-agent.*.workers.dev` |
| `airbnb-agent` | `a2a-airbnb-agent.*.workers.dev` |
| `github-agent` | `a2a-github-agent.*.workers.dev` |
| `analytics-agent` | `a2a-analytics-agent.*.workers.dev` |
| `content-planner` | `a2a-content-planner.*.workers.dev` |
| `contact-extractor` | `a2a-contact-extractor.*.workers.dev` |
| `expense-agent` | `a2a-expense-agent.*.workers.dev` |
| `number-game-alice` | `a2a-number-game-alice.*.workers.dev` |
| `number-game-carol` | `a2a-number-game-carol.*.workers.dev` |
| `image-generator` | `a2a-image-generator.*.workers.dev` |
| `code-review` | `a2a-code-review.*.workers.dev` |
| `local-llm-chat` | `a2a-local-llm-chat.*.workers.dev` |
| `adversarial-defender` | `a2a-adversarial-defender.*.workers.dev` |

## Key Learnings from Python Examples

### Common Patterns
1. **Agent Executor Pattern**: All examples use an `AgentExecutor` class that bridges the agent logic with A2A protocol
2. **Task/Event Queue**: Responses are emitted via `EventQueue.enqueue_event()`
3. **Session Management**: Most examples track `session_id` or `context_id` for multi-turn
4. **Streaming**: Working status updates during processing

### Framework Mapping
| Python Framework | TypeScript Equivalent |
|-----------------|----------------------|
| Google ADK `LlmAgent` | AI SDK `ToolLoopAgent` |
| LangGraph `create_react_agent` | AI SDK `ToolLoopAgent` |
| CrewAI `Agent` + `Crew` | AI SDK `ToolLoopAgent` |
| Semantic Kernel `ChatCompletionAgent` | AI SDK `ToolLoopAgent` |
| Raw Python | AI SDK `generateText`/`streamText` |

### A2A Protocol Compliance
All implementations demonstrate:
- Agent Card at `/.well-known/agent-card.json`
- JSON-RPC 2.0 message format
- Task state transitions (submitted → working → completed)
- Streaming via SSE for `message/stream`
