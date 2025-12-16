# @drew-foxall/a2a-ai-provider-v3

AI SDK LanguageModelV3 provider for [A2A protocol](https://a2a-protocol.org/). Enables seamless agent-to-agent communication using the latest AI SDK specification.

## Why V3?

The AI SDK has evolved from `LanguageModelV2` to `LanguageModelV3`, which includes:

- Enhanced multi-modal support (files, images, audio)
- Improved streaming with better part types
- Provider metadata for agent context
- Better tool call handling

This provider implements `LanguageModelV3` to ensure full compatibility with the latest AI SDK features.

## Installation

```bash
pnpm add @drew-foxall/a2a-ai-provider-v3
```

## Quick Start

```typescript
import { a2aV3 } from '@drew-foxall/a2a-ai-provider-v3';
import { generateText, streamText } from 'ai';

// Non-streaming
const result = await generateText({
  model: a2aV3('http://localhost:3001'),
  prompt: 'What is the weather in Paris?',
});

console.log(result.text);

// Streaming
const stream = await streamText({
  model: a2aV3('http://localhost:3001'),
  prompt: 'Plan a trip to Tokyo',
});

for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}
```

## Agent Discovery

The A2A protocol defines a [standard discovery mechanism](https://a2a-protocol.org/latest/topics/agent-discovery/) using well-known URIs.

### Discover Agent from Domain

```typescript
import { discoverAgent, a2aV3 } from '@drew-foxall/a2a-ai-provider-v3';
import { generateText } from 'ai';

// Discover agent using well-known URI (/.well-known/agent-card.json)
const { agentUrl, agentCard } = await discoverAgent('travel-agent.example.com');

console.log(`Discovered: ${agentCard.name}`);
console.log(`Skills: ${agentCard.skills?.map(s => s.name).join(', ')}`);

// Use the discovered agent
const result = await generateText({
  model: a2aV3(agentUrl),
  prompt: 'Plan a trip to Paris',
});
```

### Fetch Agent Card Directly

```typescript
import { fetchAgentCard } from '@drew-foxall/a2a-ai-provider-v3';

// When you know the agent card URL
const { agentUrl, agentCard } = await fetchAgentCard(
  'https://api.example.com/agents/travel/card.json'
);
```

### Check Agent Capabilities

```typescript
import { discoverAgent, supportsCapability, getAuthSchemes } from '@drew-foxall/a2a-ai-provider-v3';

const { agentCard } = await discoverAgent('agent.example.com');

// Check capabilities
if (supportsCapability(agentCard, 'streaming')) {
  console.log('Agent supports streaming');
}

// Get authentication schemes
const schemes = getAuthSchemes(agentCard);
console.log('Auth schemes:', schemes); // e.g., ['bearer', 'oauth2']
```

## Authentication

A2A agents may require authentication. Configure auth headers in the discovery options or at the provider level.

### Discovery with Authentication

```typescript
import { discoverAgent } from '@drew-foxall/a2a-ai-provider-v3';

const { agentUrl, agentCard } = await discoverAgent('internal-agent.corp.example.com', {
  headers: {
    'Authorization': 'Bearer your-access-token',
  },
});
```

### Authentication for Requests

The A2A SDK's `ClientFactory` handles authentication. Configure auth in your environment or pass headers:

```typescript
import { a2aV3 } from '@drew-foxall/a2a-ai-provider-v3';
import { generateText } from 'ai';

// Option 1: Environment variable (if supported by the A2A SDK)
// Set A2A_AUTH_TOKEN or similar in your environment

// Option 2: Use a custom fetch with auth headers
// This requires configuring the ClientFactory separately

// Option 3: Service bindings (Cloudflare Workers)
// For Cloudflare Workers, use service bindings instead of HTTP auth
```

### OAuth 2.0 Authentication

For agents requiring OAuth 2.0:

```typescript
import { discoverAgent, getAuthSchemes, a2aV3 } from '@drew-foxall/a2a-ai-provider-v3';

const { agentUrl, agentCard } = await discoverAgent('agent.example.com');
const schemes = getAuthSchemes(agentCard);

if (schemes.includes('oauth2')) {
  // Get token from your OAuth provider
  const token = await getOAuthToken(agentCard.securitySchemes?.oauth2);
  
  // The A2A SDK will use this token for requests
  // Configure via environment or ClientFactory
}
```

## Multi-Turn Conversations

Use `contextId` to maintain conversation context across multiple requests:

```typescript
import { a2aV3 } from '@drew-foxall/a2a-ai-provider-v3';
import { generateText } from 'ai';

// First message
const result1 = await generateText({
  model: a2aV3('http://localhost:3001'),
  prompt: 'What is the weather in Paris?',
});

// Get contextId from metadata for follow-up
const contextId = result1.providerMetadata?.a2a?.contextId;

// Follow-up message in same conversation
const result2 = await generateText({
  model: a2aV3('http://localhost:3001'),
  prompt: 'What about tomorrow?',
  providerOptions: {
    a2a: { contextId },
  },
});
```

## Handling Input-Required State

A2A agents can signal they need more user input via the `input-required` task state:

```typescript
import { a2aV3 } from '@drew-foxall/a2a-ai-provider-v3';
import { generateText } from 'ai';

const result = await generateText({
  model: a2aV3('http://localhost:3001'),
  prompt: 'Plan a trip',
});

// Check if agent needs more input
if (result.providerMetadata?.a2a?.inputRequired) {
  console.log('Agent needs more information');
  
  // Access the status message for context
  const statusParts = result.providerMetadata.a2a.statusMessage?.parts;
  for (const part of statusParts ?? []) {
    if (part.kind === 'text') {
      console.log('Agent says:', part.text);
    }
  }

  // Send follow-up with taskId to continue
  const followUp = await generateText({
    model: a2aV3('http://localhost:3001'),
    prompt: 'I want to go to Paris for 3 days',
    providerOptions: {
      a2a: {
        taskId: result.providerMetadata.a2a.taskId,
        contextId: result.providerMetadata.a2a.contextId,
      },
    },
  });
}
```

## Custom Events with DataParts

Send structured data to agents using custom parts:

```typescript
import { a2aV3 } from '@drew-foxall/a2a-ai-provider-v3';
import { generateText } from 'ai';

const result = await generateText({
  model: a2aV3('http://localhost:3001'),
  prompt: 'Process this selection',
  providerOptions: {
    a2a: {
      // Include custom data parts
      customParts: [
        {
          kind: 'data',
          data: {
            eventType: 'user-selection',
            selectedItems: ['item-1', 'item-2'],
            timestamp: new Date().toISOString(),
          },
        },
      ],
      // Message-level metadata
      metadata: {
        source: 'web-ui',
        sessionId: 'abc-123',
      },
    },
  },
});
```

## Accessing Artifacts

A2A agents can return artifacts (documents, images, structured data):

```typescript
import { a2aV3 } from '@drew-foxall/a2a-ai-provider-v3';
import { generateText } from 'ai';

const result = await generateText({
  model: a2aV3('http://localhost:3001'),
  prompt: 'Generate a travel itinerary',
});

// Access artifacts from metadata
const artifacts = result.providerMetadata?.a2a?.artifacts ?? [];

for (const artifact of artifacts) {
  console.log(`Artifact: ${artifact.name} (${artifact.artifactId})`);
  
  for (const part of artifact.parts) {
    if (part.kind === 'text') {
      console.log('Content:', part.text);
    } else if (part.kind === 'file') {
      console.log('File:', part.file?.name, part.file?.mimeType);
    } else if (part.kind === 'data') {
      console.log('Data:', part.data);
    }
  }
}
```

## Multi-Agent Communication

Orchestrate multiple A2A agents:

```typescript
import { a2aV3, discoverAgent } from '@drew-foxall/a2a-ai-provider-v3';
import { generateText } from 'ai';

// Discover agents
const weather = await discoverAgent('weather-agent.example.com');
const hotels = await discoverAgent('hotel-agent.example.com');
const flights = await discoverAgent('flight-agent.example.com');

// Weather agent
const weatherResult = await generateText({
  model: a2aV3(weather.agentUrl),
  prompt: 'Get weather forecast for Paris next week',
});

// Hotel agent (using weather context)
const hotelResult = await generateText({
  model: a2aV3(hotels.agentUrl),
  prompt: `Find hotels in Paris. Weather forecast: ${weatherResult.text}`,
});

// Flight agent
const flightResult = await generateText({
  model: a2aV3(flights.agentUrl),
  prompt: 'Find flights to Paris departing Monday',
});

console.log('Trip planned!');
console.log('Weather:', weatherResult.text);
console.log('Hotels:', hotelResult.text);
console.log('Flights:', flightResult.text);
```

## API Reference

### Provider

#### `a2aV3(agentUrl, settings?)`

Default provider instance.

- `agentUrl`: URL of the A2A agent
- `settings.contextId`: Context ID for conversation continuity
- `settings.taskId`: Task ID for resuming tasks

#### `createA2aV3(options?)`

Create a custom provider.

- `options.generateId`: Custom ID generator function

### Discovery

#### `discoverAgent(domain, options?)`

Discover an agent via well-known URI (`/.well-known/agent-card.json`).

- `domain`: Domain or base URL
- `options.headers`: Custom headers (e.g., for auth)
- `options.timeout`: Request timeout in ms (default: 10000)
- `options.fetch`: Custom fetch implementation

Returns `{ agentUrl, agentCard }`.

#### `fetchAgentCard(cardUrl, options?)`

Fetch an agent card from a direct URL.

#### `supportsCapability(agentCard, capability)`

Check if an agent supports a capability (`streaming`, `pushNotifications`, `stateTransitionHistory`).

#### `getAuthSchemes(agentCard)`

Get authentication scheme identifiers from an agent card.

### Provider Metadata

Access A2A-specific information via `result.providerMetadata.a2a`:

| Field | Type | Description |
|-------|------|-------------|
| `taskId` | `string \| null` | Task ID for follow-up messages |
| `contextId` | `string \| null` | Context ID for conversation continuity |
| `taskState` | `TaskState \| null` | Current task state |
| `inputRequired` | `boolean` | True when agent needs more input |
| `statusMessage` | `object \| null` | Full status message with parts |
| `artifacts` | `array` | Task artifacts with parts and metadata |
| `metadata` | `object \| null` | Task-level extension metadata |

### Provider Options

Pass A2A-specific options via `providerOptions.a2a`:

| Option | Type | Description |
|--------|------|-------------|
| `contextId` | `string` | Continue a conversation |
| `taskId` | `string` | Resume an existing task |
| `customParts` | `array` | Additional data parts to send |
| `metadata` | `object` | Message-level metadata |
| `requestMetadata` | `object` | Request-level metadata |

## A2A Protocol Compatibility

This provider supports the [A2A protocol](https://a2a-protocol.org/):

| Feature | Status | Notes |
|---------|--------|-------|
| JSON-RPC transport | ✅ | Full support |
| Streaming (SSE) | ✅ | With fallback for non-streaming agents |
| TextPart | ✅ | Full support |
| FilePart | ✅ | Base64 bytes and URI |
| DataPart | ✅ | For custom events |
| Artifacts | ✅ | Exposed via providerMetadata |
| Task states | ✅ | All states mapped |
| input-required | ✅ | Explicit flag in metadata |
| contextId | ✅ | Conversation continuity |
| Agent discovery | ✅ | Well-known URI support |
| Push notifications | ❌ | AI SDK limitation |

## License

Apache-2.0
