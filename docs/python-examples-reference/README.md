# Python Examples Reference

This directory contains reference documentation for the official Python A2A sample agents. These serve as target states for building equivalent TypeScript/AI SDK implementations.

## Example Index

### Basic Examples (Implemented)
| # | Example | Framework | Description | Our Status |
|---|---------|-----------|-------------|------------|
| 01 | [Hello World](01-helloworld.md) | None | Simplest A2A agent - hardcoded response | ✅ Implemented |
| 02 | [Dice Agent](02-dice-agent.md) | Google ADK | Tool-using agent with dice rolling | ✅ Implemented |
| 03 | [Currency Agent](03-currency-agent.md) | LangGraph | Currency conversion with external API | ✅ Implemented |

### Multi-Agent Examples
| # | Example | Framework | Description | Our Status |
|---|---------|-----------|-------------|------------|
| 04 | [Airbnb Planner Multi-Agent](04-airbnb-planner-multiagent.md) | Google ADK | Dynamic routing orchestrator | ✅ Implemented |

### Tool & API Integration Examples
| # | Example | Framework | Description | Our Status |
|---|---------|-----------|-------------|------------|
| 05 | [GitHub Agent](05-github-agent.md) | OpenAI | GitHub API integration | 🔲 Not Started |
| 06 | [A2A MCP Registry](06-a2a-mcp-registry.md) | FastMCP | MCP server as A2A agent | 🔲 Not Started |
| 07 | [Analytics Agent](07-analytics-agent.md) | CrewAI | Chart generation from data | ✅ Implemented |
| 08 | [Travel Planner](08-travel-planner.md) | LangChain | Single-agent travel assistant | 🔲 Not Started |
| 09 | [LangGraph Currency](09-langgraph-currency.md) | LangGraph | Multi-turn currency conversion | 🔲 Not Started |

### Framework Showcase Examples
| # | Example | Framework | Description | Our Status |
|---|---------|-----------|-------------|------------|
| 10 | [CrewAI Image Gen](10-crewai-image-gen.md) | CrewAI | Image generation with Gemini | 🔲 Not Started |
| 11 | [Semantic Kernel Travel](11-semantic-kernel-travel.md) | Semantic Kernel | Multi-agent travel with plugins | 🔲 Not Started |
| 12 | [Marvin Contact Extractor](12-marvin-contact-extractor.md) | Marvin | Structured data extraction | 🔲 Not Started |
| 13 | [LlamaIndex File Chat](13-llamaindex-file-chat.md) | LlamaIndex | File parsing and chat with citations | 🔲 Not Started |
| 14 | [MindsDB Data Agent](14-mindsdb-data-agent.md) | MindsDB | Federated data querying | 🔲 Not Started |
| 15 | [AG2 Mypy Agent](15-ag2-mypy-agent.md) | AG2 | Code review with MCP tools | 🔲 Not Started |
| 16 | [BeeAI Chat](16-beeai-chat.md) | BeeAI | Local LLM chat agent | 🔲 Not Started |
| 17 | [Content Planner](17-content-planner.md) | Google ADK | Content outline generation | 🔲 Not Started |

### Advanced Examples
| # | Example | Framework | Description | Our Status |
|---|---------|-----------|-------------|------------|
| 18 | [Headless Agent Auth](18-headless-agent-auth.md) | Google ADK | OAuth2/CIBA authentication | 🔲 Not Started |
| 19 | [A2A Telemetry](19-a2a-telemetry.md) | Google ADK | OpenTelemetry tracing | 🔲 Not Started |
| 20 | [ADK Expense Reimbursement](20-adk-expense-reimbursement.md) | Google ADK | Web form input handling | 🔲 Not Started |
| 21 | [Number Guessing Game](21-number-guessing-game.md) | None | Multi-agent game (no LLM) | 🔲 Not Started |
| 22 | [Adversarial Multi-Agent](22-adversarial-multiagent.md) | Any-Agent | Red team vs blue team | 🔲 Not Started |
| 23 | [A2A Without Framework](23-a2a-without-framework.md) | None | Raw SDK usage | 🔲 Not Started |

## Implementation Priority

### High Priority (Core Patterns)
1. **Multi-agent orchestration** - Already done with Airbnb Planner
2. **Tool integration** - Dice, Currency agents done
3. **External API calls** - Weather, Airbnb MCP done

### Medium Priority (Framework Showcase)
- LangGraph patterns → Show AI SDK equivalents
- CrewAI patterns → Show AI SDK equivalents
- Semantic Kernel → Show AI SDK equivalents

### Lower Priority (Specialized)
- Authentication flows
- Telemetry/tracing
- File handling
- Image generation

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
All Python examples demonstrate:
- Agent Card at `/.well-known/agent-card.json`
- JSON-RPC 2.0 message format
- Task state transitions (submitted → working → completed)
- Streaming via SSE for `message/stream`
