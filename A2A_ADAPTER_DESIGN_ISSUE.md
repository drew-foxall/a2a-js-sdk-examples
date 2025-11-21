# A2A Adapter Design Issue: Async Artifact Generation

**Date**: 2025-11-21  
**Status**: 🚨 Critical Design Flaw Identified  
**Impact**: Affects `analytics-agent` and `currency-agent`

---

## Problem Statement

The current `A2AAdapter` has a **synchronous-only** `parseArtifacts` interface:

```typescript
parseArtifacts?: (accumulatedText: string) => ParsedArtifacts;
```

This works perfectly for **text-based artifacts** (e.g., coder agent extracting code blocks), but **fails for agents that need async operations** to generate artifacts.

---

## Affected Agents

### 1. ❌ Analytics Agent
**Problem**: Needs to generate chart images asynchronously using `node-canvas`

```typescript
// Current (BROKEN):
async function parseChartArtifacts(prompt: string): Promise<Artifact[]> {
  const chart = await generateChartFromPrompt(prompt);  // Async!
  return [{ ... }];
}

// Causes TypeScript error:
// Type 'Promise<Artifact[]>' is not assignable to type 'ParsedArtifacts'
```

### 2. ❌ Currency Agent  
**Problem**: Similar pattern - async artifact creation

```typescript
// Current (BROKEN):
async function parseConversionArtifacts(response: string): Promise<Artifact[]> {
  // ... async logic
  return [{ ... }];
}
```

### 3. ✅ Coder Agent
**Works**: Synchronous text parsing

```typescript
// Current (WORKS):
function parseCodeArtifacts(accumulatedText: string): ParsedArtifacts {
  const parsed = extractCodeBlocks(accumulatedText);  // Sync!
  return { artifacts: [...] };
}
```

---

## Root Cause Analysis

The `parseArtifacts` function was designed for **streaming text parsing**:

1. Agent streams text token by token
2. Adapter accumulates text
3. `parseArtifacts` **synchronously** extracts artifacts from text
4. Artifacts are emitted incrementally

This pattern assumes artifacts are **already in the text** and just need extraction.

---

## Two Different Use Cases

| Use Case | Example | Artifact Source | Timing | Sync/Async |
|----------|---------|-----------------|--------|------------|
| **Text Parsing** | Coder | Markdown code blocks | During streaming | **Sync** ✅ |
| **Generation** | Analytics | Chart PNG from data | After completion | **Async** ❌ |
| **Generation** | Currency | Conversion result | After completion | **Async** ❌ |

---

## Solution Options

### Option 1: Extend A2AAdapter (Recommended)

Add support for async artifact generation:

```typescript
export interface A2AAdapterConfig {
  // Existing: Sync text parsing (streaming)
  parseArtifacts?: (accumulatedText: string) => ParsedArtifacts;
  
  // NEW: Async artifact generation (simple mode)
  generateArtifacts?: (
    responseText: string,
    context: RequestContext
  ) => Promise<Artifact[]>;
  
  // ...
}
```

**Behavior**:
- If `parseArtifacts` provided → **Streaming mode** (sync text parsing)
- If `generateArtifacts` provided → **Simple mode with artifacts** (async generation after completion)
- If neither → **Simple mode** (text only)

**Implementation**:
```typescript
// In executeSimpleMode():
async executeSimpleMode(
  requestContext: RequestContext,
  eventBus: ExecutionEventBus
): Promise<Task> {
  // ... generate response ...
  
  const responseText = await responsePromise;
  
  // NEW: Generate artifacts if configured
  if (this.config.generateArtifacts) {
    const artifacts = await this.config.generateArtifacts(responseText, requestContext);
    
    for (const artifact of artifacts) {
      this.publishArtifact(taskId, contextId, artifact, eventBus);
    }
  }
  
  // ... return task ...
}
```

**Usage**:
```typescript
// Analytics Agent
const agentExecutor = new A2AAdapter(agent, {
  generateArtifacts: async (responseText) => {
    const chart = await generateChartFromPrompt(responseText);
    return [{
      artifactId: chart.id,
      name: chart.name,
      parts: [{ kind: "file", file: { ...chart } }]
    }];
  },
  workingMessage: "Generating chart...",
});
```

---

### Option 2: Use Simple Mode Without Artifacts

