# Expense Agent

An AI agent that processes expense reimbursement requests with multi-turn data collection and validation.

## Overview

The Expense Agent demonstrates **form-like data collection** through conversation:
1. User describes an expense in natural language
2. Agent extracts structured expense details
3. If fields are missing, agent asks for them
4. When complete, agent submits and returns a reference number

## Usage

### Local Development

```bash
# Start the agent
pnpm agents:expense-agent

# Or directly
cd examples/agents && pnpm tsx src/agents/expense-agent/index.ts
```

### API Example

```bash
# Complete expense
curl -X POST http://localhost:41249/message/send \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "id": "1",
    "params": {
      "message": {
        "role": "user",
        "parts": [{"kind": "text", "text": "Submit $50 for team lunch on 2024-01-15"}]
      }
    }
  }'

# Incomplete - will ask for missing info
curl -X POST http://localhost:41249/message/send \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "id": "1",
    "params": {
      "message": {
        "role": "user",
        "parts": [{"kind": "text", "text": "I spent $200 on travel"}]
      }
    }
  }'
```

## Expense Fields

### Required
- **Expense Type**: travel, meals, supplies, equipment, other
- **Amount**: Dollar amount (positive number)
- **Date**: When the expense occurred (YYYY-MM-DD)

### Optional
- **Description**: Brief description of the expense
- **Receipt**: Whether a receipt is attached

## Multi-Turn Flow

```
User: "I spent $200 on travel"
Agent: "I found: Amount ($200), Type (travel)
To complete your submission, please provide:
- Date: The exact date (e.g., 2024-01-15)"

User: "It was on January 10th"
Agent: "✅ Expense Submitted Successfully!
Reference: EXP-20240110-A7B
Details:
- Type: travel
- Amount: $200.00
- Date: 2024-01-10
..."
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_PROVIDER` | `openai` | LLM provider |
| `AI_MODEL` | Provider default | Model to use |
| `PORT` | `41249` | Server port |

## Implementation Pattern

This agent uses a **tool-based approach** for expense submission:

```typescript
const agent = new ToolLoopAgent({
  model,
  instructions: getExpenseAgentPrompt(),
  tools: {
    submit_expense: {
      description: "Submit an expense for reimbursement",
      inputSchema: expenseSchema,
      execute: async (params) => {
        // Validate and submit
        const reference = generateReferenceNumber(params.date);
        return { success: true, reference };
      },
    },
  },
});
```

The LLM decides when to call the tool based on whether all required information is available.

## Use Cases

- **Corporate Expense Reporting**: Automate expense submission
- **Travel Reimbursement**: Process travel-related expenses
- **Receipt Processing**: Categorize and submit receipts
- **Budget Tracking**: Capture expenses for budget analysis

## Related Agents

- **Contact Extractor** (`contact-extractor/`): Similar multi-turn extraction pattern
- **Content Planner** (`content-planner/`): Another structured output agent

