# Agent Streaming Analysis

## Summary
**All agents CAN use streaming mode.** The question is: which SHOULD stream for optimal UX?

---

## Analysis by Agent

### ✅ **Should Stream (Recommended)**

| Agent | Response Length | Streaming Benefit | Recommendation |
|-------|----------------|-------------------|----------------|
| **coder** | Long (multi-paragraph + code) | ⭐⭐⭐ **CRITICAL** | Already streaming ✅ |
| **content-editor** | Long (edited content) | ⭐⭐⭐ **HIGH** | Change to `mode: 'stream'` |
| **movie-agent** | Medium-Long (recommendations) | ⭐⭐⭐ **HIGH** | Change to `mode: 'stream'` |
| **github-agent** | Medium-Long (repo details) | ⭐⭐ **MEDIUM** | Change to `mode: 'stream'` |
| **analytics-agent** | Medium (analysis + chart) | ⭐⭐ **MEDIUM** | Change to `mode: 'stream'` |
| **currency-agent** | Medium (conversion + rates) | ⭐⭐ **MEDIUM** | Change to `mode: 'stream'` |
| **airbnb-agent** | Medium-Long (accommodation list) | ⭐⭐⭐ **HIGH** | Change to `mode: 'stream'` |
| **weather-agent** | Medium (forecast details) | ⭐⭐ **MEDIUM** | Change to `mode: 'stream'` |

### 🤔 **Could Stream (Optional)**

| Agent | Response Length | Streaming Benefit | Recommendation |
|-------|----------------|-------------------|----------------|
| **hello-world** | Short (1-2 sentences) | ⭐ **LOW** | Keep `mode: 'generate'` (but could stream) |
| **dice-agent** | Short ("You rolled a 4") | ⭐ **LOW** | Keep `mode: 'generate'` (but could stream) |

---

## Why Stream?

### User Experience Benefits

```
WITHOUT STREAMING (generate mode):
User: "Write me a story about a robot"
Agent: [working...] ⏳
... 10 seconds later ...
Agent: [Complete 500-word story appears instantly]

WITH STREAMING (stream mode):
User: "Write me a story about a robot"
Agent: "Once" → "upon" → "a time" → "there was" → ...
User sees: Real-time typewriter effect ✨
Perceived latency: Much lower
```

### Technical Benefits

1. **Lower Perceived Latency** - Users see immediate feedback
2. **Progress Indication** - Users know the agent is working
3. **Interruptibility** - Can cancel long responses early
4. **Better Engagement** - More interactive feel
5. **No Downside** - Works for short and long responses

---

## Recommendation: Default to Streaming

### Proposed Changes

```typescript
// ❌ BEFORE: Most agents use 'generate'
const executor = new A2AAdapter(agent, {
  mode: 'generate',  // Awaited response
});

// ✅ AFTER: Most agents use 'stream'
const executor = new A2AAdapter(agent, {
  mode: 'stream',     // Real-time streaming
  streamText: true,   // Stream text chunks (default)
});
```

### Only Keep `generate` For:

1. **Extremely short responses** (1-2 words like dice rolls)
2. **Agents where blocking is preferred** (rare)
3. **Testing/debugging scenarios**

### Why This Works

- ✅ Streaming works for **all response lengths** (short, medium, long)
- ✅ LLM handles chunk sizing naturally
- ✅ No performance overhead
- ✅ Better UX in 95% of cases
- ✅ Consistent behavior across agents

---

## Implementation Plan

### Phase 1: Convert High-Value Agents (Immediate Impact)

```typescript
// agents/content-editor/index.ts
const executor = new A2AAdapter(agent, {
  mode: 'stream',  // ← Change from 'generate'
  streamText: true,
});

// agents/movie-agent/index.ts
const executor = new A2AAdapter(agent, {
  mode: 'stream',  // ← Change from 'generate'
  streamText: true,
  includeHistory: true,
});

// agents/airbnb-agent/index.ts
const executor = new A2AAdapter(agent, {
  mode: 'stream',  // ← Change from 'generate'
  streamText: true,
});
```

### Phase 2: Convert Medium-Value Agents

- github-agent
- analytics-agent (already generates artifacts, add text streaming)
- currency-agent (already generates artifacts, add text streaming)
- weather-agent

### Phase 3: Keep Simple Agents as `generate` (Optional)

- hello-world (educational/demo purpose)
- dice-agent (ultra-short responses)

---

## Special Cases

### Analytics & Currency Agents

**Current**: `mode: 'generate'` + `generateArtifacts` (async)  
**Proposed**: `mode: 'stream'` + `generateArtifacts` (async)

**Benefits**:
- Stream analysis text in real-time
- Generate chart/conversion artifact after completion
- Best of both worlds

```typescript
// analytics-agent/index.ts
const executor = new A2AAdapter(agent, {
  mode: 'stream',  // ← Stream analysis text
  streamText: true,
  generateArtifacts: generateChartArtifacts,  // ← Chart after completion
});
```

### Coder Agent

**Current**: Already streaming perfectly! ✅

```typescript
const executor = new A2AAdapter(agent, {
  mode: 'stream',
  streamText: true,
  parseArtifacts: parseCodeArtifacts,  // Real-time code extraction
});
```

---

## Conclusion

### Your Intuition is Correct! ✅

**All agents CAN be streamed**, and **most SHOULD be streamed** for better UX.

### Recommended Defaults

| Agent Type | Mode | Rationale |
|------------|------|-----------|
| **Long responses** (coder, content-editor, movie) | `'stream'` | Essential for UX |
| **Medium responses** (github, weather, airbnb) | `'stream'` | Significant UX improvement |
| **Short responses** (hello-world, dice) | `'generate'` or `'stream'` | Minimal difference |

### Action Items

1. ✅ Already have explicit `mode` config
2. 🔄 Convert 8 agents from `'generate'` to `'stream'`
3. ✅ Keep 2 simple agents as `'generate'` (educational/demo)
4. 🧪 Test streaming UX improvements

---

## References

- Article on A2A streaming: https://baeke.info/2025/07/15/using-tasks-with-streaming-in-google-agent2agent-a2a/
- AI SDK streamText docs: https://sdk.vercel.ai/docs/ai-sdk-core/generating-text#streamtext

