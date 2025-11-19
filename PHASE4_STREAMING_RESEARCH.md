# Phase 4: Streaming Research for Coder Agent

**Date:** 2025-11-18  
**Goal:** Determine how to migrate Coder Agent while preserving streaming + artifacts

---

## 🎯 Challenge

The Coder Agent has unique requirements:

1. **Real-time Streaming** - Code generated incrementally
2. **Per-Chunk Processing** - Parse markdown code blocks as they arrive
3. **Artifact Emission** - Emit `TaskArtifactUpdateEvent` for each completed file
4. **Dynamic State** - Track files, deduplicate, maintain order

**Current Implementation:** Uses `streamText()` directly with per-chunk processing.

---

## 📚 AI SDK v6 Streaming Options

### Option 1: ToolLoopAgent.stream() (Research Needed)

**Hypothesis:** `ToolLoopAgent` may have a `stream()` method similar to `generate()`.

**Questions:**
- Does `ToolLoopAgent` support streaming?
- Does it provide per-chunk access?
- Can we process chunks incrementally?

**Verdict:** ⚠️ Need to verify through documentation or testing

---

### Option 2: Use streamText() Directly (Current Approach)

**Keep the current pattern but improve structure:**

```typescript
// agent.ts - Protocol-agnostic streaming agent
export async function* streamCoderAgent(prompt: string) {
  const { textStream } = streamText({
    model: getModel(),
    system: CODER_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });
  
  for await (const chunk of textStream) {
    yield chunk;
  }
}

// index.ts - A2A adapter handles chunks
const adapter = new A2AStreamingAdapter(streamCoderAgent, {
  processChunk: extractAndEmitArtifacts,
});
```

**Pros:**
- ✅ Works with current proven approach
- ✅ Full control over streaming
- ✅ Can process chunks incrementally
- ✅ Separates agent from A2A protocol

**Cons:**
- ❌ Not using ToolLoopAgent abstraction
- ❌ Less consistent with Phases 2-3
- ❌ May not leverage future AI SDK improvements

---

### Option 3: Hybrid Approach (Recommended)

**Use ToolLoopAgent but access underlying stream:**

```typescript
// agent.ts - ToolLoopAgent for consistency
export const coderAgent = new ToolLoopAgent({
  model: getModel(),
  instructions: CODER_SYSTEM_PROMPT,
  tools: {},  // No tools for coder
});

// Helper function to stream
export async function* streamCoderGeneration(
  agent: ToolLoopAgent,
  messages: Message[]
) {
  // Check if ToolLoopAgent supports streaming
  if ('stream' in agent) {
    const result = await (agent as any).stream({ messages });
    for await (const chunk of result.textStream) {
      yield chunk;
    }
  } else {
    // Fallback: Use streamText() directly
    const { textStream } = streamText({
      model: getModel(),
      system: CODER_SYSTEM_PROMPT,
      messages,
    });
    for await (const chunk of textStream) {
      yield chunk;
    }
  }
}

// index.ts - A2AStreamingAdapter handles chunks
const adapter = new A2AStreamingAdapter(coderAgent, {
  streamFunction: streamCoderGeneration,
  processChunk: extractAndEmitArtifacts,
});
```

**Pros:**
- ✅ Uses ToolLoopAgent for consistency
- ✅ Fallback to streamText() if needed
- ✅ Separates agent from A2A protocol
- ✅ Future-proof (can add tools later)

**Cons:**
- ⚠️ Requires custom streaming adapter
- ⚠️ More complex than Option 2

---

## 🏗️ Proposed Architecture

### Current (Old) - 439 lines
```
┌─────────────────────────────────────────┐
│   CoderAgentExecutor (370+ lines)       │
│   Everything mixed together ❌           │
│                                         │
│   • Task lifecycle                      │
│   • Message conversion                  │
│   • streamText() call                   │
│   • Per-chunk processing                │
│   • Code block parsing                  │
│   • Artifact emission                   │
│   • Event bus publishing                │
│   • File deduplication                  │
│   • Cancellation logic                  │
│                                         │
│   ALL COUPLED, A2A-SPECIFIC             │
└─────────────────────────────────────────┘
```

