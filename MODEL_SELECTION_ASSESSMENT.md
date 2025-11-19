# A2A Adapter Model Selection Assessment

## Current Problem

The current implementation has **limited model flexibility** due to:

1. **String-based provider selection** via `getModel()` utility
2. **Model baked into agent at construction time** (no runtime override)
3. **Limited provider support** (only OpenAI, Anthropic, Google)
4. **Doesn't match AI SDK's full capabilities**

### Current Implementation

```typescript
// utils.ts - Limited to 3 providers
export function getModel() {
  const provider = process.env.AI_PROVIDER || "openai";
  const modelName = process.env.AI_MODEL;

  switch (provider.toLowerCase()) {
    case "anthropic":
      return anthropic(modelName || "claude-3-5-sonnet-20241022");
    case "google":
      return google(modelName || "gemini-2.0-flash-exp");
    case "openai":
    default:
      return openai(modelName || "gpt-4o-mini");
  }
}

// agent.ts - Model fixed at construction
export const contentEditorAgent = new ToolLoopAgent({
  model: getModel(), // ← Can't change at runtime
  instructions: CONTENT_EDITOR_PROMPT,
  tools: {},
});
```

### What's Missing

AI SDK supports **many more providers**:
- ✅ OpenAI
- ✅ Anthropic
- ✅ Google
- ❌ Azure OpenAI
- ❌ AWS Bedrock
- ❌ Cohere
- ❌ Mistral
- ❌ Perplexity
- ❌ Groq
- ❌ Ollama (local models)
- ❌ Together AI
- ❌ Replicate
- ❌ Custom providers

**Current `getModel()` only supports 3 providers!**

---

## AI SDK Model Architecture

The AI SDK uses a **provider + model** pattern:

```typescript
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createAzure } from '@ai-sdk/azure';

// Standard providers
const model1 = openai('gpt-4o');
const model2 = anthropic('claude-3-5-sonnet-20241022');

// Custom configurations
const customOpenAI = createOpenAI({
  apiKey: 'custom-key',
  baseURL: 'https://custom-endpoint',
});
const model3 = customOpenAI('gpt-4o');

// Azure with custom config
const azure = createAzure({
  apiKey: process.env.AZURE_API_KEY,
  resourceName: 'my-resource',
});
const model4 = azure('gpt-4-deployment');
```

### Key Point: Models are **first-class values**
- Not strings to be parsed
- Can be configured with custom settings
- Can be passed around like any other value
- Type-safe with TypeScript

---

## Proposed Solutions

### Option 1: Improve `getModel()` Utility (Quick Fix)

**Pros:**
- Minimal changes to existing code
- Backward compatible
- Easy to implement

**Cons:**
- Still limited to string-based selection
- Can't support custom provider configurations
- Doesn't match AI SDK patterns

**Implementation:**

```typescript
// Extended utils.ts
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAzure } from '@ai-sdk/azure';
import { cohere } from '@ai-sdk/cohere';
import { mistral } from '@ai-sdk/mistral';

export function getModel() {
  const provider = process.env.AI_PROVIDER || "openai";
  const modelName = process.env.AI_MODEL;

  switch (provider.toLowerCase()) {
    case "openai":
      return openai(modelName || "gpt-4o-mini");
    
    case "anthropic":
      return anthropic(modelName || "claude-3-5-sonnet-20241022");
    
    case "google":
      return google(modelName || "gemini-2.0-flash-exp");
    
    case "azure": {
      const azure = createAzure({
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        resourceName: process.env.AZURE_RESOURCE_NAME!,
      });
      return azure(modelName || "gpt-4");
    }
    
    case "cohere":
      return cohere(modelName || "command-r-plus");
    
    case "mistral":
      return mistral(modelName || "mistral-large-latest");
    
    case "groq": {
      const groq = createOpenAI({
        baseURL: 'https://api.groq.com/openai/v1',
        apiKey: process.env.GROQ_API_KEY,
      });
      return groq(modelName || "llama-3.1-70b-versatile");
    }
    
    case "ollama": {
      const ollama = createOpenAI({
        baseURL: 'http://localhost:11434/v1',
        apiKey: 'ollama', // required but unused
      });
      return ollama(modelName || "llama3.2");
    }
    
    default:
      throw new Error(`Unknown provider: ${provider}. Supported: openai, anthropic, google, azure, cohere, mistral, groq, ollama`);
  }
}
```

---

### Option 2: Agent Factory Pattern (Most Flexible)

**Pros:**
- Maximum flexibility
- Supports all AI SDK providers
- Allows custom configurations
- Matches AI SDK patterns
- Type-safe

**Cons:**
- Breaking change to existing agents
- Requires refactoring agent exports
- More verbose usage

