# Marvin Contact Extractor Agent Reference

> **Source**: `samples/python/agents/marvin/`
> **Our Implementation**: `examples/agents/contact-extractor/` + `examples/workers/contact-extractor/` ✅

## Overview

A structured data extraction agent using the Marvin framework. Extracts contact information (name, email, phone, etc.) from unstructured text using multi-turn conversations to gather required fields.

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Client    │────►│  A2A Protocol   │────►│  Marvin Agent   │
│             │◄────│  (JSON-RPC)     │◄────│  (Extraction)   │
└─────────────┘     └─────────────────┘     └─────────────────┘
```

## Key Components

### 1. Contact Info Schema

```python
class ContactInfo(BaseModel):
    name: str = Field(description="Person's first and last name")
    email: EmailStr
    phone: str = Field(description="standardized phone number")
    organization: str | None = Field(None, description="org if mentioned")
    role: str | None = Field(None, description="title or role if mentioned")
```

### 2. Extraction Outcome

```python
class ExtractionOutcome[T](BaseModel):
    extracted_data: T
    summary: str = Field(description="summary of the extracted information")

ClarifyingQuestion = Annotated[
    str, Field(description="A clarifying question to ask the user")
]
```

### 3. Marvin Agent

```python
class ExtractorAgent[T]:
    async def invoke(self, query: str, sessionId: str) -> dict[str, Any]:
        result = await marvin.run_async(
            query,
            context={
                "your personality": self.instructions,
                "reminder": "Use your memory to help fill out the form",
            },
            thread=marvin.Thread(id=sessionId),
            result_type=ExtractionOutcome[self.result_type] | ClarifyingQuestion,
        )
        
        if isinstance(result, ExtractionOutcome):
            return {
                "is_task_complete": True,
                "text_parts": [_to_text_part(result.summary)],
                "data": result.extracted_data.model_dump(),
            }
        else:
            # Clarifying question needed
            return {
                "is_task_complete": False,
                "require_user_input": True,
                "text_parts": [_to_text_part(result)],
            }
```

## A2A Protocol Flow

### Initial Request (Incomplete)
```json
{
  "method": "message/send",
  "params": {
    "message": {
      "parts": [{"text": "My name is John Doe"}]
    }
  }
}
```

### Response (Input Required)
```json
{
  "result": {
    "status": {
      "state": "input-required",
      "message": {
        "parts": [{"text": "What is John Doe's email address?"}]
      }
    }
  }
}
```

### Follow-up with Email
```json
{
  "method": "message/send",
  "params": {
    "message": {
      "contextId": "session-123",
      "parts": [{"text": "john.doe@example.com, phone 555-1234"}]
    }
  }
}
```

### Completed with Structured Data
```json
{
  "result": {
    "artifacts": [{
      "parts": [
        {"type": "text", "text": "Contact extracted: John Doe..."},
        {"type": "data", "data": {
          "name": "John Doe",
          "email": "john.doe@example.com",
          "phone": "+1-555-1234"
        }}
      ]
    }],
    "status": { "state": "completed" }
  }
}
```

## Key Features

1. **Structured Extraction**: Pydantic models define expected output
2. **Multi-turn Gathering**: Asks clarifying questions for missing fields
3. **Union Types**: Returns either extracted data OR a question
4. **Session Memory**: Marvin Thread maintains context

## TypeScript Implementation Approach

### Using AI SDK Structured Output

```typescript
const contactSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  phone: z.string(),
  organization: z.string().optional(),
  role: z.string().optional(),
});

const extractionResult = z.union([
  z.object({
    type: z.literal("complete"),
    data: contactSchema,
    summary: z.string(),
  }),
  z.object({
    type: z.literal("question"),
    question: z.string(),
  }),
]);

async function extractContact(text: string, history: Message[]) {
  const result = await generateObject({
    model,
    schema: extractionResult,
    prompt: `Extract contact info from: ${text}`,
    messages: history,
  });
  
  return result.object;
}
```

### Key Differences

| Aspect | Marvin | AI SDK |
|--------|--------|--------|
| Extraction | `marvin.run_async` | `generateObject` |
| Schema | Pydantic | Zod |
| Union Types | Python typing | Zod discriminated union |
| Memory | Marvin Thread | Manual history |

## Checklist for Implementation

- [x] Contact info extraction via prompt engineering
- [x] Multi-turn conversation handling (asks for missing fields)
- [x] Local agent (`agents/contact-extractor/`)
- [x] Worker deployment (`workers/contact-extractor/`)
- [ ] Zod schema validation for extracted data
- [ ] Explicit `input-required` state in A2A response
- [ ] Data part in artifacts (structured JSON)

## Use Cases

- CRM data entry automation
- Business card scanning
- Email signature parsing
- Form pre-filling

## Notes

This pattern is valuable for any structured data extraction task:
- Invoice parsing
- Resume/CV extraction
- Event details from text
- Address normalization

The key insight is using union types to let the LLM decide whether it has enough information or needs to ask a question.

