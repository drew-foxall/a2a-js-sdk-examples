# AI SDK Agent Class Assessment

## Executive Summary

This document assesses whether our current A2A agent implementations should migrate to the AI SDK's `ToolLoopAgent` class.

**Current State:** All three agents use custom `AgentExecutor` implementations with direct `generateText`/`streamText` calls, tightly coupled to A2A protocol.

**User Vision:** **AI agents defined by AI SDK, made available via A2A protocol** - Clean separation between agent logic and protocol adapter.

**Revised Recommendation:** **YES - Migrate to ToolLoopAgent with A2A Adapter Pattern** for better separation of concerns and reusability.

---

## 🎯 Recommended Architecture: Agent + A2A Adapter Pattern

### The Vision

**Define reusable AI agents with AI SDK, expose them via A2A protocol (or any protocol).**

```
┌─────────────────────────────────────┐
│   ToolLoopAgent (AI SDK Core)      │
│   - Agent logic, tools, loop       │
│   - Protocol-agnostic              │
│   - Reusable everywhere            │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│   A2AAgentAdapter                  │
│   - Translates A2A ↔ Agent         │
│   - Event bus integration          │
│   - Task lifecycle management      │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│   A2A Server (Hono)                │
│   - HTTP endpoints                 │
│   - Agent card                     │
└─────────────────────────────────────┘
```

### Key Benefits

1. **Separation of Concerns**
   - Agent logic lives in ToolLoopAgent (portable)
   - A2A integration lives in adapter (protocol-specific)
   - Changes to agent don't affect A2A, and vice versa

2. **Reusability**
   - Same agent can be exposed via multiple protocols (A2A, MCP, REST API, etc.)
   - Agent can be used in non-server contexts (CLI, tests, embeddings)
   - Share agents across projects without A2A dependencies

3. **Testability**
   - Test agent logic independently of A2A protocol
   - Mock tools without A2A infrastructure
   - Easier unit tests for agent behavior

4. **Maintainability**
   - Update AI SDK features without touching A2A code
   - Update A2A protocol without touching agent logic
   - Clear boundaries between responsibilities

### Example: Movie Agent with Adapter Pattern

```typescript
// 1. Define the agent (protocol-agnostic)
export const movieAgent = new ToolLoopAgent({
  model: 'openai/gpt-4o',
  tools: {
    searchMovies: tool({
      description: 'search TMDB for movies by title',
      inputSchema: z.object({
        query: z.string(),
      }),
      execute: async ({ query }) => searchMovies(query),
    }),
    searchPeople: searchPeopleTool,
  },
  stopWhen: stepCountIs(10),
  callOptionsSchema: z.object({
    goal: z.string().optional(),
  }),
  prepareCall: async ({ options, ...settings }) => ({
    ...settings,
    instructions: getMovieAgentPrompt(options.goal),
  }),
});

// 2. Create A2A adapter
class A2AAgentAdapter implements AgentExecutor {
  constructor(private agent: ToolLoopAgent) {}
  
  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus) {
    const { userMessage, task } = requestContext;
    const taskId = task?.id || uuidv4();
    const contextId = userMessage.contextId || task?.contextId || uuidv4();
    
    // Publish A2A events
    if (!task) {
      eventBus.publish({ kind: "task", id: taskId, ... });
    }
    eventBus.publish({ kind: "status-update", status: { state: "working" }, ... });
    
    // Call the agent
    const result = await this.agent.generate({
      prompt: extractText(userMessage),
      options: { goal: userMessage.metadata?.goal },
    });
    
    // Publish final A2A event
    eventBus.publish({
      kind: "status-update",
      status: { state: "completed", message: ... },
      final: true,
    });
  }
}

// 3. Expose via A2A server
const requestHandler = new DefaultRequestHandler(
  movieAgentCard,
  taskStore,
  new A2AAgentAdapter(movieAgent)
);
```

### Alternative Usage of Same Agent