Temporarily disable artifact generation:

```typescript
// Analytics Agent (Temporary Fix)
const agentExecutor = new A2AAdapter(agent, {
  workingMessage: "Analyzing data...",
  debug: false,
  // No parseArtifacts - uses simple mode, text only
});
```

**Pros**:
- Quick fix
- No A2AAdapter changes needed

**Cons**:
- ❌ Loses artifact functionality
- ❌ Not feature-complete

---

### Option 3: Post-Process Hook

Add a hook that runs after response generation:

```typescript
export interface A2AAdapterConfig {
  parseArtifacts?: (accumulatedText: string) => ParsedArtifacts;
  
  // NEW: Post-processing hook
  postProcess?: (task: Task, context: RequestContext) => Promise<Task>;
}
```

**Cons**:
- More complex API
- Harder to understand
- Less explicit about artifacts

---

## Recommended Solution

**Implement Option 1**: Extend A2AAdapter with `generateArtifacts`

### Why This Solution?

1. ✅ **Clear separation of concerns**
   - `parseArtifacts`: Sync text parsing (streaming)
   - `generateArtifacts`: Async generation (simple mode)

2. ✅ **Backward compatible**
   - Existing agents work unchanged
   - Only affects agents that opt-in

3. ✅ **Type-safe**
   - Proper async/await support
   - No Promise vs non-Promise confusion

4. ✅ **Self-documenting**
   - Function name clearly indicates purpose
   - Usage is obvious from signature

5. ✅ **Aligns with use cases**
   - Text parsing → streaming (incremental)
   - Artifact generation → simple mode (after completion)

---

## Implementation Plan

### Phase 1: Extend A2AAdapter ✅

1. Add `generateArtifacts` to `A2AAdapterConfig`
2. Implement in `executeSimpleMode()`
3. Add type definitions
4. Update documentation

### Phase 2: Update Analytics Agent ✅

1. Change from `parseArtifacts` to `generateArtifacts`
2. Keep async chart generation logic
3. Test end-to-end

### Phase 3: Update Currency Agent ✅

1. Change from `parseArtifacts` to `generateArtifacts`
2. Keep async conversion logic
3. Test end-to-end

### Phase 4: Documentation ✅

1. Update `A2A_INTEGRATION_PATTERN.md`
2. Add examples for both patterns
3. Document when to use each

---

## Type Signatures

### Current (Sync Only)

```typescript
parseArtifacts?: (accumulatedText: string) => ParsedArtifacts;
```

### Proposed (Both Patterns)

```typescript
// For streaming text parsing (coder agent)
parseArtifacts?: (accumulatedText: string) => ParsedArtifacts;

// For async artifact generation (analytics, currency agents)
generateArtifacts?: (
  responseText: string,
  context: RequestContext
) => Promise<Artifact[]>;
```

---

## Next Steps

1. ✅ Identify the issue (DONE)
2. ⏳ Implement `generateArtifacts` in A2AAdapter
3. ⏳ Update analytics-agent to use `generateArtifacts`
4. ⏳ Update currency-agent to use `generateArtifacts`
5. ⏳ Update coder tests
6. ⏳ Update documentation
7. ⏳ Commit with detailed explanation

---

## Impact Assessment

| Agent | Current Status | After Fix | Changes Required |
|-------|---------------|-----------|------------------|
| coder | ✅ Working | ✅ Working | None (backward compatible) |
| analytics | ❌ Broken (TypeScript error) | ✅ Working | Use `generateArtifacts` |
| currency | ❌ Broken (TypeScript error) | ✅ Working | Use `generateArtifacts` |
| movie | ✅ Working | ✅ Working | None |
| content-editor | ✅ Working | ✅ Working | None |
| hello-world | ✅ Working | ✅ Working | None |
| dice | ✅ Working | ✅ Working | None |
| github | ✅ Working | ✅ Working | None |
| travel-planner | ✅ Working | ✅ Working | None |

---

## Lessons Learned

1. **Design for multiple use cases** - Don't assume all artifacts come from text parsing
2. **Async is infectious** - If any part needs async, the API must support it
3. **Separate text parsing from generation** - Different operations, different patterns
4. **TypeScript catches design flaws** - The type error revealed the real issue

---

*Last updated: 2025-11-21*

