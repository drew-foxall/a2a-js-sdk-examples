# Contact Extractor Agent

An AI agent that extracts structured contact information from unstructured text with multi-turn clarification for missing fields.

## Overview

The Contact Extractor agent demonstrates **structured data extraction** - a common AI pattern where:
1. User provides unstructured text containing contact info
2. Agent extracts structured fields (name, email, phone)
3. If fields are missing, agent asks clarifying questions
4. Returns standardized contact data

## Usage

### Local Development

```bash
# Start the agent
pnpm agents:contact-extractor

# Or directly
cd examples/agents && pnpm tsx src/agents/contact-extractor/index.ts
```

### API Example

```bash
# Complete information
curl -X POST http://localhost:41248/message/send \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "id": "1",
    "params": {
      "message": {
        "role": "user",
        "parts": [{"kind": "text", "text": "Contact John Doe at john@example.com, phone 555-123-4567"}]
      }
    }
  }'

# Incomplete - will ask for missing info
curl -X POST http://localhost:41248/message/send \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "id": "1",
    "params": {
      "message": {
        "role": "user",
        "parts": [{"kind": "text", "text": "My name is Sarah Jones"}]
      }
    }
  }'
```

## Extracted Fields

### Required
- **Name**: First and last name
- **Email**: Valid email address
- **Phone**: Standardized phone number

### Optional
- **Organization**: Company or organization name
- **Role**: Job title or position

## Multi-Turn Flow

```
User: "I'm John Smith, email john@example.com"
Agent: "I found John Smith's name and email. Could you please provide John's phone number?"

User: "555-123-4567"
Agent: "Contact extracted:
- Name: John Smith
- Email: john@example.com
- Phone: +1-555-123-4567
- Organization: Not provided
- Role: Not provided"
```

## Use Cases

- **CRM Data Entry**: Automate contact creation from emails/messages
- **Business Card Scanning**: Extract info from OCR'd business cards
- **Email Signature Parsing**: Pull contacts from email signatures
- **Form Pre-filling**: Extract data to populate forms

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_PROVIDER` | `openai` | LLM provider |
| `AI_MODEL` | Provider default | Model to use |
| `PORT` | `41248` | Server port |

## Agent Card

```json
{
  "name": "Contact Extractor",
  "description": "Extracts structured contact information from unstructured text",
  "skills": [{
    "id": "contact_extraction",
    "name": "Contact Extraction",
    "examples": [
      "My name is John Doe, email john@example.com, phone 555-1234"
    ]
  }]
}
```

## Implementation Pattern

This agent demonstrates the **structured extraction** pattern:

```typescript
// The LLM handles extraction via prompt engineering
// No tools needed - pure text understanding

const agent = new ToolLoopAgent({
  model,
  instructions: getContactExtractorPrompt(),
  tools: {}, // No tools - extraction via prompt
});
```

The prompt instructs the LLM to:
1. Identify contact fields in text
2. Return structured output when complete
3. Ask clarifying questions when fields are missing

## Related Agents

- **Content Planner** (`content-planner/`): Another structured output agent
- **Analytics Agent** (`analytics-agent/`): Structured data visualization

