# Analytics Agent

> **Python Equivalent**: [`analytics`](https://github.com/a2aproject/a2a-samples/tree/main/samples/python/agents/analytics)  
> JavaScript implementation generating charts as PNG artifacts using Chart.js.

An A2A agent that demonstrates chart generation and image artifact streaming.

## Overview

This agent showcases **image artifact generation** with streaming:
- 📊 **Chart Generation** - Create bar charts from natural language
- 🖼️ **Image Artifacts** - PNG output streamed to clients
- 📈 **Data Parsing** - Multiple input formats (CSV, key:value, etc.)
- ⚡ **Streaming** - Real-time artifact emission via A2A protocol

## What It Does

**Capabilities:**
- Parse data from natural language prompts
- Generate bar charts using Chart.js
- Return charts as PNG image artifacts
- Support multiple data input formats

**Example Interactions:**
- "Generate a chart of revenue: Jan,$1000 Feb,$2000 Mar,$1500" → Bar chart PNG
- "Create a chart: A:100, B:200, C:300" → Bar chart PNG
- "Make a chart showing Q1,5000 Q2,7000 Q3,6500" → Bar chart PNG

## Architecture

```
analytics-agent/
├── tools.ts    # Chart generation (Chart.js + canvas, data parsing)
├── agent.ts    # AI SDK ToolLoopAgent (no tools, text only)
├── index.ts    # A2A integration with parseArtifacts
├── prompt.ts   # System prompt
└── README.md   # This file
```

## Why This Example?

The Analytics Agent is the **second artifact example** (after Coder Agent) because it demonstrates:

1. **Image Generation** - Server-side chart rendering with Chart.js + canvas
2. **Artifact Streaming** - PNG images emitted via TaskArtifactUpdateEvent
3. **Data Parsing** - Extract structured data from natural language
4. **Visual Output** - Non-text artifacts (images)
5. **Automatic Adapter Mode** - parseArtifacts triggers streaming automatically

This builds on previous examples by adding **image generation** and demonstrates how artifacts aren't limited to text/code files.

## Quick Start

### 1. Install Dependencies

```bash
cd examples/agents
pnpm install  # Installs chart.js and canvas
```

**Note**: The `canvas` package requires native dependencies. On macOS, you may need:
```bash
brew install pkg-config cairo pango libpng jpeg giflib librsvg pixman
```

### 2. Set Environment Variables

```bash
# Required: AI provider API key
export OPENAI_API_KEY=your_openai_api_key

# Optional: Change AI provider/model
export AI_PROVIDER=openai
export AI_MODEL=gpt-4o-mini
```

### 3. Start the Agent

```bash
# From project root
pnpm agents:analytics-agent

# Or from examples/agents
pnpm tsx src/agents/analytics-agent/index.ts
```

The agent will start on **port 41247** by default.

## Usage Examples

### Generate Revenue Chart

```bash
curl -X POST http://localhost:41247/message/send \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "role": "user",
      "parts": [{"kind": "text", "text": "Generate a chart of revenue: Jan,$1000 Feb,$2000 Mar,$1500"}]
    }
  }'
```

### Simple Bar Chart

```bash
curl -X POST http://localhost:41247/message/send \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "role": "user",
      "parts": [{"kind": "text", "text": "Create a chart: A:100, B:200, C:300"}]
    }
  }'
```

### Quarterly Sales Chart

```bash
curl -X POST http://localhost:41247/message/send \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "role": "user",
      "parts": [{"kind": "text", "text": "Make a bar chart showing sales: Q1,5000 Q2,7000 Q3,6500 Q4,8000"}]
    }
  }'
```

### Agent Card

```bash
curl http://localhost:41247/.well-known/agent-card.json
```

## Technical Details

### Chart Generation Stack

**Technologies:**
- **Chart.js** - Chart rendering library
- **node-canvas** - Server-side Canvas API implementation
- **PNG Encoding** - Base64 output for A2A artifacts

### Supported Data Formats

#### Format 1: Key-Value with Colons
```
"Jan:1000 Feb:2000 Mar:1500"
```

#### Format 2: Key-Value with Dollar Signs
```
"Jan,$1000 Feb,$2000 Mar,$1500"
```

#### Format 3: CSV Format
```
Category,Value
Jan,1000
Feb,2000
Mar,1500
```

#### Format 4: Comma Separated
```
"Jan,1000 Feb,2000 Mar,1500"
```

### Data Parsing

The `parseChartData()` function handles multiple formats:

```typescript
export function parseChartData(prompt: string): ChartData {
  // Remove common prefixes
  // Match patterns like "Jan:1000", "Jan,$1000", "Jan,1000"
  // Fallback to CSV parsing
  
  return { labels, values };
}
```

### Chart Generation

```typescript
export async function generateBarChart(
  data: ChartData,
  title: string = "Bar Chart"
): Promise<ChartResult> {
  // Create 800x600 canvas
  // Configure Chart.js with bar chart
  // Render to PNG buffer
  // Encode as base64
  
  return { id, name, mimeType, data, base64 };
}
```

### Artifact Streaming Pattern

The Analytics Agent can use the **parseArtifacts** pattern in the A2A adapter (stream mode):

```typescript
import { A2AAdapter } from "@drew-foxall/a2a-ai-sdk-adapter";

const adapter = new A2AAdapter(agent, {
  mode: "stream",
  workingMessage: "Generating chart...",
  // STREAM MODE ONLY: parse artifacts from accumulated text
  parseArtifacts: (accumulatedText) => extractCharts(accumulatedText),
  // OPTIONAL: generate artifacts after completion (async)
  generateArtifacts: async ({ responseText, taskId, contextId }) => {
    const chart = await generateChartFromPrompt(responseText);
    return [
      {
        artifactId: chart.id,
        name: chart.name,
        parts: [{ kind: "text" as const, text: chart.base64 }],
      },
    ];
  },
});
```

**How it works:**
1. User sends prompt with chart data
2. Agent generates text response describing the chart
3. **Adapter calls parseArtifacts** with original prompt
4. Chart is generated from prompt data
5. **TaskArtifactUpdateEvent** emitted with PNG
6. Client receives both text and image artifact

### Mode selection

The adapter uses an explicit `mode`:
- `mode: "stream"` for streaming text + incremental artifact parsing
- `mode: "generate"` for a single awaited response

### Chart Configuration

Default chart settings:
- **Type**: Bar chart
- **Size**: 800x600 pixels
- **Background**: Transparent
- **Colors**: Blue bars (rgba(54, 162, 235))
- **Y-Axis**: Starts at zero
- **Legend**: Hidden

### Error Handling

The agent gracefully handles:
- **Invalid Data Format** - Returns error if data can't be parsed
- **Empty Data** - Returns error if no valid data found
- **Chart Rendering Errors** - Caught and logged
- **Canvas Errors** - Native dependency issues

### Artifact Structure

```typescript
interface Artifact {
  artifactId: string;        // "chart-1234567890-abc123"
  name: string;              // "generated_chart.png"
  mimeType: string;          // "image/png"
  data: string;              // Base64-encoded PNG
}
```

## Comparison to Coder Agent

Both agents use artifact streaming but differ in purpose:

| Feature | Analytics Agent | Coder Agent |
|---------|-----------------|-------------|
| **Artifacts** | ✅ Images (PNG) | ✅ Code Files |
| **Streaming** | ✅ Yes | ✅ Yes |
| **parseArtifacts** | ✅ Chart from prompt | ✅ Code from response |
| **Tools** | ❌ None | ❌ None |
| **Output** | 🖼️ Visual (charts) | 📄 Text (code) |
| **Use Case** | Data visualization | Code generation |

**Key Difference**: Analytics parses artifacts from the **input prompt**, while Coder parses from the **output response**.

## Comparison to Other Agents

| Feature | Hello | Dice | GitHub | Analytics |
|---------|-------|------|--------|-----------|
| Tools | ❌ | ✅ | ✅ | ❌ |
| External API | ❌ | ❌ | ✅ | ❌ |
| Artifacts | ❌ | ❌ | ❌ | ✅ |
| Streaming | ❌ | ❌ | ❌ | ✅ |
| Image Output | ❌ | ❌ | ❌ | ✅ |
| Complexity | ⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |

## Port

- **Default**: 41247
- **Configurable**: Edit `PORT` constant in `index.ts`

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | ✅ (or other provider) | - | API key for LLM provider |
| `AI_PROVIDER` | ❌ | `openai` | Provider: openai, anthropic, google, etc. |
| `AI_MODEL` | ❌ | `gpt-4o-mini` | Model to use |

## Learning Path

This agent teaches:

### 1. Server-Side Image Generation
- Use Chart.js with node-canvas
- Render charts on the server
- Convert to PNG buffers

### 2. Data Parsing Strategies
```typescript
// Flexible parsing for multiple formats
function parseChartData(prompt: string) {
  // Try format 1: key:value
  // Try format 2: key,$value
  // Try format 3: CSV
  // Return structured data
}
```

### 3. Artifact Streaming
- Configure `parseArtifacts` function
- Adapter handles TaskArtifactUpdateEvent emission
- Client receives artifacts in real-time

### 4. Automatic Mode Detection
- No manual mode selection
- `parseArtifacts` presence triggers streaming
- Configuration determines behavior

## Troubleshooting

### Canvas Installation Errors
```
Error: Canvas.node was compiled against a different Node.js version
```
**Solution**: Rebuild canvas for your Node.js version:
```bash
cd examples/agents
pnpm rebuild canvas
```

### Missing Native Dependencies (macOS)
```
Error: Package cairo was not found
```
**Solution**: Install native dependencies:
```bash
brew install pkg-config cairo pango libpng jpeg giflib librsvg pixman
```

### Invalid Data Format
```
Error: Could not parse chart data from prompt
```
**Solution**: Use supported formats:
- "Label:Value Label:Value"
- "Label,$Value Label,$Value"
- CSV format

### Chart Not Generated
Check logs for:
- Data parsing errors
- Chart rendering errors
- Canvas initialization issues

## Next Steps

After understanding the Analytics Agent:
1. **Multi-Agent Systems** - Agent orchestration with a2a-ai-provider
2. **Custom Chart Types** - Extend to line charts, pie charts, etc.
3. **Advanced Visualizations** - Complex data transformations

## Learn More

- [Chart.js Documentation](https://www.chartjs.org/docs/latest/)
- [node-canvas Documentation](https://github.com/Automattic/node-canvas)
- [A2A Protocol Documentation](https://google.github.io/A2A/)
- [AI SDK Documentation](https://sdk.vercel.ai/docs)
- [Conversion Plan](../../../../../../../PYTHON_TO_JS_CONVERSION_PLAN.md)

