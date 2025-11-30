# CrewAI Image Generation Agent Reference

> **Source**: `samples/python/agents/crewai/`
> **Our Implementation**: Not planned (requires Gemini image generation)

## Overview

An image generation agent built with CrewAI that uses Google Gemini's image generation capabilities. Demonstrates image artifact handling and session-based image caching for iterative modifications.

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Client    │────►│  A2A Protocol   │────►│  CrewAI Agent   │
│             │◄────│  (JSON-RPC)     │◄────│  (Image Gen)    │
└─────────────┘     └─────────────────┘     └────────┬────────┘
                                                     │
                                              ┌──────┴──────┐
                                              │  Gemini API │
                                              │  (Image)    │
                                              └─────────────┘
```

## Key Components

### 1. CrewAI Agent

```python
self.image_creator_agent = Agent(
    role='Image Creation Expert',
    goal="Generate an image based on the user's text prompt.",
    backstory='You are a digital artist powered by AI...',
    verbose=False,
    allow_delegation=False,
    tools=[generate_image_tool],
    llm=self.model,
)
```

### 2. Image Generation Tool

```python
@tool('ImageGenerationTool')
def generate_image_tool(
    prompt: str, session_id: str, artifact_file_id: str = None
) -> str:
    """Image generation tool that generates or modifies images."""
    client = genai.Client()
    
    # Get reference image from cache if modifying
    ref_image = None
    if artifact_file_id:
        session_data = cache.get(session_id)
        ref_image_data = session_data.get(artifact_file_id)
        ref_image = Image.open(BytesIO(base64.b64decode(ref_image_data.bytes)))
    
    # Generate with Gemini
    contents = [prompt, ref_image] if ref_image else prompt
    response = client.models.generate_content(
        model='gemini-2.0-flash-exp',
        contents=contents,
        config=types.GenerateContentConfig(
            response_modalities=['Text', 'Image']
        ),
    )
    
    # Extract and cache image
    for part in response.candidates[0].content.parts:
        if part.inline_data is not None:
            data = Imagedata(
                bytes=base64.b64encode(part.inline_data.data).decode('utf-8'),
                mime_type=part.inline_data.mime_type,
                id=uuid4().hex,
            )
            cache.set(session_id, {data.id: data})
            return data.id
```

### 3. Session-Based Image Caching

The agent maintains image history per session:
- New images are cached with unique IDs
- Previous images can be referenced for modifications
- Supports iterative refinement ("make it more blue")

## A2A Protocol Flow

### Generate New Image
```json
{
  "method": "message/send",
  "params": {
    "message": {
      "parts": [{"text": "Generate an image of a sunset over mountains"}]
    }
  }
}
```

### Modify Existing Image
```json
{
  "method": "message/send",
  "params": {
    "message": {
      "contextId": "session-123",
      "parts": [{"text": "Make it more vibrant, artifact-file-id abc123"}]
    }
  }
}
```

## Key Features

1. **Text-to-Image**: Generate images from text descriptions
2. **Image Modification**: Reference previous images for edits
3. **Session Memory**: Track image history within a session
4. **Artifact Return**: Return images as base64 file parts

## Limitations

- **No true streaming**: CrewAI doesn't support streaming
- **Single-turn**: Limited multi-turn conversation support
- **Gemini-specific**: Requires Google Gemini API

## TypeScript Implementation Considerations

### Challenges

1. **Image Generation API**: Would need OpenAI DALL-E or similar
2. **Binary Handling**: Workers have limitations with large binary data
3. **Session State**: Need persistent storage for image history

### Potential Approach

```typescript
// Using OpenAI DALL-E
const generateImage = tool({
  description: "Generate an image from a text prompt",
  parameters: z.object({
    prompt: z.string(),
  }),
  execute: async ({ prompt }) => {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      size: "1024x1024",
      response_format: "b64_json",
    });
    return {
      id: crypto.randomUUID(),
      bytes: response.data[0].b64_json,
      mimeType: "image/png",
    };
  },
});
```

## Checklist for Implementation

- [ ] Image generation tool (DALL-E or similar)
- [ ] Session-based image caching
- [ ] Image modification support
- [ ] Binary artifact handling
- [ ] Worker deployment (challenging due to binary size)

## Notes

This example demonstrates advanced artifact handling but may not be practical for Cloudflare Workers due to:
- Response size limits
- Binary data handling complexity
- Image generation API latency

Consider as a Node.js-only implementation if needed.

