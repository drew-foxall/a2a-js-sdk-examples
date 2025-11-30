# Analytics Agent Reference

> **Source**: `samples/python/agents/analytics/`
> **Our Implementation**: `examples/agents/analytics-agent/`

## Overview

A chart generation agent that creates bar charts from user prompts using CrewAI, pandas, and matplotlib. Demonstrates image artifact handling in A2A.

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Client    │────►│  A2A Protocol   │────►│  CrewAI Agent   │
│             │◄────│  (JSON-RPC)     │◄────│  (Chart Gen)    │
└─────────────┘     └─────────────────┘     └────────┬────────┘
                                                     │
                                              ┌──────┴──────┐
                                              │    Tools    │
                                              ├─────────────┤
                                              │ ChartGen    │
                                              │ (matplotlib)│
                                              └─────────────┘
```

## Key Components

### 1. CrewAI Agent Setup

```python
self.chart_creator_agent = Agent(
    role='Chart Creation Expert',
    goal='Generate a bar chart image based on structured CSV input.',
    backstory='You are a data visualization expert...',
    verbose=False,
    allow_delegation=False,
    tools=[generate_chart_tool],
)
```

### 2. Chart Generation Tool

```python
@tool('ChartGenerationTool')
def generate_chart_tool(prompt: str, session_id: str) -> str:
    """Generates a bar chart image from CSV-like input using matplotlib."""
    # Parse CSV-like input
    df = pd.read_csv(StringIO(prompt))
    df.columns = ['Category', 'Value']
    
    # Generate bar chart
    fig, ax = plt.subplots()
    ax.bar(df['Category'], df['Value'])
    
    # Save to buffer and encode
    buf = BytesIO()
    plt.savefig(buf, format='png')
    image_bytes = buf.read()
    
    # Cache and return ID
    data = Imagedata(
        bytes=base64.b64encode(image_bytes).decode('utf-8'),
        mime_type='image/png',
        id=uuid4().hex,
    )
    cache.set(session_id, {data.id: data})
    return data.id
```

### 3. Image Artifact Handling

The agent returns image artifacts via A2A:
- Images are base64 encoded
- Cached by session ID for retrieval
- Returned as PNG with proper MIME type

## A2A Protocol Flow

### Request
```json
{
  "jsonrpc": "2.0",
  "method": "message/send",
  "params": {
    "message": {
      "role": "user",
      "parts": [{"type": "text", "text": "Generate chart: Jan,1000 Feb,2000 Mar,1500"}]
    }
  }
}
```

### Response with Image Artifact
```json
{
  "result": {
    "artifacts": [{
      "parts": [{
        "type": "file",
        "file": {
          "bytes": "<base64-encoded-png>",
          "mimeType": "image/png",
          "name": "generated_chart.png"
        }
      }]
    }],
    "status": { "state": "completed" }
  }
}
```

## Our TypeScript Implementation

### Key Differences

| Aspect | Python (CrewAI) | Our TypeScript (AI SDK) |
|--------|-----------------|-------------------------|
| Framework | CrewAI Agent + Crew | AI SDK ToolLoopAgent |
| Chart Library | matplotlib | Chart.js / D3.js |
| Image Handling | Base64 in cache | Base64 artifact |
| Streaming | Not supported (CrewAI limitation) | Supported |

### Implementation Notes

Our analytics agent focuses on:
1. **Data parsing** - Convert natural language to structured data
2. **Chart generation** - Create visual representations
3. **Artifact return** - Return images via A2A protocol

## Checklist for Implementation

- [x] Agent Card with chart skill
- [x] Basic message handling
- [x] Streaming support
- [x] Worker deployment (`workers/analytics-agent/`)
- [ ] Full matplotlib-equivalent chart generation (deferred - complex in Workers)
- [ ] Image artifact return (deferred - binary handling)
- [ ] Session-based caching (deferred)

## Cloudflare Worker Considerations

For a Cloudflare Worker version:
- Use canvas libraries compatible with Workers (e.g., `@napi-rs/canvas`)
- Consider server-side chart rendering services
- Handle binary data carefully in Workers environment

**Note**: Our current implementation focuses on text-based chart descriptions rather than
actual image generation due to Workers limitations with canvas libraries.

