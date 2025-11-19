# Automatic Adapter Assessment

## Executive Summary

**Question:** Can we create a single "automatic" adapter that wraps any `ToolLoopAgent` without requiring the developer to choose between simple/streaming modes?

**Answer:** ✅ **YES - Using Configuration-Driven Behavior Selection**

**Key Insight:** The adapter selection isn't based on the *agent* - it's based on the *use case requirements*. We can detect these requirements from configuration and automatically adapt behavior.

---

## Current Problem

Developers must manually choose which adapter to use:

```typescript
// Developer must know: "Does my agent need streaming? Artifacts?"
// Choice 1: Simple adapter
const executor = new A2AAgentAdapter(agent, { ... });

// Choice 2: Streaming adapter
const executor = new A2AStreamingAdapter(agent, { ... });
```

**Issues:**
- ❌ Requires developer to understand adapter differences
- ❌ Two separate classes to learn
- ❌ Wrong choice = missing functionality or unnecessary complexity
- ❌ Not "automatic" at all

---

## Root Cause Analysis

### What Triggers Each Adapter?

Let me analyze when each function would be called from a `ToolLoopAgent`:

#### A2AAgentAdapter (Simple)

**Triggered when:**
1. ✅ Agent output is **text-only** (no files, no artifacts)
2. ✅ Response can be **processed at once** (no streaming needed)
3. ✅ Custom state parsing may be needed (COMPLETED/AWAITING_USER_INPUT)
4. ✅ Optional conversation history

**AI SDK Interaction:**
```typescript
// Calls agent.generate() - blocking, returns complete result
const result = await agent.generate({
  prompt: userPrompt,
  messages: history,
  ...options
});
// Process complete result once
const text = result.text;
```

**Examples:**
- Content Editor (text → edited text)
- Movie Agent (question → answer)
- Any Q&A agent

---

#### A2AStreamingAdapter (Streaming)