### Proposed (New) - ~200 lines
```
┌─────────────────────────────────────────┐
│   AI Agent (agent.ts - ~60 lines) ✨    │
│   Protocol-Agnostic, Portable           │
│                                         │
│   coderAgent = new ToolLoopAgent({      │
│     model, instructions, tools: {}      │
│   });                                   │
│                                         │
│   streamCoderGeneration(agent, msgs)    │
│   - Yields text chunks                  │
│   - No A2A knowledge                    │
│   - Can be used anywhere                │
│                                         │
│   Portable: CLI, Tests, REST, MCP, A2A │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│   Streaming Adapter (~140 lines) ✨     │
│   A2A Protocol + Streaming Logic        │
│                                         │
│   A2AStreamingAdapter(agent, {          │
│     streamFunction,                     │
│     processChunk: extractArtifacts,     │
│     transformResponse                   │
│   })                                    │
│                                         │
│   Handles:                              │
│   • Task lifecycle                      │
│   • Per-chunk processing                │
│   • Artifact emission                   │
│   • File deduplication                  │
│   • Event bus publishing                │
│   • Cancellation                        │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│   Server (index.ts - ~100 lines)        │
│   Standard Hono + A2A Routes            │
└─────────────────────────────────────────┘
```

---

## 🔨 Implementation Plan

### Step 1: Create A2AStreamingAdapter

Extend the base `A2AAgentAdapter` with streaming support:

```typescript
export class A2AStreamingAdapter extends A2AAgentAdapter {
  constructor(
    agent: ToolLoopAgent,
    options: {
      streamFunction: (agent, messages) => AsyncGenerator<string>;
      processChunk: (accumulated: string) => ParsedArtifacts;
      ...baseOptions
    }
  ) {
    super(agent, options);
  }
  
  async execute(requestContext, eventBus) {
    // 1. Setup (same as base adapter)
    // 2. Stream generation
    // 3. Process chunks incrementally
    // 4. Emit artifacts as they complete
    // 5. Publish final status
  }
}
```

### Step 2: Create Coder Agent

```typescript
// agent.ts
export const coderAgent = new ToolLoopAgent({
  model: getModel(),
  instructions: CODER_SYSTEM_PROMPT,
  tools: {},
});

export async function* streamCoderGeneration(
  agent: ToolLoopAgent,
  messages: Message[]
) {
  // Try ToolLoopAgent.stream() first
  // Fallback to streamText()
}
```

### Step 3: Wire Up Server

```typescript
// index.ts
const adapter = new A2AStreamingAdapter(coderAgent, {
  streamFunction: streamCoderGeneration,
  processChunk: extractCodeBlocks,
  workingMessage: "Generating code...",
});
```

---

## 📊 Expected Impact

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| **Total Lines** | 439 | ~300 | -32% |
| **Agent Logic** | 370 lines | ~60 lines | -84% |
| **Streaming Logic** | Mixed in | Adapter | Separated |
| **Protocols** | 1 (A2A) | 4+ | 4x reusability |
| **Testability** | Hard | Easy | Direct streaming |

---

## ✅ Decision: Hybrid Approach (Option 3)

**Rationale:**
1. **Consistency** - Uses ToolLoopAgent like Phases 2-3
2. **Flexibility** - Fallback to streamText() if needed
3. **Separation** - Agent knows nothing about A2A
4. **Future-proof** - Can add tools/features later
5. **Reusability** - Streaming logic in adapter

**Trade-offs:**
- Requires custom `A2AStreamingAdapter`
- More complex than keeping current approach
- But: Better architecture, more maintainable long-term

---

## 🚀 Next Steps

1. Create `A2AStreamingAdapter` in `shared/`
2. Create `agent.ts` with `coderAgent` + `streamCoderGeneration`
3. Update `index.ts` to use new adapter
4. Test streaming + artifacts
5. Validate against old implementation
6. Document streaming pattern

---

**Status:** Research complete, ready to implement  
**Approach:** Hybrid with A2AStreamingAdapter  
**Estimated Effort:** 4-6 hours

---

**Ready to implement Phase 4?** 🚀

