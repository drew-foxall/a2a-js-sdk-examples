# Content Planner Agent Reference

> **Source**: `samples/python/agents/content_planner/`
> **Our Implementation**: `examples/agents/content-editor/` (similar)

## Overview

A content planning agent built with Google ADK that creates detailed content outlines from high-level descriptions. Part of a larger content creation multi-agent system.

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Client    │────►│  A2A Protocol   │────►│  ADK LlmAgent   │
│             │◄────│  (JSON-RPC)     │◄────│  (Content Plan) │
└─────────────┘     └─────────────────┘     └─────────────────┘
```

## Key Components

### 1. ADK Agent

```python
from google.adk.agents import LlmAgent

agent = LlmAgent(
    model='gemini-2.0-flash-001',
    name='content_planner',
    instruction="""You are a content planning expert.
    Given a high-level content description, create a detailed outline including:
    - Main sections and subsections
    - Key points to cover
    - Suggested word counts
    - Target audience considerations
    """,
)
```

### 2. Integration with Content Creation System

This agent is designed to work with:
- **Content Writer Agent**: Takes outline, produces draft
- **Content Editor Agent**: Reviews and refines content
- **Host Orchestrator**: Coordinates the workflow

## A2A Protocol Flow

### Request
```json
{
  "method": "message/send",
  "params": {
    "message": {
      "parts": [{
        "text": "Create a blog post about AI agents in enterprise software"
      }]
    }
  }
}
```

### Response
```json
{
  "result": {
    "artifacts": [{
      "parts": [{
        "text": "# Content Outline: AI Agents in Enterprise Software\n\n## 1. Introduction (200 words)\n- Hook: The rise of AI agents\n- Thesis: How agents transform enterprise workflows\n\n## 2. What Are AI Agents? (300 words)\n- Definition and key characteristics\n- Difference from traditional automation\n..."
      }]
    }],
    "status": { "state": "completed" }
  }
}
```

## Key Features

1. **Structured Output**: Detailed outlines with sections
2. **Audience Awareness**: Considers target readers
3. **Workflow Integration**: Part of multi-agent content pipeline
4. **Streaming**: Real-time outline generation

## Our Implementation

We have a similar `content-editor` agent that focuses on:
- Content review and editing
- Style and tone suggestions
- Grammar and clarity improvements

### Content Editor Agent

```typescript
export function createContentEditorAgent(model: LanguageModel) {
  return new ToolLoopAgent({
    model,
    instructions: `You are a professional content editor.
      Review content for:
      - Clarity and readability
      - Grammar and spelling
      - Tone and style consistency
      - Structure and flow
      Provide specific, actionable feedback.`,
  });
}
```

## Multi-Agent Content Workflow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Planner   │────►│   Writer    │────►│   Editor    │
│  (Outline)  │     │  (Draft)    │     │  (Polish)   │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Orchestrator Pattern

```typescript
// Content creation orchestrator
const contentOrchestrator = new ToolLoopAgent({
  model,
  instructions: "Coordinate content creation workflow",
  tools: {
    sendMessage: {
      description: "Send task to specialist agent",
      parameters: z.object({
        agentName: z.enum(["planner", "writer", "editor"]),
        task: z.string(),
      }),
      execute: async ({ agentName, task }) => {
        return await callA2AAgent(agentName, task);
      },
    },
  },
});
```

## Checklist for Implementation

- [x] Content editing agent (content-editor)
- [ ] Content planning agent (outline generation)
- [ ] Content writing agent (draft generation)
- [ ] Multi-agent orchestrator
- [ ] Worker deployment

## Notes

The content creation pipeline demonstrates:
- **Specialization**: Each agent has a focused role
- **Composition**: Agents work together via A2A
- **Flexibility**: Add/remove agents without code changes

Our content-editor agent provides the editing capability. A full implementation would add:
- Planner for outlines
- Writer for drafts
- Orchestrator to coordinate