**Implementation:**

```typescript
// agent.ts - Factory instead of instance
import { ToolLoopAgent, type LanguageModelV1 } from 'ai';
import { CONTENT_EDITOR_PROMPT } from './prompt.js';

/**
 * Create Content Editor Agent with custom model
 * 
 * This allows consumers to use ANY AI SDK model:
 * - Standard providers (OpenAI, Anthropic, Google)
 * - Azure OpenAI
 * - Custom providers (Groq, Ollama, etc.)
 * - Models with custom configurations
 * 
 * @example
 * // Standard usage
 * import { openai } from '@ai-sdk/openai';
 * const agent = createContentEditorAgent(openai('gpt-4o'));
 * 
 * // Custom Azure
 * import { createAzure } from '@ai-sdk/azure';
 * const azure = createAzure({ ... });
 * const agent = createContentEditorAgent(azure('gpt-4'));
 * 
 * // Local Ollama
 * import { createOpenAI } from '@ai-sdk/openai';
 * const ollama = createOpenAI({ baseURL: 'http://localhost:11434/v1' });
 * const agent = createContentEditorAgent(ollama('llama3.2'));
 */
export function createContentEditorAgent(model: LanguageModelV1) {
  return new ToolLoopAgent({
    model,
    instructions: CONTENT_EDITOR_PROMPT,
    tools: {},
  });
}

// Still provide convenience export with default model
export const contentEditorAgent = createContentEditorAgent(
  getModel() // Use utility for default
);
```

**Usage:**

```typescript
// index.ts - Use default
import { contentEditorAgent } from './agent.js';
const executor = new A2AAdapter(contentEditorAgent);

// OR use custom model
import { anthropic } from '@ai-sdk/anthropic';
import { createContentEditorAgent } from './agent.js';
const agent = createContentEditorAgent(anthropic('claude-3-opus-20240229'));
const executor = new A2AAdapter(agent);
```

---

### Option 3: Model Override in Adapter (Hybrid)

**Pros:**
- Backward compatible
- Allows runtime model override
- Doesn't require agent refactoring
- Simple to use

**Cons:**
- Requires creating new ToolLoopAgent instance (may lose some agent state)
- Slightly more complex adapter implementation

**Implementation:**

```typescript
// a2a-adapter.ts
export interface A2AAdapterConfig {
  // ... existing options ...
  
  /**
   * Optional model override
   * 
   * If provided, the adapter will create a new ToolLoopAgent instance
   * with this model, preserving all other agent configuration.
   * 
   * This allows runtime model selection without modifying agent code.
   * 
   * @example
   * // Use agent's default model
   * const executor = new A2AAdapter(agent);
   * 
   * // Override with different model
   * import { anthropic } from '@ai-sdk/anthropic';
   * const executor = new A2AAdapter(agent, {
   *   model: anthropic('claude-3-opus-20240229'),
   * });
   */
  model?: LanguageModelV1;
}

export class A2AAdapter<TModel, TTools, TCallOptions> {
  private agent: ToolLoopAgent<TModel, TTools, TCallOptions>;
  
  constructor(
    agent: ToolLoopAgent<TModel, TTools, TCallOptions>,
    config?: A2AAdapterConfig
  ) {
    // If model override provided, create new agent with that model
    if (config?.model) {
      this.agent = new ToolLoopAgent({
        ...agent, // Copy all agent config
        model: config.model, // Override model
      });
    } else {
      this.agent = agent;
    }
    
    // ... rest of constructor
  }
}
```

---

### Option 4: Pass-Through Model Support (Recommended)

**Pros:**
- ✅ No breaking changes
- ✅ Supports all AI SDK providers
- ✅ Backward compatible
- ✅ Simple to implement
- ✅ Improves documentation
- ✅ Adds convenience without restricting flexibility

**Cons:**
- Requires better documentation
- May need to improve `getModel()` for common cases

**Implementation:**

#### 1. Improve `getModel()` for common providers

```typescript
// utils.ts - Support more providers
export function getModel() {
  const provider = process.env.AI_PROVIDER || "openai";
  const modelName = process.env.AI_MODEL;

  switch (provider.toLowerCase()) {
    case "openai":
      return openai(modelName || "gpt-4o-mini");
    
    case "anthropic":
      return anthropic(modelName || "claude-3-5-sonnet-20241022");
    
    case "google":
      return google(modelName || "gemini-2.0-flash-exp");
    
    case "azure": {
      if (!process.env.AZURE_RESOURCE_NAME) {
        throw new Error("AZURE_RESOURCE_NAME required for Azure provider");
      }
      const azure = createAzure({
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        resourceName: process.env.AZURE_RESOURCE_NAME,
      });
      return azure(modelName || "gpt-4");
    }
    
    case "cohere":
      return cohere(modelName || "command-r-plus");
    
    case "mistral":
      return mistral(modelName || "mistral-large-latest");
    
    default:
      throw new Error(
        `Unknown provider: ${provider}\n` +
        `Supported: openai, anthropic, google, azure, cohere, mistral\n` +
        `For other providers, create agents programmatically with custom models.`
      );
  }
}
```

