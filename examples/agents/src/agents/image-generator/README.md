# Image Generator Agent

An AI agent that generates images from text descriptions using OpenAI's DALL-E.

## Overview

The Image Generator agent demonstrates:
1. **External API Integration**: Calling OpenAI's DALL-E API
2. **Creative Assistance**: Enhancing prompts for better results
3. **Binary Artifact Handling**: Returning image URLs

## Usage

### Local Development

```bash
# Start the agent (requires OPENAI_API_KEY with DALL-E access)
pnpm agents:image-generator

# Or directly
cd examples/agents && pnpm tsx src/agents/image-generator/index.ts
```

### API Example

```bash
curl -X POST http://localhost:41250/message/send \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "id": "1",
    "params": {
      "message": {
        "role": "user",
        "parts": [{"kind": "text", "text": "Generate an image of a sunset over mountains"}]
      }
    }
  }'
```

## Tool Parameters

The `generate_image` tool accepts:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `prompt` | string | required | Image description |
| `size` | enum | "1024x1024" | Dimensions (1024x1024, 1792x1024, 1024x1792) |
| `quality` | enum | "standard" | Quality level (standard, hd) |
| `style` | enum | "vivid" | Style (vivid for dramatic, natural for realistic) |

## Response

The agent returns:
- `imageUrl`: URL to the generated image
- `revisedPrompt`: DALL-E's enhanced prompt (if modified)
- Size, quality, and style used

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key with DALL-E access |
| `AI_PROVIDER` | No | LLM provider for conversation |
| `AI_MODEL` | No | Model for conversation |
| `PORT` | No | Server port (default: 41250) |

## Limitations

- **No Worker deployment**: DALL-E API latency and response size make Workers impractical
- **Cost**: DALL-E 3 has per-image costs
- **Rate limits**: OpenAI API rate limits apply
- **Content policy**: Cannot generate inappropriate content

## Use Cases

- **Creative Projects**: Generate concept art, illustrations
- **Marketing**: Create visual content for campaigns
- **Prototyping**: Quick mockups and visualizations
- **Education**: Visual aids for learning materials

## Related Agents

- **Analytics Agent** (`analytics-agent/`): Another agent with visual output
- **Content Planner** (`content-planner/`): Can work together for illustrated content