```typescript
// Use in CLI
const result = await movieAgent.generate({
  prompt: 'Find movies about space',
  options: { goal: 'entertainment recommendations' },
});
console.log(result.text);

// Use in REST API
app.post('/api/movie-query', async (req, res) => {
  const result = await movieAgent.generate({
    prompt: req.body.query,
  });
  res.json({ answer: result.text });
});

// Use in MCP (Model Context Protocol)
const mcpServer = new MCPServer({
  agents: { movie: movieAgent },
});

// Use in testing
describe('movieAgent', () => {
  it('should search for movies', async () => {
    const result = await movieAgent.generate({
      prompt: 'Tell me about Inception',
    });
    expect(result.text).toContain('Inception');
  });
});
```

---

## Current Implementation Analysis

### Architecture Overview

All three agents follow this pattern:

```typescript
// Custom executor implementing AgentExecutor interface
class MovieAgentExecutor implements AgentExecutor {
  async execute(requestContext, eventBus) {
    // 1. Manual task lifecycle management
    // 2. Manual history management
    // 3. Direct AI SDK calls (generateText/streamText)
    // 4. Custom event bus publishing
    // 5. Manual tool integration
  }
}

// Server setup with A2A SDK
const requestHandler = new DefaultRequestHandler(
  agentCard,
  taskStore,
  agentExecutor
);
```

### Agent-Specific Details

#### 1. **Movie Agent** (41241)
- **Complexity:** Medium
- **Tools:** 2 (searchMovies, searchPeople)
- **History:** Manual Map-based conversation tracking
- **Streaming:** No (uses `generateText`)
- **Custom Logic:** Task state parsing (COMPLETED/AWAITING_USER_INPUT)
- **Lines of Code:** ~366

#### 2. **Coder Agent** (41242)
- **Complexity:** High
- **Tools:** None (pure generation)
- **History:** From task object
- **Streaming:** Yes (uses `streamText` with artifacts)
- **Custom Logic:** Markdown parsing, multi-file artifact emission
- **Lines of Code:** ~424

#### 3. **Content Editor Agent** (41243)
- **Complexity:** Low
- **Tools:** None
- **History:** From task object
- **Streaming:** No (uses `generateText`)
- **Custom Logic:** None (straightforward edit)
- **Lines of Code:** ~304

---

## AI SDK v6 ToolLoopAgent Class Overview

### What is the ToolLoopAgent Class?

