# ADK Expense Reimbursement Agent Reference

> **Source**: `samples/python/agents/adk_expense_reimbursement/`
> **Our Implementation**: `examples/agents/expense-agent/` + `examples/workers/expense-agent/` ✅

## Overview

An expense reimbursement agent built with Google ADK that demonstrates web form input handling in A2A. When details are missing, the agent returns a structured form for the client to fill out.

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Client    │────►│  A2A Protocol   │────►│  ADK Agent      │
│  (+ Form)   │◄────│  (JSON-RPC)     │◄────│  (Expense)      │
└─────────────┘     └─────────────────┘     └─────────────────┘
```

## Key Components

### 1. Form Schema Definition

```python
expense_form = {
    "type": "object",
    "properties": {
        "expense_type": {
            "type": "string",
            "enum": ["travel", "meals", "supplies", "other"],
            "description": "Type of expense"
        },
        "amount": {
            "type": "number",
            "description": "Amount in USD"
        },
        "date": {
            "type": "string",
            "format": "date",
            "description": "Date of expense"
        },
        "description": {
            "type": "string",
            "description": "Brief description"
        },
        "receipt_attached": {
            "type": "boolean",
            "description": "Is receipt attached?"
        }
    },
    "required": ["expense_type", "amount", "date"]
}
```

### 2. Agent with Form Response

```python
class ExpenseAgent:
    async def process(self, request: str, form_data: dict = None):
        if form_data:
            # Process completed form
            return self.submit_expense(form_data)
        
        # Check if request has enough info
        parsed = self.parse_request(request)
        
        if parsed.is_complete:
            return self.submit_expense(parsed.data)
        
        # Return form for missing fields
        return {
            "status": "input-required",
            "form": {
                "schema": expense_form,
                "prefilled": parsed.partial_data,
            }
        }
```

## A2A Protocol Flow

### Initial Request (Incomplete)
```json
{
  "method": "message/send",
  "params": {
    "message": {
      "parts": [{"text": "Submit expense for $50 lunch"}]
    }
  }
}
```

### Response with Form
```json
{
  "result": {
    "status": {
      "state": "input-required",
      "message": {
        "parts": [{
          "type": "form",
          "form": {
            "schema": {
              "type": "object",
              "properties": {
                "expense_type": {"type": "string", "enum": ["travel", "meals", "supplies"]},
                "amount": {"type": "number"},
                "date": {"type": "string", "format": "date"},
                "description": {"type": "string"}
              },
              "required": ["expense_type", "amount", "date"]
            },
            "data": {
              "expense_type": "meals",
              "amount": 50,
              "description": "lunch"
            }
          }
        }]
      }
    }
  }
}
```

### Follow-up with Form Data
```json
{
  "method": "message/send",
  "params": {
    "message": {
      "contextId": "task-123",
      "parts": [{
        "type": "form",
        "form": {
          "data": {
            "expense_type": "meals",
            "amount": 50,
            "date": "2024-01-15",
            "description": "Team lunch",
            "receipt_attached": true
          }
        }
      }]
    }
  }
}
```

### Completed Response
```json
{
  "result": {
    "artifacts": [{
      "parts": [{
        "text": "Expense submitted successfully. Reference: EXP-2024-001"
      }]
    }],
    "status": { "state": "completed" }
  }
}
```

## Key Features

1. **Form Schema**: JSON Schema for structured input
2. **Prefilled Data**: Partial data from natural language
3. **Validation**: Schema-based input validation
4. **Multi-turn**: Form completion across messages

## TypeScript Implementation Approach

### Form Schema with Zod

```typescript
const expenseSchema = z.object({
  expense_type: z.enum(["travel", "meals", "supplies", "other"]),
  amount: z.number().positive(),
  date: z.string().date(),
  description: z.string().optional(),
  receipt_attached: z.boolean().default(false),
});

type ExpenseForm = z.infer<typeof expenseSchema>;
```

### Agent with Form Handling

```typescript
const expenseAgent = new ToolLoopAgent({
  model,
  instructions: `You process expense reimbursement requests.
    Extract expense details from user messages.
    If information is missing, ask for it via form.`,
  tools: {
    submit_expense: tool({
      description: "Submit an expense for reimbursement",
      parameters: expenseSchema,
      execute: async (expense) => {
        const id = await submitToSystem(expense);
        return { success: true, reference: id };
      },
    }),
  },
});
```

### Form Part in Response

```typescript
// Custom form response
const formResponse = {
  type: "form",
  form: {
    schema: zodToJsonSchema(expenseSchema),
    data: partialData,
  },
};

// Include in A2A response
await eventQueue.enqueue({
  status: {
    state: "input-required",
    message: {
      parts: [formResponse],
    },
  },
});
```

## Challenges

1. **Form Rendering**: Client must support form parts
2. **Schema Compatibility**: JSON Schema vs Zod
3. **Validation**: Server-side validation of form data

## Checklist for Implementation

- [x] Expense form schema (Zod)
- [x] Natural language parsing (via LLM)
- [x] Multi-turn data collection
- [x] Validation and submission (via tool)
- [x] Reference number generation
- [x] Local agent (`agents/expense-agent/`)
- [x] Worker deployment (`workers/expense-agent/`)
- [ ] Explicit form part response (advanced A2A feature)

## Notes

This pattern is useful for:
- Data collection workflows
- Structured input requirements
- Progressive disclosure of fields
- Integration with business systems

The key insight is using A2A's flexibility to return structured forms when natural language input is insufficient.

