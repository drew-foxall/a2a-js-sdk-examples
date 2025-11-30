# Content Planner Agent

An AI agent that creates detailed, actionable content outlines from high-level descriptions.

## Overview

The Content Planner agent is designed to be the first step in a content creation workflow. Given a topic or brief description, it generates a comprehensive outline that includes:

- **Title**: SEO-friendly, compelling title
- **Target Audience**: Who the content is for
- **Section Breakdown**: Hierarchical structure with key points
- **Word Count Recommendations**: Per-section length guidance
- **Notes**: Special considerations for each section

## Usage

### Local Development

```bash
# Start the agent
pnpm agents:content-planner

# Or directly
cd examples/agents && pnpm tsx src/agents/content-planner/index.ts
```

### API Example

```bash
curl -X POST http://localhost:41247/message/send \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "id": "1",
    "params": {
      "message": {
        "role": "user",
        "parts": [{"kind": "text", "text": "Create an outline for a blog post about AI agents in enterprise software"}]
      }
    }
  }'
```

## Multi-Agent Content Workflow

This agent is designed to work in a content creation pipeline:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Planner   │────►│   Writer    │────►│   Editor    │
│  (Outline)  │     │  (Draft)    │     │  (Polish)   │
└─────────────┘     └─────────────┘     └─────────────┘
```

1. **Content Planner**: Creates the outline (this agent)
2. **Content Writer**: Takes outline, produces draft (future)
3. **Content Editor**: Reviews and polishes (existing)

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_PROVIDER` | `openai` | LLM provider |
| `AI_MODEL` | Provider default | Model to use |
| `PORT` | `41247` | Server port |

## Agent Card

```json
{
  "name": "Content Planner",
  "description": "Creates detailed content outlines from high-level descriptions",
  "skills": [{
    "id": "content_planning",
    "name": "Content Planning",
    "examples": [
      "Create an outline for a blog post about AI agents",
      "Plan a tutorial on building REST APIs"
    ]
  }]
}
```

## Related Agents

- **Content Editor** (`content-editor/`): Reviews and improves content
- **Coder** (`coder/`): Generates code examples for technical content