**Triggered when:**
1. ✅ Agent output contains **artifacts** (code files, images, etc.)
2. ✅ Artifacts need to be **emitted incrementally** (as they're generated)
3. ✅ User wants **real-time updates** (see progress)
4. ✅ Large responses benefit from streaming

**AI SDK Interaction:**
```typescript
// Calls agent.stream() - yields chunks
const { stream } = await agent.stream({
  prompt: userPrompt,
  messages: history,
});

// Process each chunk incrementally
for await (const chunk of stream) {
  // Parse artifacts from accumulated text
  // Emit artifacts as they're completed
}
```

**Examples:**
- Coder Agent (code files emitted as generated)
- Image generation (images emitted progressively)
- Large document generation

---

## Common Pattern Discovery

### Key Observation: Configuration Determines Behavior

The adapter choice isn't about the *agent* - it's about:

1. **Do you need artifacts?** → Streaming adapter
2. **Do you want real-time updates?** → Streaming adapter
3. **Otherwise** → Simple adapter

**This can be automatic!**

---

## Proposed Solution: Unified Automatic Adapter

### Architecture

```typescript
/**
 * Automatic A2A Adapter
 * 
 * Adapts its behavior based on configuration:
 * - If artifact parsing provided → Use streaming mode
 * - Otherwise → Use simple mode
 * 
 * NO manual mode selection required!
 */
class A2AAdapter implements AgentExecutor {
  constructor(
    private agent: ToolLoopAgent<any, any, any>,
    private config: {
      // Artifact parsing (optional) - triggers streaming mode
      parseArtifacts?: (text: string) => ParsedArtifacts;
      
      // Build final message for artifacts (optional)
      buildFinalMessage?: (artifacts, text) => string;
      
      // Custom state parsing (optional) - works in both modes
      parseTaskState?: (text: string) => TaskState;
      
      // Response transformation (optional) - simple mode only
      transformResponse?: (result: any) => string;
      
      // Include conversation history (optional) - works in both modes
      includeHistory?: boolean;
      
      // Working message (optional) - works in both modes
      workingMessage?: string;
      
      // Debug logging (optional)
      debug?: boolean;
    }
  ) {}
  
  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus) {
    // AUTOMATIC DETECTION: Check configuration to determine mode
    const isStreamingMode = !!this.config.parseArtifacts;
    
    if (isStreamingMode) {
      // Use streaming execution with artifact support
      return this.executeStreaming(requestContext, eventBus);
    } else {
      // Use simple blocking execution
      return this.executeSimple(requestContext, eventBus);
    }
  }
  
  private async executeSimple(...) {
    // Simple mode: call agent.generate(), process once
  }
  
  private async executeStreaming(...) {
    // Streaming mode: call agent.stream(), process chunks, emit artifacts
  }
}
```

### Usage: Automatic Behavior

```typescript
// Example 1: Content Editor (automatically uses simple mode)
const contentEditor = new A2AAdapter(contentEditorAgent, {
  workingMessage: "Editing content...",
  // No parseArtifacts → AUTOMATIC: Simple mode
});

// Example 2: Movie Agent (automatically uses simple mode + custom state)
const movieAgent = new A2AAdapter(movieAgentAgent, {
  parseTaskState: (text) => {
    if (text.includes('COMPLETED')) return 'completed';
    if (text.includes('AWAITING_USER_INPUT')) return 'input-required';
    return 'completed';
  },
  includeHistory: true,
  // No parseArtifacts → AUTOMATIC: Simple mode
});

// Example 3: Coder Agent (automatically uses streaming mode)
const coderAgent = new A2AAdapter(coderAgent, {
  parseArtifacts: (text) => extractCodeBlocks(text), // ← Triggers streaming!
  buildFinalMessage: (artifacts, text) => `Generated ${artifacts.length} files`,
  // parseArtifacts provided → AUTOMATIC: Streaming mode
});
```

**No manual mode selection!** The adapter automatically detects what's needed! ✨

---

## Detailed Pattern Analysis

### Pattern 1: Configuration Keys Determine Behavior

| Configuration Present | Auto-Selected Mode | Reason |
|----------------------|-------------------|---------|
| `parseArtifacts` | **Streaming** | Artifacts require incremental emission |
| `buildFinalMessage` (alone) | Simple | Just customizes final text |
| `parseTaskState` (alone) | Simple | Just customizes state parsing |
| `transformResponse` (alone) | Simple | Simple mode feature |
| `includeHistory` (alone) | Simple | Works in both, defaults to simple |
| None of above | Simple | Default to simplest mode |

### Pattern 2: AI SDK Method Selection

```typescript
// Automatic method selection
private async invokeAgent(messages: AIMessage[], config: Config) {
  if (config.parseArtifacts) {
    // Streaming mode needed
    return this.agent.stream({ messages });
  } else {
    // Simple mode sufficient
    return this.agent.generate({ messages });
  }
}
```

### Pattern 3: Shared Task Lifecycle

**Both modes follow the same A2A lifecycle:**
1. Create task (if new)
2. Publish "working" status
3. **[Mode-specific execution]**
4. Publish final status (completed/failed/canceled)

**Only step 3 differs!**

---

## Implementation: Single Unified Adapter

### File Structure

```
samples/js/src/shared/
├── a2a-adapter.ts           # NEW: Single unified adapter
├── types.ts                 # Shared types
└── index.ts                 # Exports
```

### Code Structure

```typescript
// a2a-adapter.ts

export interface A2AAdapterConfig {
  // Streaming mode trigger
  parseArtifacts?: (text: string) => ParsedArtifacts;
  buildFinalMessage?: (artifacts: ParsedArtifact[], text: string) => string;
  
  // Simple mode features
  parseTaskState?: (text: string) => TaskState;
  transformResponse?: (result: any) => string;
  
  // Common features
  includeHistory?: boolean;
  workingMessage?: string;
  debug?: boolean;
}

export class A2AAdapter implements AgentExecutor {
  constructor(
    private agent: ToolLoopAgent<any, any, any>,
    private config: A2AAdapterConfig = {}
  ) {}
  
  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus) {
    // Setup (common)
    const { taskId, contextId, messages } = this.setupTask(requestContext);
    this.publishWorkingStatus(taskId, contextId, eventBus);
    
    try {
      // AUTOMATIC MODE SELECTION
      if (this.isStreamingMode()) {
        await this.executeStreaming(taskId, contextId, messages, eventBus);
      } else {
        await this.executeSimple(taskId, contextId, messages, eventBus);
      }
    } catch (error) {
      this.publishFailure(taskId, contextId, error, eventBus);
    }
  }
  
  /**
   * Automatic mode detection
   */
  private isStreamingMode(): boolean {
    // If artifact parsing is configured, we need streaming
    return !!this.config.parseArtifacts;
  }
  
  /**
   * Simple mode: blocking execution, single response
   */
  private async executeSimple(
    taskId: string,
    contextId: string,
    messages: AIMessage[],
    eventBus: ExecutionEventBus
  ) {
    // Call agent.generate() - blocking
    const result = await this.agent.generate({ messages, contextId });
    
    // Transform response (if configured)
    const text = this.config.transformResponse 
      ? this.config.transformResponse(result)
      : result.text;
    
    // Parse state (if configured)
    const state = this.config.parseTaskState
      ? this.config.parseTaskState(text)
      : 'completed';
    
    // Publish final status
    this.publishFinalStatus(taskId, contextId, text, state, eventBus);
  }
  
  /**
   * Streaming mode: incremental execution, artifact emission
   */
  private async executeStreaming(
    taskId: string,
    contextId: string,
    messages: AIMessage[],
    eventBus: ExecutionEventBus
  ) {
    const { stream, text: responsePromise } = await this.agent.stream({ 
      messages, 
      contextId 
    });
    
    let accumulatedText = '';
    const artifacts = new Map<string, string>();
    const artifactOrder: string[] = [];
    
    // Process chunks incrementally
    for await (const chunk of stream) {
      accumulatedText += chunk.text;
      
      // Check cancellation
      if (this.isCancelled(taskId)) {
        this.publishCancellation(taskId, contextId, eventBus);
        return;
      }
      
      // Parse artifacts from accumulated text
      if (this.config.parseArtifacts) {
        const parsed = this.config.parseArtifacts(accumulatedText);
        
        // Emit new/updated artifacts
        for (const artifact of parsed.artifacts) {
          if (artifact.done && artifact.filename) {
            const prev = artifacts.get(artifact.filename);
            const current = artifact.content.trim();
            
            if (prev !== current) {
              artifacts.set(artifact.filename, current);
              if (!artifactOrder.includes(artifact.filename)) {
                artifactOrder.push(artifact.filename);
              }
              
              // Emit artifact update
              this.publishArtifact(taskId, contextId, artifact, eventBus);
            }
          }
        }
      }
    }
    
    // Build final message
    const fullResponse = await responsePromise;
    const finalParsed = this.config.parseArtifacts!(accumulatedText);
    const finalMessage = this.config.buildFinalMessage
      ? this.config.buildFinalMessage(finalParsed.artifacts, fullResponse)
      : this.buildDefaultFinalMessage(artifactOrder, fullResponse);
    
    // Publish final status
    this.publishFinalStatus(taskId, contextId, finalMessage, 'completed', eventBus);
  }
  
  // ... shared helper methods ...
}
```

---

## Benefits of Automatic Adapter

### 1. **Zero Decision Overhead** 🧠
Developers don't need to understand adapter types:
```typescript
// Just configure what you need, adapter handles the rest
const executor = new A2AAdapter(myAgent, {
  parseArtifacts: extractFiles,  // ← Automatically triggers streaming
});
```

### 2. **Impossible to Use Wrong Adapter** ✅
Configuration determines behavior - no wrong choices possible.

### 3. **Single Class to Learn** 📚
One adapter, one import, one API surface.

### 4. **Configuration-Driven** ⚙️
Behavior is explicit in configuration, not hidden in class choice.

### 5. **Easy to Extend** 🔧
Add new features without creating new adapter classes.

---

## Comparison: Manual vs Automatic

### Before (Manual Selection)

```typescript
// Developer must know: "Do I need streaming?"
import { A2AAgentAdapter, A2AStreamingAdapter } from './shared';

// Content Editor - must choose "simple"
const contentEditor = new A2AAgentAdapter(agent, { ... });

// Coder - must choose "streaming"
const coder = new A2AStreamingAdapter(agent, { 
  streamFunction: async function* (agent, messages) { ... },  // Awkward!
  parseArtifacts: extractCodeBlocks,
});
```

**Problems:**
- ❌ Two classes to learn
- ❌ Must understand streaming vs non-streaming
- ❌ Wrong choice = missing functionality
- ❌ StreamFunction boilerplate

### After (Automatic Selection)

```typescript
// Developer just configures what they need
import { A2AAdapter } from './shared';

// Content Editor - automatically simple mode
const contentEditor = new A2AAdapter(agent, {
  workingMessage: "Editing content...",
});

// Coder - automatically streaming mode (detected from parseArtifacts)
const coder = new A2AAdapter(agent, {
  parseArtifacts: extractCodeBlocks,  // ← Triggers streaming automatically
  workingMessage: "Generating code...",
});
```

**Benefits:**
- ✅ One class to learn
- ✅ Configuration is self-documenting
- ✅ Automatic behavior selection
- ✅ No boilerplate

---

## Migration Path

### Phase 1: Create Unified Adapter
- Extract common base logic
- Implement automatic mode detection
- Implement both execution paths

### Phase 2: Migrate Agents (Backward Compatible)
- Update Content Editor to use `A2AAdapter`
- Update Movie Agent to use `A2AAdapter`
- Update Coder Agent to use `A2AAdapter`

### Phase 3: Deprecate Old Adapters (Optional)
- Keep old adapters for backward compatibility
- Mark as deprecated
- Update documentation

### Phase 4: Clean Up (Future)
- Remove old adapters in next major version

---

## Code Reduction Metrics

| Component | Before | After | Change |
|-----------|--------|-------|--------|
| A2AAgentAdapter | 414 lines | - | Removed |
| A2AStreamingAdapter | 443 lines | - | Removed |
| A2AAdapter (unified) | - | ~500 lines | New |
| **Total** | **857 lines** | **500 lines** | **-42%** |

**Net Result:** -357 lines, simpler API!

---

## Potential Concerns

### Concern 1: "What if I need custom streaming logic?"

**Answer:** Add optional `streamFunction` config:
```typescript
new A2AAdapter(agent, {
  streamFunction: async function* (agent, messages) {
    // Custom streaming logic
  },
  parseArtifacts: ...,
});
```

### Concern 2: "What about performance?"

**Answer:** Automatic detection is O(1) - just checking if config key exists. Zero performance impact.

### Concern 3: "Is this more complex?"

**Answer:** Implementation is slightly more complex (~100 lines), but API is **dramatically simpler** for users.

### Concern 4: "What if requirements change?"

**Answer:** Just update configuration - no code changes needed:
```typescript
// Start simple
new A2AAdapter(agent, {});

// Later: add artifacts
new A2AAdapter(agent, {
  parseArtifacts: extractFiles,  // ← Automatically switches to streaming!
});
```

---

## Alternative Approaches

### Approach 1: Automatic Mode Detection via Agent Introspection ❌

```typescript
// Try to detect from agent definition
const adapter = new A2AAdapter(agent);
// Automatically detect if agent has tools, needs streaming, etc.
```

**Problems:**
- ❌ Agent doesn't expose enough metadata
- ❌ Can't detect artifact requirements
- ❌ Too much "magic" - unclear behavior

### Approach 2: Smart Defaults + Override ⚠️

```typescript
const adapter = new A2AAdapter(agent, {
  mode: 'auto',  // or 'simple', 'streaming'
  ...
});
```

**Problems:**
- ⚠️ Still requires understanding modes
- ⚠️ 'auto' mode ambiguous

### Approach 3: Configuration-Driven (RECOMMENDED) ✅

```typescript
const adapter = new A2AAdapter(agent, {
  parseArtifacts: ...,  // ← Presence triggers streaming
  ...
});
```

**Benefits:**
- ✅ Clear and explicit
- ✅ No magic
- ✅ Self-documenting
- ✅ Easy to understand

---

## Decision Matrix

| Criteria | Manual<br/>(2 Adapters) | Automatic<br/>(1 Adapter) | Auto-Detect<br/>(Magic) |
|----------|-------------------------|---------------------------|-------------------------|
| **Simplicity** | 5/10 | **10/10** ✅ | 7/10 |
| **Clarity** | 7/10 | **10/10** ✅ | 4/10 |
| **Flexibility** | 8/10 | **10/10** ✅ | 6/10 |
| **Code Reduction** | 5/10 | **10/10** ✅ | 8/10 |
| **Learning Curve** | 6/10 | **10/10** ✅ | 5/10 |
| **Maintenance** | 5/10 | **10/10** ✅ | 7/10 |
| **Total Score** | 6.0 | **10.0** ✅ | 6.2 |

**Winner:** Automatic Unified Adapter (Configuration-Driven)

---

## Recommendation

### ✅ **YES - Create Single Automatic Adapter**

**Approach:** Configuration-Driven Behavior Selection

**Key Principle:**
> "Configuration presence determines behavior automatically"

**Implementation:**
1. Create `A2AAdapter` class with unified execute method
2. Auto-detect mode based on `config.parseArtifacts` presence
3. Implement both execution paths in same class
4. Migrate all 3 agents to use unified adapter
5. Deprecate old adapters (keep for backward compatibility)

**Benefits:**
- ✅ **42% code reduction** (857 → 500 lines)
- ✅ **Dramatically simpler API** (1 class vs 2)
- ✅ **Zero decision overhead** (automatic behavior)
- ✅ **Configuration is self-documenting**
- ✅ **Impossible to use wrong adapter**

**Effort:** ~3-5 hours
- 2 hours: Implement unified adapter
- 1 hour: Migrate agents
- 1 hour: Testing
- 1 hour: Documentation

**Risk:** ⚠️ Low-Medium (new implementation, but well-understood patterns)

---

## Conclusion

The opportunity for automation is **significant**. Instead of requiring developers to choose between two adapter types, we can:

1. ✅ **Detect streaming need** from `parseArtifacts` configuration
2. ✅ **Automatically select execution mode** (simple vs streaming)
3. ✅ **Unify into single class** with configuration-driven behavior
4. ✅ **Reduce code by 42%** (857 → 500 lines)
5. ✅ **Simplify API dramatically** (1 import, 1 class, 1 decision)

**This is truly "automatic" - the adapter adapts its behavior based on what you configure.**

---

## Next Steps

If approved:
1. Implement unified `A2AAdapter` class
2. Migrate Content Editor agent
3. Migrate Movie Agent  
4. Migrate Coder Agent
5. Update documentation
6. Deprecate old adapters (keep for compatibility)

**Ready to implement?** 🚀

