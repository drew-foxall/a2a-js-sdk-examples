# AI SDK 6 Upgrade Guide

This document summarizes the changes in AI SDK 6 from the [official announcement](https://vercel.com/blog/ai-sdk-6) (December 22, 2025) and assesses their impact on this codebase.

## Executive Summary

**Current State**: Using AI SDK 6 beta (`ai: 6.0.0-beta.99`)
**Target**: AI SDK 6 **STABLE** (now available!)

> ⚠️ **AI SDK 6 stable was released on December 22, 2025.** The codebase should upgrade from beta to stable versions.

The codebase is already largely compatible with AI SDK 6 patterns. The primary opportunities are:
1. **Version upgrade** - Move from beta to stable packages
2. **Call Options** - Type-safe per-request configuration
3. **Tool Approval** - Human-in-the-loop for sensitive operations
4. **Extended Usage** - Token breakdown for cost tracking

### Immediate Action: Upgrade Command

```bash
# Automated migration (recommended)
npx @ai-sdk/codemod upgrade v6

# Or manual update
pnpm update ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google @ai-sdk/provider @ai-sdk/react
```

---

## AI SDK 6 Key Features

### 1. Agent Abstraction (`ToolLoopAgent`)

**Status in codebase**: ✅ Already implemented

The `ToolLoopAgent` class provides a production-ready implementation that handles the complete tool execution loop.

```typescript
import { ToolLoopAgent } from "ai";

const agent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-4.5",
  instructions: "You are a helpful assistant.",
  tools: { weather: weatherTool },
});

// Non-streaming
const result = await agent.generate({ prompt: "What's the weather?" });

// Streaming
const stream = await agent.stream({ prompt: "What's the weather?" });
```

**Current usage in codebase**: All agents use `ToolLoopAgent` correctly with `agent.generate()` and `agent.stream()` methods.

---

### 2. Call Options (NEW OPPORTUNITY)

**Status in codebase**: ❌ Not yet implemented

Call Options allow passing type-safe arguments when calling `generate` or `stream`. This is valuable for:
- Injecting retrieved documents for RAG
- Selecting models based on request complexity
- Customizing tool behavior per request

```typescript
import { ToolLoopAgent } from "ai";
import { z } from "zod";

const supportAgent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-4.5",
  callOptionsSchema: z.object({
    userId: z.string(),
    accountType: z.enum(["free", "pro", "enterprise"]),
  }),
  prepareCall: ({ options, ...settings }) => ({
    ...settings,
    instructions: `You are a helpful customer support agent.
- User Account type: ${options.accountType}
- User ID: ${options.userId}`,
  }),
});

const result = await supportAgent.generate({
  prompt: "How do I upgrade my account?",
  options: {
    userId: "user_123",
    accountType: "free",
  },
});
```

**Recommendation for A2AAdapter**: Consider exposing `callOptionsSchema` and `prepareCall` through the adapter config to allow A2A-specific customization per request.

---

### 3. Tool Approval / Human-in-the-Loop (NEW OPPORTUNITY)

**Status in codebase**: ❌ Not yet implemented

AI SDK 6 introduces tool approval for human-in-the-loop workflows. This maps well to A2A's `input-required` state.

```typescript
const agent = new ToolLoopAgent({
  model,
  tools: {
    deleteFile: {
      description: "Delete a file",
      inputSchema: z.object({ path: z.string() }),
      requireApproval: true, // Requires human approval
      execute: async ({ path }) => { /* ... */ },
    },
  },
});

// Handle approval in the loop
const result = await agent.generate({
  prompt: "Delete config.json",
  onToolApprovalRequired: async (tool, params) => {
    // Could integrate with A2A's input-required state here
    return { approved: true }; // or { approved: false, reason: "..." }
  },
});
```

**A2A Integration Opportunity**: 
- Map tool approval requests to A2A `input-required` state
- Client can approve/reject via A2A protocol
- Resume task execution with `taskId` continuation

---

### 4. MCP Support

**Status in codebase**: ✅ Already implemented

Full MCP (Model Context Protocol) support via `@ai-sdk/mcp` package.

```typescript
import { experimental_createMCPClient as createMCPClient } from "@ai-sdk/mcp";

const mcpClient = await createMCPClient({
  transport: /* SSE, stdio, etc. */
});

const agent = new ToolLoopAgent({
  model,
  tools: await mcpClient.tools(),
});
```

**Current usage**: MCP is used in `travel-planner-multiagent/airbnb-agent` with `@ai-sdk/mcp: 1.0.0-beta.24`.

---

### 5. DevTools

**Status in codebase**: ❌ Not yet integrated

AI SDK 6 includes DevTools for debugging and tracing agent execution.

```typescript
import { createDevToolsUI } from "ai/devtools";

// In development, shows detailed LLM call information
const DevTools = createDevToolsUI({
  enabled: process.env.NODE_ENV === "development",
});
```

**Recommendation**: Add optional DevTools integration for local development and debugging.

---

### 6. Reranking

**Status in codebase**: ❌ Not applicable yet

Cross-provider reranking for RAG applications:

```typescript
import { rerank } from "ai";

const results = await rerank({
  model: cohereReranker("rerank-english-v3.0"),
  query: "user question",
  documents: retrievedDocs,
});
```

**Recommendation**: Consider for future RAG-enhanced agents.

---

### 7. Tool Calling with Structured Output

**Status in codebase**: ✅ Already using similar patterns

Stable structured output even when tool calling:

```typescript
const result = await agent.generate({
  prompt: "Extract user info",
  output: z.object({
    name: z.string(),
    email: z.string().email(),
  }),
});
```

---

### 8. Extended Usage Information

**Status in codebase**: ❌ Not yet leveraged

Token breakdown by category for cost tracking:

```typescript
const result = await agent.generate({ prompt });

// Input token breakdown
console.log(result.usage.inputTokenDetails.cachedTokens);
console.log(result.usage.inputTokenDetails.textTokens);
console.log(result.usage.inputTokenDetails.imageTokens);

// Output token breakdown
console.log(result.usage.outputTokenDetails.textTokens);
console.log(result.usage.outputTokenDetails.reasoningTokens);
```

**Recommendation**: Expose usage details through A2A metadata for cost tracking.

---

### 9. Image Editing

**Status in codebase**: ❌ Not yet implemented

Edit existing images using AI:

```typescript
import { editImage } from "ai";

const result = await editImage({
  model: openaiImage("gpt-image-1"),
  prompt: "Make the sky blue",
  image: existingImageUrl,
});
```

**Recommendation**: Could enhance `image-generator` agent with editing capabilities.

---

### 10. Raw Finish Reason

**Status in codebase**: ❌ Not yet leveraged

Access provider-specific finish reasons:

```typescript
const result = await agent.generate({ prompt });
console.log(result.finishReason);    // Normalized
console.log(result.rawFinishReason); // Provider-specific
```

---

### 11. LangChain Adapter Rewrite

**Status in codebase**: ❌ Not applicable

New `@ai-sdk/langchain` package with modern APIs. Not currently relevant to this codebase.

---

## Package Version Inventory

### Current Versions in Use

| Package | Current Version | Category |
|---------|-----------------|----------|
| `ai` | 6.0.0-beta.99 | Core |
| `@ai-sdk/openai` | 3.0.0-beta.61 | Provider |
| `@ai-sdk/anthropic` | 3.0.0-beta.54 | Provider |
| `@ai-sdk/google` | 3.0.0-beta.48 | Provider |
| `@ai-sdk/azure` | 3.0.0-beta.33 | Provider |
| `@ai-sdk/cohere` | 3.0.0-beta.19 | Provider |
| `@ai-sdk/mistral` | 3.0.0-beta.26 | Provider |
| `@ai-sdk/mcp` | 1.0.0-beta.24 | Integration |
| `@ai-sdk/provider` | 3.0.0-beta.23 | Core |
| `@ai-sdk/provider-utils` | 4.0.0-beta.41 | Core |
| `@ai-sdk/react` | 3.0.0-beta.132 | UI |

### Packages Using AI SDK

| Package/Example | Location | AI SDK Dependencies |
|-----------------|----------|---------------------|
| `a2a-inspector` | `/a2a-inspector` | ai, @ai-sdk/provider, @ai-sdk/react |
| `a2a-ai-sdk-adapter` | `/packages/a2a-ai-sdk-adapter` | ai (peer) |
| `a2a-ai-provider-v3` | `/packages/a2a-ai-provider-v3` | @ai-sdk/provider, @ai-sdk/provider-utils, ai (peer) |
| `examples/agents` | `/examples/agents` | ai, @ai-sdk/openai, @ai-sdk/anthropic, @ai-sdk/google, @ai-sdk/mcp |
| Workers (all) | `/examples/workers/*` | ai, @ai-sdk/openai, @ai-sdk/anthropic, @ai-sdk/google |
| Vercel examples | `/examples/vercel/*` | ai, @ai-sdk/openai, @ai-sdk/anthropic, @ai-sdk/google |

---

## A2AAdapter Analysis

### Current Implementation

The `A2AAdapter` in `/packages/a2a-ai-sdk-adapter/src/adapter.ts` bridges `ToolLoopAgent` with A2A protocol:

```typescript
export class A2AAdapter<TTools extends ToolSet = ToolSet> implements AgentExecutor {
  constructor(
    private agent: ToolLoopAgent<never, TTools, never>,
    config: A2AAdapterConfig
  ) { /* ... */ }

  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    // Routes to either executeAsMessage or executeAsTask
  }
}
```

**Key characteristics**:
1. Wraps `ToolLoopAgent` with `never` for CALL_OPTIONS generic
2. Supports both `stream` and `generate` modes
3. Handles Task lifecycle (submitted → working → completed)
4. Supports Message-only responses via `selectResponseType`

### Enhancement Opportunities

#### 1. Expose Call Options

Allow A2A requests to pass call options to the underlying agent:

```typescript
interface A2AAdapterConfig<TCallOptions = never> {
  // ... existing config ...
  
  /**
   * Schema for call options that can be passed per-request
   * These are derived from A2A request metadata
   */
  callOptionsSchema?: z.ZodSchema<TCallOptions>;
  
  /**
   * Transform A2A request context into call options
   */
  deriveCallOptions?: (context: RequestContext) => TCallOptions;
}
```

#### 2. Tool Approval Integration

Map AI SDK's tool approval to A2A's `input-required` state:

```typescript
interface A2AAdapterConfig {
  // ... existing config ...
  
  /**
   * Handle tool approval requests by transitioning to input-required state
   * Client approves via A2A message continuation
   */
  handleToolApproval?: (
    tool: string,
    params: unknown,
    context: RequestContext
  ) => Promise<{ approved: boolean; reason?: string }>;
}
```

#### 3. Extended Usage Exposure

Include token usage in A2A response metadata:

```typescript
// In status-update events
metadata: {
  usage: {
    inputTokens: 150,
    outputTokens: 50,
    inputTokenDetails: { cachedTokens: 100, textTokens: 50 },
    outputTokenDetails: { textTokens: 40, reasoningTokens: 10 },
  }
}
```

---

## Breaking Changes Assessment

Based on the AI SDK 6 announcement, the migration from beta to stable should be minimal:

### Potentially Breaking

1. **Type changes in `ToolLoopAgent` generics** - Verify type compatibility
2. **Message types renamed** - `Core*` types deprecated, use `ModelMessage` instead
3. **Provider-specific changes** - Check each provider for API changes

### Non-Breaking Enhancements

1. **New `callOptionsSchema`/`prepareCall`** - Additive
2. **Tool approval** - Additive
3. **Extended usage** - Additive
4. **DevTools** - Additive

---

## Migration Checklist

### Phase 1: Version Update (Low Risk) - DO NOW

The stable release is available. Run the automated codemod:

```bash
npx @ai-sdk/codemod upgrade v6
```

Manual checklist:
- [ ] Update `ai` package to `^6.0.0` (stable)
- [ ] Update `@ai-sdk/openai` to stable
- [ ] Update `@ai-sdk/anthropic` to stable
- [ ] Update `@ai-sdk/google` to stable
- [ ] Update `@ai-sdk/provider` to stable
- [ ] Update `@ai-sdk/provider-utils` to stable
- [ ] Update `@ai-sdk/react` to stable
- [ ] Update `@ai-sdk/mcp` to stable
- [ ] Remove pnpm override for `@ai-sdk/provider` in root package.json
- [ ] Run `pnpm install`
- [ ] Run `pnpm typecheck` across all packages
- [ ] Run `pnpm test` for full test suite

### Phase 2: Leverage New Features (Medium Risk)
- [ ] Add Call Options support to A2AAdapter
- [ ] Integrate tool approval with A2A input-required state
- [ ] Expose extended usage in A2A metadata
- [ ] Add DevTools integration for development

### Phase 3: Documentation & Examples (Low Risk)
- [ ] Update CLAUDE.md with stable version info
- [ ] Update README files
- [ ] Add examples for new features
- [ ] Update this document with findings

---

## Recommended Actions

### Immediate (Stable is Released!)

1. **Run the codemod** - `npx @ai-sdk/codemod upgrade v6`
2. **Update packages** - Move from beta to stable versions
3. **Test thoroughly** - Run typecheck and test suite
4. **Remove overrides** - Clean up pnpm overrides in root package.json

### Short Term (Post-Upgrade)

1. **Implement Call Options** in A2AAdapter for per-request configuration
2. **Add tool approval** integration with input-required state
3. **Expose usage metrics** in A2A response metadata

### Medium Term

1. **DevTools integration** for debugging
2. **Image editing** capabilities in image-generator agent
3. **Reranking** for RAG-enhanced agents

---

## References

- [AI SDK 6 Announcement](https://vercel.com/blog/ai-sdk-6)
- [AI SDK Documentation](https://ai-sdk.dev/)
- [Migration Guide](https://ai-sdk.dev/docs/migration/ai-sdk-6)
- [A2A Protocol Specification](https://a2a-protocol.org/)

---

## Codebase Compatibility Analysis

### ✅ Already Correctly Implemented

| Feature | Status | Evidence |
|---------|--------|----------|
| `ToolLoopAgent` usage | ✅ | All agents use `new ToolLoopAgent()` |
| `agent.generate()` method | ✅ | Used in adapter `executeSimple()` |
| `agent.stream()` method | ✅ | Used in adapter `executeStreaming()` |
| `ModelMessage` types | ✅ | Used instead of deprecated `Core*` types |
| Tool schema with `inputSchema` | ✅ | All tools use `z.object()` |
| Explicit execute types | ✅ | `(params: z.infer<typeof schema>)` pattern |
| MCP integration | ✅ | `@ai-sdk/mcp` in use |

### ⚠️ Areas Requiring Attention

| Issue | Location | Resolution |
|-------|----------|------------|
| Core* type warnings in comments | `adapter.ts`, `examples/agents/src/shared/a2a-adapter.ts` | Documentation only - no code changes needed |
| Provider version override | `/package.json` `pnpm.overrides` | Update when stable release available |
| Beta version pinning | All package.json files | Update to stable versions |

### 🆕 New Features to Leverage

| Feature | Impact | Priority |
|---------|--------|----------|
| Call Options | Per-request agent configuration | Medium |
| Tool Approval | Human-in-the-loop via A2A `input-required` | High |
| Extended Usage | Token breakdown for cost tracking | Low |
| DevTools | Debug visibility | Medium |

---

## A2A Protocol ↔ AI SDK 6 Mapping

### Response Type Mapping

| A2A Concept | AI SDK 6 Equivalent |
|-------------|---------------------|
| Task (stateful) | `agent.stream()` / `agent.generate()` with full lifecycle |
| Message (stateless) | Direct response without task lifecycle |
| `input-required` state | Tool approval callback |
| Artifacts | `providerMetadata.a2a.artifacts` |
| Task cancellation | `abortSignal` in call options |

### Proposed Call Options Schema for A2A

```typescript
// Potential enhancement to A2AAdapterConfig
const a2aCallOptionsSchema = z.object({
  // A2A-specific per-request options
  contextId: z.string().optional(),
  taskId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  
  // Request prioritization
  priority: z.enum(["low", "normal", "high"]).optional(),
  
  // Client hints
  clientCapabilities: z.object({
    streaming: z.boolean(),
    artifacts: z.boolean(),
    inputRequired: z.boolean(),
  }).optional(),
});
```

---

## Summary: Action Items

### ✅ Completed (Assessment Phase)
1. ✅ Document changes (this file)
2. ✅ Inventory package versions
3. ✅ Verify pattern compliance (all patterns are correct)

### 🚀 Ready Now (Stable Release Available!)

AI SDK 6 stable was released December 22, 2025. Upgrade from beta:

```bash
# Option 1: Automated codemod (recommended)
npx @ai-sdk/codemod upgrade v6

# Option 2: Manual update
pnpm update ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google @ai-sdk/provider @ai-sdk/react @ai-sdk/mcp
```

Then:
1. Remove `@ai-sdk/provider` override from root `package.json`
2. Run `pnpm install`
3. Run `pnpm typecheck` across all packages
4. Run `pnpm test` for full test suite

### Post-Upgrade (Enhancement Phase)
1. Add Call Options support to `A2AAdapter`
2. Implement tool approval → `input-required` mapping
3. Add usage metrics exposure
4. Consider DevTools integration

---

*Last Updated: December 30, 2025*