The AI SDK v6 introduces the [`ToolLoopAgent` class](https://v6.ai-sdk.dev/docs/agents/overview) which provides:

```typescript
import { ToolLoopAgent, stepCountIs, tool } from 'ai';
import { z } from 'zod';

const myAgent = new ToolLoopAgent({
  model: 'openai/gpt-4o',
  instructions: 'You are a helpful assistant', // Note: 'instructions' not 'system'
  tools: {
    searchMovies: tool({
      description: 'search TMDB for movies by title',
      inputSchema: z.object({
        query: z.string().describe('The movie title to search for'),
      }),
      execute: async ({ query }) => searchMovies(query),
    }),
    searchPeople: searchPeopleTool,
  },
  stopWhen: stepCountIs(20), // Default: max 20 steps
});

// Simple usage
const result = await myAgent.generate({
  prompt: 'Find movies about space',
});

console.log(result.text);  // Final answer
console.log(result.steps); // Steps taken by agent
```

### Key Features

1. **Encapsulation:** Model + tools + config in one object
2. **Loop Management:** Automatic multi-step tool calling with `stopWhen` conditions
3. **Type Safety:** Full TypeScript support for tools/outputs
4. **Reusability:** Define once, use everywhere
5. **Simplified API:** Less boilerplate for agent loops
6. **Call Options:** [Dynamic configuration](https://v6.ai-sdk.dev/docs/agents/configuring-call-options) with `callOptionsSchema` and `prepareCall`
7. **Async prepareCall:** Can fetch data (RAG, database) before each agent call
8. **Streaming Support:** `generate()` for full responses, `stream()` for streaming

### Advanced: Call Options Feature

The v6 ToolLoopAgent includes a powerful [Call Options](https://v6.ai-sdk.dev/docs/agents/configuring-call-options) system:

```typescript
const supportAgent = new ToolLoopAgent({
  model: 'openai/gpt-4o',
  callOptionsSchema: z.object({
    userId: z.string(),
    accountType: z.enum(['free', 'pro', 'enterprise']),
  }),
  instructions: 'You are a helpful customer support agent.',
  prepareCall: async ({ options, ...settings }) => {
    // Can be async! Fetch user data, do RAG, etc.
    const userData = await fetchUserData(options.userId);
    
    return {
      ...settings,
      instructions: settings.instructions + `\nUser context: ${userData}`,
      // Can modify: model, tools, activeTools, providerOptions, etc.
    };
  },
});

// Type-safe options required at call time
const result = await supportAgent.generate({
  prompt: 'How do I upgrade?',
  options: { userId: 'user_123', accountType: 'free' },
});
```

**This is powerful for:**
- RAG (fetch documents before each call)
- Dynamic tool configuration
- Per-request model selection
- Injecting runtime context

### What it Does NOT Provide (A2A-Specific)

Despite these features, ToolLoopAgent still lacks A2A protocol integration:

1. **A2A Task Lifecycle:** No built-in support for `Task` objects or states (`submitted`, `working`, `completed`, etc.)
2. **A2A Event Bus:** No hooks for publishing `TaskStatusUpdateEvent`, `TaskArtifactUpdateEvent`, etc.
3. **A2A contextId Tracking:** No concept of A2A's conversation `contextId` system
4. **A2A Message Format:** Uses standard chat messages, not A2A `Message` format with `parts`
5. **Streaming to A2A Artifacts:** No per-chunk hooks for real-time artifact emission
6. **Task Store Integration:** No concept of persistent task storage

---

## Pros of Migrating to Agent Class

### ✅ Advantages

#### 1. **Reduced Boilerplate** (Minor)
**Impact:** Low for our use case

```typescript
// Current (Movie Agent)
const response = await generateText({
  model: getModel(),
  system: getMovieAgentPrompt(goal),
  messages,
  tools: {
    searchMovies: searchMoviesTool,
    searchPeople: searchPeopleTool,
  },
  maxSteps: 10,
});

// With Agent Class
const movieAgent = createAgent({
  model: getModel(),
  system: getMovieAgentPrompt(goal),
  tools: { searchMovies: searchMoviesTool, searchPeople: searchPeopleTool },
  maxSteps: 10,
});
const response = await movieAgent.run({ messages });
```

**Savings:** ~2-3 lines per call (minimal)

#### 2. **Tool Management** (Moderate)
**Impact:** Medium for Movie Agent, None for others

- Movie Agent: Slightly cleaner tool definition
- Coder/Editor: No tools, so no benefit

#### 3. **Type Safety** (Minor)
**Impact:** Low - we already have TypeScript

Our tools are already typed with Zod schemas. Agent class provides marginal improvement.

#### 4. **Reusability** (Moderate)
**Impact:** Medium if agents are used in multiple contexts

If we wanted to reuse agent logic outside the A2A server context, ToolLoopAgent would help. Currently, each agent is tightly coupled to its A2A server.

#### 5. **Call Options & prepareCall** (High)
**Impact:** HIGH for dynamic configuration

The [Call Options](https://v6.ai-sdk.dev/docs/agents/configuring-call-options) feature is powerful:

```typescript
prepareCall: async ({ options, ...settings }) => {
  // Async! Can fetch contextId history, user data, etc.
  const history = await contexts.get(options.contextId);
  const goal = options.goal;
  
  return {
    ...settings,
    instructions: getMovieAgentPrompt(goal),
    // Could even inject history into messages
  };
}
```

This enables:
- RAG: Fetch documents before each call
- Dynamic goal injection
- Per-request model selection
- Potentially managing conversation history

**However:** We still need to manually publish A2A events around it.

#### 6. **Future-Proofing** (High)
**Impact:** High long-term

Vercel is actively developing ToolLoopAgent with more features:
- Memory management
- Multi-agent coordination
- Advanced tooling
- Better observability

---

## Cons of Migrating to Agent Class

### ❌ Disadvantages

#### 1. **No Direct A2A Integration** (Critical)
**Impact:** HIGH

The Agent class knows nothing about:
- A2A `Task` objects
- A2A `ExecutionEventBus`
- A2A task states (`submitted`, `working`, `completed`, etc.)
- A2A `Message` format
- A2A `contextId` and conversation tracking

We would still need ALL of our current `AgentExecutor` wrapper code.

#### 2. **Additional Layer of Abstraction** (Moderate)
**Impact:** Medium

```typescript
// Current: Direct control
const response = await generateText({ ... });

// With Agent: Extra layer
const agent = createAgent({ ... });
const response = await agent.run({ ... });
```

The Agent class sits between us and the AI SDK primitives, potentially obscuring control.

#### 3. **Streaming Complexity** (High for Coder Agent)
**Impact:** HIGH

**Current Coder Agent:**
```typescript
const { textStream } = streamText({ ... });
for await (const chunk of textStream) {
  // Parse code blocks
  // Emit artifact-update events in real-time
  // Track file completion
}
```

**With Agent Class:**
The Agent class doesn't expose fine-grained streaming hooks needed for:
- Incremental markdown parsing
- Real-time artifact emission
- Per-chunk A2A event publishing

We would lose this critical capability or need to work around it.

#### 4. **Refactoring Effort** (High)
**Impact:** HIGH

**Estimated effort per agent:**
- Movie Agent: 4-6 hours (moderate complexity)
- Coder Agent: 8-12 hours (streaming + artifacts)
- Content Editor: 2-4 hours (simple)
- **Total:** 14-22 hours

**Testing effort:** Additional 6-8 hours

**Risk:** Breaking existing functionality, especially streaming artifacts.

#### 5. **Not Solving Our Core Problem** (Critical)
**Impact:** HIGH

Our agents don't struggle with:
- Tool management (Movie Agent works fine)
- Agent loops (Movie Agent already handles multi-step)
- Boilerplate (minimal savings)

Our challenges are A2A-specific:
- Event bus integration
- Task lifecycle management
- Conversation history with contextId
- Streaming to artifacts

**The Agent class doesn't address these.**

#### 6. **Learning Curve** (Low-Medium)
**Impact:** Low for us, Medium for community

Team already familiar with `generateText`/`streamText`. Agent class adds new concepts without clear payoff for our use case.

---

## Detailed Agent Analysis

### Movie Agent

#### Current Strengths
- ✅ Custom conversation history (Map-based, by contextId)
- ✅ Goal metadata handling
- ✅ Task state parsing (COMPLETED/AWAITING_USER_INPUT)
- ✅ Tool calling works perfectly with `generateText`

#### Agent Class Impact
- 🟡 **Minor** benefit from tool encapsulation
- 🟡 **Minor** benefit from reusability
- 🔴 **No benefit** for history management (we need custom Map)
- 🔴 **No benefit** for task state parsing (custom logic still needed)

**Verdict:** Marginal benefit, significant refactoring. **Not recommended.**

---

### Coder Agent

#### Current Strengths
- ✅ Real-time streaming with artifact emission
- ✅ Incremental markdown parsing
- ✅ Per-chunk code block extraction
- ✅ Dynamic artifact updates as files complete

#### Agent Class Impact
- 🔴 **Significant loss** of streaming control
- 🔴 **Cannot** emit artifacts mid-stream easily
- 🔴 **No benefit** (no tools used)
- 🔴 **Major refactoring** required

**Verdict:** Net negative. **Strongly not recommended.**

---

### Content Editor Agent

#### Current Strengths
- ✅ Simple, straightforward implementation
- ✅ Clean `generateText` call
- ✅ Minimal complexity

#### Agent Class Impact
- 🟡 **No real benefit** (no tools, simple flow)
- 🟡 **Slight** increase in abstraction
- 🟢 **Low refactoring** effort

**Verdict:** Neutral. Could migrate as a demonstration, but no compelling reason. **Optional.**

---

## Hybrid Approach Recommendation

### Option A: Keep Current Architecture (Recommended)

**Rationale:**
1. Current implementation is clean and working
2. Agent class doesn't solve our A2A integration challenges
3. Coder Agent's streaming would be compromised
4. Refactoring effort doesn't provide sufficient ROI

**Action:**
- Document why we chose custom executors
- Monitor AI SDK Agent class evolution
- Revisit when A2A-specific features are added

---

### Option B: Add Agent Class Example (Supplementary)

**Rationale:**
- Demonstrate both approaches for educational purposes
- Show Agent class for simple use cases
- Keep existing agents as-is

**Implementation:**
Create a new simplified agent:

```
samples/js/src/agents/
├── movie-agent/          (Current - Custom Executor)
├── coder/                (Current - Custom Executor)
├── content-editor/       (Current - Custom Executor)
└── simple-chat-agent/    (NEW - Agent Class Demo)
```

**Simple Chat Agent Features:**
- Uses AI SDK Agent class
- No complex streaming
- Basic tool calling
- Shows Agent class patterns
- Still integrates with A2A server

**Effort:** 4-6 hours
**Value:** Educational, shows both patterns

---

## Technical Comparison

### Code Comparison: Movie Agent

#### Current Implementation (381 lines)

```typescript
class MovieAgentExecutor implements AgentExecutor {
  async execute(requestContext, eventBus) {
    // Manual task creation
    const initialTask: Task = { ... };
    eventBus.publish(initialTask);
    
    // Manual history
    const historyForLLM = contexts.get(contextId) || [];
    contexts.set(contextId, historyForLLM);
    
    // Direct AI call
    const response = await generateText({
      model: getModel(),
      system: getMovieAgentPrompt(goal),
      messages,
      tools: { searchMovies, searchPeople },
      maxSteps: 10,
    });
    
    // Custom state parsing
    const finalState = parseResponseState(response.text);
    
    // Manual event publishing
    eventBus.publish(finalUpdate);
  }
}
```

#### With ToolLoopAgent (v6) - Estimated ~365 lines

```typescript
// Create agent with call options
const movieAgent = new ToolLoopAgent({
  model: getModel(),
  tools: { searchMovies, searchPeople },
  stopWhen: stepCountIs(10),
  callOptionsSchema: z.object({
    contextId: z.string(),
    goal: z.string().optional(),
  }),
  prepareCall: async ({ options, ...settings }) => {
    // Could fetch history here, but still need to manage contexts Map
    const historyForLLM = contexts.get(options.contextId) || [];
    
    return {
      ...settings,
      instructions: getMovieAgentPrompt(options.goal),
      // Could inject messages, but response format still not A2A
    };
  },
});

class MovieAgentExecutor implements AgentExecutor {
  async execute(requestContext, eventBus) {
    // Still need: Manual task creation
    const initialTask: Task = { ... };
    eventBus.publish(initialTask);
    
    // Still need: Manual history (could be in prepareCall, but still manual)
    const historyForLLM = contexts.get(contextId) || [];
    contexts.set(contextId, historyForLLM);
    
    // Agent call (with call options)
    const response = await movieAgent.generate({
      prompt: userMessage.text,
      options: { contextId, goal },
    });
    
    // Still need: Custom state parsing
    const finalState = parseResponseState(response.text);
    
    // Still need: Manual event publishing
    eventBus.publish(finalUpdate);
  }
}
```

**Savings:** ~16 lines (~4%)
**Tradeoff:** Extra abstraction layer, but prepareCall adds flexibility
**Note:** prepareCall is powerful but doesn't eliminate A2A wrapper code

---

## Migration Complexity Matrix

| Agent | Current Tools | Streaming | Custom Logic | Migration Effort | Risk | Benefit |
|-------|--------------|-----------|--------------|------------------|------|---------|
| Movie Agent | 2 tools | No | State parsing | Medium (6h) | Medium | Low |
| Coder Agent | None | Yes | Artifacts | High (12h) | **High** | **Negative** |
| Content Editor | None | No | None | Low (3h) | Low | None |

**Legend:**
- 🟢 Low: <4 hours, minimal risk
- 🟡 Medium: 4-8 hours, some risk
- 🔴 High: >8 hours, significant risk

---

## Future Considerations

### When Should We Revisit?

Consider migrating IF:

1. **A2A SDK Adds Agent Class Support**
   ```typescript
   // Hypothetical future
   import { A2AAgent } from '@drew-foxall/a2a-js-sdk/agents';
   
   const agent = new A2AAgent({
     card: movieAgentCard,
     agent: createAgent({ ... }),
     taskStore,
   });
   ```

2. **We Need Multi-Agent Orchestration**
   - Agent-to-agent communication
   - Complex workflows spanning multiple agents
   - Agent class provides coordination primitives

3. **We Need Advanced Memory Management**
   - Agent class adds persistent memory features
   - Better than our manual Map-based approach

4. **Vercel Adds A2A Protocol Support**
   - Unlikely, but would change everything
   - Direct AI SDK → A2A integration

### Monitoring

- Follow AI SDK releases: https://github.com/vercel/ai
- Watch for agent class enhancements
- Monitor community patterns for A2A integration

---

## Recommendations (UPDATED)

### Primary Recommendation: **Migrate to ToolLoopAgent + A2A Adapter Pattern**

**Reasons:**
1. ✅ **Separation of concerns:** Agent logic decoupled from A2A protocol
2. ✅ **Reusability:** Same agent can be exposed via A2A, MCP, REST, CLI, tests
3. ✅ **Maintainability:** Update agent or protocol independently
4. ✅ **AI SDK features:** Leverage Call Options, prepareCall, stopWhen, etc.
5. ✅ **Future-proof:** As AI SDK evolves, agents automatically benefit

**Action Items:**
- [x] ~~Document this decision in README~~ → Update to reflect new architecture
- [ ] Create `A2AAgentAdapter` base class in shared utilities
- [ ] Migrate Content Editor Agent (Phase 1 - proof of concept)
- [ ] Migrate Movie Agent (Phase 2 - with Call Options)
- [ ] Evaluate streaming for Coder Agent (Phase 3/4)
- [ ] Document adapter pattern for community
- [ ] Update agent comments to explain ToolLoopAgent approach

**Estimated Total Effort:** 24-40 hours (spread across phases)

---

### Implementation Phases

#### **Phase 1: Create A2AAgentAdapter Base Class** (Priority: HIGH)

Create reusable adapter in `samples/js/src/shared/a2a-agent-adapter.ts`:

```typescript
export class A2AAgentAdapter implements AgentExecutor {
  constructor(
    private agent: ToolLoopAgent,
    private options?: {
      parseTaskState?: (text: string) => TaskState;
      transformResult?: (result: any) => any;
    }
  ) {}
  
  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus) {
    // Generic A2A → ToolLoopAgent adaptation
    // Publish task events, call agent, handle responses
  }
}
```

**Effort:** 6-8 hours  
**Benefit:** Reusable for all agents

---

#### **Phase 2: Migrate Content Editor Agent** (Priority: HIGH)

**Before (Current):**
```typescript
class ContentEditorAgentExecutor implements AgentExecutor {
  async execute(requestContext, eventBus) {
    // 100+ lines of A2A integration + generateText call
  }
}
```

**After (With Adapter):**
```typescript
// Define agent (portable)
export const contentEditorAgent = new ToolLoopAgent({
  model: 'openai/gpt-4o',
  instructions: CONTENT_EDITOR_PROMPT,
});

// Expose via A2A
const executor = new A2AAgentAdapter(contentEditorAgent);
```

**Effort:** 4-6 hours  
**Benefit:** Proves pattern, ~80% code reduction in agent file

---

#### **Phase 3: Migrate Movie Agent with Call Options** (Priority: MEDIUM)

Use Call Options for goal and context:

```typescript
export const movieAgent = new ToolLoopAgent({
  model: 'openai/gpt-4o',
  tools: { searchMovies, searchPeople },
  callOptionsSchema: z.object({
    goal: z.string().optional(),
    contextId: z.string(),
  }),
  prepareCall: async ({ options, ...settings }) => {
    const history = contexts.get(options.contextId) || [];
    return {
      ...settings,
      instructions: getMovieAgentPrompt(options.goal),
      // Can inject history into messages if needed
    };
  },
});
```

**Effort:** 8-12 hours  
**Benefit:** Demonstrates Call Options, agent is fully portable

---

#### **Phase 4: Evaluate Streaming for Coder Agent** (Priority: LOW)

**Option A:** Use ToolLoopAgent.stream() if it supports per-chunk access  
**Option B:** Keep using `streamText()` directly for fine-grained control

Research needed to determine if ToolLoopAgent streaming exposes sufficient hooks for real-time artifact emission.

**Effort:** 12-16 hours (or skip if incompatible)  
**Benefit:** Full migration, but may not be feasible

---

## Conclusion (Revised)

The AI SDK v6 [`ToolLoopAgent` class](https://v6.ai-sdk.dev/docs/agents/overview) with [Call Options](https://v6.ai-sdk.dev/docs/agents/configuring-call-options) provides exactly the separation of concerns we need for building **reusable AI agents exposed via A2A protocol**.

### 🎯 REVISED Final Verdict: **YES - Migrate to Adapter Pattern**

**✅ Recommended Architecture:**
```
ToolLoopAgent (AI SDK) → A2AAgentAdapter → A2A Server
```

**Why This Is Better:**

1. **Separation of Concerns** ⭐⭐⭐
   - Agent logic is protocol-agnostic and reusable
   - A2A is just an adapter/transport layer
   - Clear boundaries between agent and protocol

2. **Reusability** ⭐⭐⭐
   - Same agent can be exposed via A2A, MCP, REST, CLI, etc.
   - Share agents across projects
   - Test agents independently of protocols

3. **Maintainability** ⭐⭐⭐
   - Update agent logic without touching A2A code
   - Update A2A protocol without touching agent logic
   - Leverage AI SDK improvements automatically

4. **AI SDK Features** ⭐⭐
   - Call Options for dynamic configuration
   - `prepareCall` for RAG and context injection
   - Loop control with `stopWhen`
   - Built-in tool management

### ⚠️ Challenges to Address

1. **Streaming Artifacts (Coder Agent)**
   - ToolLoopAgent has `stream()` method but may not expose per-chunk hooks
   - **Solution:** Keep Coder Agent on `streamText()` for now, or use ToolLoopAgent.stream() and parse incrementally
   - **Alternative:** Request AI SDK to add per-chunk callbacks

2. **Conversation History (Movie Agent)**
   - Need to manage A2A contextId-based history
   - **Solution:** Use Call Options to inject history via `prepareCall`
   - Store Map<contextId, messages> outside agent

3. **Task State Parsing**
   - Movie Agent parses COMPLETED/AWAITING_USER_INPUT from responses
   - **Solution:** Keep state parsing in A2A adapter
   - Or use structured output with ToolLoopAgent

### 📋 Migration Strategy

**Phase 1: Content Editor Agent (Easiest)**
- Simple, no tools, no streaming
- Perfect for proving the adapter pattern
- Effort: 4-6 hours

**Phase 2: Movie Agent (Moderate)**
- Leverage Call Options for goal/context injection
- Use `prepareCall` for history management
- Effort: 8-12 hours

**Phase 3: Streaming Adapter (If Needed)**
- Research ToolLoopAgent.stream() capabilities
- Implement streaming A2A adapter if viable
- Effort: 8-16 hours

**Phase 4: Coder Agent (Complex)**
- Migrate if streaming works, otherwise keep `streamText()`
- Effort: 12-16 hours or SKIP if streaming incompatible

### 🎯 Updated Action Items

1. **Create A2AAgentAdapter base class** (reusable)
2. **Migrate Content Editor** to prove pattern
3. **Migrate Movie Agent** leveraging Call Options
4. **Evaluate streaming** for Coder Agent
5. **Document pattern** for community

### 🔄 Comparison

**Old Architecture (Current):**
```
AgentExecutor + generateText/streamText (tightly coupled to A2A)
```
❌ Agent logic tied to A2A protocol
❌ Can't reuse agent elsewhere
❌ Hard to test independently

**New Architecture (Recommended):**
```
ToolLoopAgent (portable) → A2AAgentAdapter → A2A Server
```
✅ Agent is protocol-agnostic
✅ Can expose via multiple protocols
✅ Easy to test and maintain
✅ Leverages AI SDK features

**The key insight:** ToolLoopAgent + A2A Adapter = Best of both worlds

---

## Appendix: Code Examples

### Example 1: Why ToolLoopAgent Doesn't Eliminate A2A Wrapper

```typescript
// What we need for A2A:
class MovieAgentExecutor implements AgentExecutor {
  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus) {
    // 1. A2A Task Creation (NOT handled by ToolLoopAgent)
    const task: Task = {
      kind: "task",
      id: taskId,
      contextId: contextId,
      status: { state: "submitted", ... },
      history: [userMessage],
    };
    eventBus.publish(task);
    
    // 2. A2A Working Status (NOT handled by ToolLoopAgent)
    const workingUpdate: TaskStatusUpdateEvent = {
      kind: "status-update",
      status: { state: "working", ... },
    };
    eventBus.publish(workingUpdate);
    
    // 3. AI Generation (ToolLoopAgent helps here - ~20% of code)
    // Option A: Current
    const response = await generateText({ model, system, messages, tools, maxSteps });
    
    // Option B: With ToolLoopAgent
    const response = await movieAgent.generate({
      prompt: message.text,
      options: { contextId, goal },
    });
    // prepareCall can inject context, but we still manage it externally
    
    // 4. A2A State Parsing (NOT handled by ToolLoopAgent)
    const finalState = parseResponseForTaskState(response.text);
    
    // 5. A2A Completed Status (NOT handled by ToolLoopAgent)
    const finalUpdate: TaskStatusUpdateEvent = {
      kind: "status-update",
      status: { state: finalState, message: ... },
      final: true,
    };
    eventBus.publish(finalUpdate);
  }
}
```

**ToolLoopAgent only helps with #3 (~20% of the code).** 

**Steps #1, #2, #4, #5 (~80%) are A2A-specific and unchanged.**

Even with `prepareCall`, we still need all the A2A event bus integration.

---

### Example 2: Streaming Artifacts Challenge

```typescript
// Current Coder Agent - Works perfectly
for await (const chunk of textStream) {
  accumulatedText += chunk;
  const parsed = extractCodeBlocks(accumulatedText);
  
  for (const file of parsed.files) {
    if (file.done && fileContents.get(file.filename) !== file.content) {
      // Emit artifact-update event in real-time
      const artifactUpdate: TaskArtifactUpdateEvent = {
        kind: "artifact-update",
        artifact: { ... },
      };
      eventBus.publish(artifactUpdate);
    }
  }
}

// With Agent Class - Much harder
const result = await agent.stream({ messages });
// How do we emit incremental artifacts?
// Agent class doesn't expose per-chunk hooks we need
```

---

## Document History

- **Version:** 1.0
- **Date:** 2025-11-18
- **Author:** AI Assistant
- **Status:** Draft for Review
- **Next Review:** 2026-05-18 (6 months)

---

## References

1. [AI SDK Agent Class Documentation](https://ai-sdk.dev/docs/agents/agent-class)
2. [AI SDK Agents Overview](https://ai-sdk.dev/docs/agents/overview)
3. [A2A Protocol Specification](https://github.com/a2aproject)
4. [Current Implementation Repository](https://github.com/drew-foxall/a2a-js-sdk-examples)

