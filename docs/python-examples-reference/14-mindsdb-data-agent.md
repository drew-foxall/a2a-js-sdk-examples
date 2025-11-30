# MindsDB Data Agent Reference

> **Source**: `samples/python/agents/mindsdb/`
> **Our Implementation**: Not planned (requires MindsDB infrastructure)

## Overview

An enterprise data agent powered by MindsDB that can query and analyze data across federated data sources including databases, data lakes, and SaaS applications using natural language.

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Client    │────►│  A2A Protocol   │────►│  MindsDB Mind   │
│             │◄────│  (JSON-RPC)     │◄────│  (AI + SQL)     │
└─────────────┘     └─────────────────┘     └────────┬────────┘
                                                     │
                                         ┌───────────┼───────────┐
                                         │           │           │
                                    ┌────▼────┐ ┌────▼────┐ ┌────▼────┐
                                    │Databases│ │Data Lake│ │  SaaS   │
                                    │         │ │         │ │  Apps   │
                                    └─────────┘ └─────────┘ └─────────┘
```

## Key Components

### 1. MindsDB Mind

A "Mind" is MindsDB's AI model that can query data from connected sources:

```python
# Configuration
MINDS_API_KEY=your_mindsdb_api_key
MIND_NAME=Sales_Data_Expert_Demo_Mind
```

### 2. Natural Language to SQL

The agent translates natural language queries into SQL:

**User**: "What percentage of prospects are executives?"

**Agent** (internally):
```sql
SELECT 
  COUNT(CASE WHEN role = 'Executive' THEN 1 END) * 100.0 / COUNT(*) 
FROM prospects;
```

**Response**: "23% of prospects are executives."

## A2A Protocol Flow

### Request
```json
{
  "method": "message/send",
  "params": {
    "message": {
      "parts": [{"text": "What is the distribution of companies by size?"}]
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
        "text": "Company size distribution:\n- Small: 45%\n- Medium: 35%\n- Enterprise: 20%"
      }]
    }],
    "status": { "state": "completed" }
  }
}
```

## Key Features

1. **Data Federation**: Query across multiple sources
2. **Natural Language**: No SQL knowledge required
3. **AI-Powered**: Uses Gemini for query understanding
4. **Enterprise Ready**: Connects to real business data

## Use Cases

- Business intelligence queries
- Sales pipeline analysis
- Customer data exploration
- Cross-system reporting

## TypeScript Implementation Considerations

### Why Not Implement

This example is tightly coupled to MindsDB infrastructure:
- Requires MindsDB account and API
- Needs pre-configured data connections
- Mind models are MindsDB-specific

### Alternative Approaches

For similar functionality without MindsDB:

1. **Direct Database Agent**
```typescript
const queryDatabase = tool({
  description: "Query the database with SQL",
  parameters: z.object({
    query: z.string().describe("SQL query to execute"),
  }),
  execute: async ({ query }) => {
    // Validate query (prevent SQL injection)
    const result = await db.query(query);
    return result;
  },
});
```

2. **Text-to-SQL with AI SDK**
```typescript
const generateAndExecuteQuery = async (naturalLanguage: string) => {
  // Generate SQL from natural language
  const { text: sql } = await generateText({
    model,
    system: `You are a SQL expert. Generate SQL for: ${schema}`,
    prompt: naturalLanguage,
  });
  
  // Execute and return results
  const result = await db.query(sql);
  return formatResults(result);
};
```

## Checklist for Implementation

- [ ] Not planned - requires MindsDB infrastructure

## Notes

This example demonstrates the value of specialized data platforms. For our purposes:

- Use direct database connections if needed
- Consider Cloudflare D1 for SQL in Workers
- Implement text-to-SQL with AI SDK if required

The pattern of "natural language → structured query → data" is valuable, but the implementation depends heavily on your data infrastructure.