#### 2. Add factory functions alongside defaults

```typescript
// agent.ts
import type { LanguageModelV1 } from 'ai';

/**
 * Create Content Editor Agent with custom model
 * 
 * Use this when you need:
 * - Providers not supported by getModel() (Groq, Ollama, etc.)
 * - Custom model configurations
 * - Azure OpenAI with specific settings
 * - Local or self-hosted models
 */
export function createContentEditorAgent(model: LanguageModelV1) {
  return new ToolLoopAgent({
    model,
    instructions: CONTENT_EDITOR_PROMPT,
    tools: {},
  });
}

/**
 * Default Content Editor Agent
 * 
 * Uses model from environment variables:
 * - AI_PROVIDER: openai|anthropic|google|azure|cohere|mistral
 * - AI_MODEL: Specific model name (optional)
 * 
 * For custom providers or configurations, use createContentEditorAgent()
 */
export const contentEditorAgent = createContentEditorAgent(getModel());
```

#### 3. Document all patterns in README

```markdown
## Model Selection Patterns

### Pattern 1: Environment Variables (Quickest)

```bash
export AI_PROVIDER=anthropic
export AI_MODEL=claude-3-opus-20240229
```

Supported providers: `openai`, `anthropic`, `google`, `azure`, `cohere`, `mistral`

### Pattern 2: Custom Model (Most Flexible)

```typescript
import { createContentEditorAgent } from './agent.js';
import { anthropic } from '@ai-sdk/anthropic';

const agent = createContentEditorAgent(
  anthropic('claude-3-opus-20240229')
);
```

### Pattern 3: Custom Provider (Advanced)

```typescript
import { createOpenAI } from '@ai-sdk/openai';

// Groq
const groq = createOpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY,
});
const agent = createContentEditorAgent(groq('llama-3.1-70b'));

// Ollama (local)
const ollama = createOpenAI({
  baseURL: 'http://localhost:11434/v1',
  apiKey: 'ollama',
});
const agent = createContentEditorAgent(ollama('llama3.2'));
```

---

## Recommendation

**Use Option 4: Pass-Through Model Support**

This approach:
1. ✅ Maintains backward compatibility
2. ✅ Supports ALL AI SDK providers
3. ✅ Provides convenience via `getModel()`
4. ✅ Allows advanced users full flexibility
5. ✅ Matches AI SDK patterns
6. ✅ No changes needed to `A2AAdapter`

### Implementation Steps

1. **Improve `getModel()`** - Add Azure, Cohere, Mistral
2. **Add factory functions** - `createXAgent(model)` exports
3. **Keep default exports** - `xAgent = createXAgent(getModel())`
4. **Document patterns** - Environment vars, custom models, custom providers
5. **Update examples** - Show Groq, Ollama, Azure usage

### Why This Works

The `A2AAdapter` generics already support any model type:

```typescript
export class A2AAdapter<TModel, TTools, TCallOptions>
```

The adapter doesn't need to know about model selection - it just works with whatever `ToolLoopAgent` it receives. The model flexibility comes from how the agent is constructed, not the adapter.

---

## Next Steps

1. Implement improved `getModel()` with more providers
2. Add factory function exports to all agents
3. Update agent READMEs with model selection patterns
4. Add examples for Groq, Ollama, Azure
5. Update main README with model selection section

---

## AI SDK Provider Support Matrix

| Provider | Via getModel() | Via Custom | Notes |
|----------|---------------|------------|-------|
| OpenAI | ✅ | ✅ | Default |
| Anthropic | ✅ | ✅ | Claude models |
| Google | ✅ | ✅ | Gemini models |
| Azure OpenAI | ✅ (new) | ✅ | Requires config |
| Cohere | ✅ (new) | ✅ | Command models |
| Mistral | ✅ (new) | ✅ | Mistral models |
| AWS Bedrock | ❌ | ✅ | Custom setup |
| Groq | ❌ | ✅ | OpenAI-compatible |
| Ollama | ❌ | ✅ | Local, OpenAI-compatible |
| Together AI | ❌ | ✅ | OpenAI-compatible |
| Perplexity | ❌ | ✅ | OpenAI-compatible |
| Replicate | ❌ | ✅ | Custom provider |
| Custom | ❌ | ✅ | Any API |

✅ **All AI SDK providers are supported via custom model creation**

