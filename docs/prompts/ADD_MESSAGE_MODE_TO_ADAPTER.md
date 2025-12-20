# Task: Add Dynamic Message/Task Response Selection to A2AAdapter

## Overview

Enhance the `A2AAdapter` to support **dynamic response type selection** - allowing agents to respond with either a stateless **Message** or a stateful **Task** based on the specific request, not a fixed configuration.

This aligns with the A2A protocol specification where agents decide per-request whether the work requires task tracking or can be answered immediately.

## Background

### A2A Protocol Response Types

Per the [A2A Protocol](https://raw.githubusercontent.com/a2aproject/A2A/main/docs/topics/life-of-a-task.md):

> When an agent receives a message from a client, it can respond in one of two fundamental ways:
> - **Respond with a Stateless `Message`**: For immediate, self-contained interactions
> - **Initiate a Stateful `Task`**: For long-running operations with lifecycle tracking

**Key insight**: This is a **per-request decision**, not a per-agent configuration. The same agent might:
- Respond with a **Message** for "What time is it?" (trivial, immediate)
- Respond with a **Task** for "Generate a detailed report" (long-running, needs tracking)

### AI SDK Workflow Patterns

The AI SDK supports various workflow patterns that map to A2A response types:

| AI SDK Pattern | Complexity | A2A Response Type |
|----------------|------------|-------------------|
| Single `generateText` | Simple | **Message** |
| Single `generateObject` | Simple | **Message** |
| Sequential chain | Medium | **Task** (progress tracking useful) |
| Parallel processing | Medium | **Task** (coordination needed) |
| Evaluator-optimizer loops | Complex | **Task** (iterations, may need cancellation) |
| Orchestrator-worker | Complex | **Task** (multi-step coordination) |

### Current Problem

The `A2AAdapter` currently forces a **fixed mode** at configuration time:

```typescript
// Current: Mode is fixed at adapter creation
const config = {
  mode: "stream",   // Always creates Tasks
  mode: "generate", // Always creates Tasks
};
```

This doesn't match A2A protocol semantics where the response type should be determined **per-request**.

### Desired Outcome

```typescript
// New: Agent decides per-request whether to use Message or Task
const adapter = new A2AAdapter(agent, {
  mode: "stream", // Default execution mode for Tasks
  
  // NEW: Hook to determine response type per-request
  selectResponseType: async (context) => {
    // Agent logic decides based on the request
    if (isSimpleQuery(context.userMessage)) {
      return "message"; // Immediate response, no task tracking
    }
    return "task"; // Long-running, needs tracking
  },
});
```

Or alternatively, let the agent itself signal the response type:

```typescript
// Agent returns metadata indicating response type
const result = await agent.generate({ prompt });
// result.metadata.responseType = "message" | "task"
```

## Design Options

### Option A: Configuration Hook (Recommended)

Add a `selectResponseType` hook to the adapter config:

```typescript
interface A2AAdapterConfig {
  mode: "stream" | "generate";
  
  /**
   * Determine response type for each request.
   * 
   * @param context - Request context with user message and existing task
   * @returns "message" for immediate response, "task" for tracked operation
   * @default Always returns "task" (current behavior)
   */
  selectResponseType?: (context: {
    userMessage: Message;
    existingTask?: Task;
  }) => "message" | "task" | Promise<"message" | "task">;
}
```

**Pros:**
- Backward compatible (defaults to current behavior)
- Clear separation of concerns
- Agent-specific logic can be injected

**Cons:**
- Requires configuration per agent

### Option B: Agent Metadata Signal

Let the agent signal response type via return metadata:

```typescript
// In agent execution
const result = await agent.generate({ prompt });

// Agent can set metadata to signal response type
// This requires AI SDK support or custom wrapper
if (result.experimental_providerMetadata?.a2a?.responseType === "message") {
  // Respond with Message
}
```

**Pros:**
- Agent has full control
- No adapter configuration needed

**Cons:**
- Requires AI SDK metadata support
- Less explicit in configuration

### Option C: Heuristic-Based Detection

Automatically detect based on execution characteristics:

```typescript
// If execution completes quickly and has no streaming, use Message
// If execution takes time or streams, use Task
```

**Pros:**
- Zero configuration
- Automatic optimization

**Cons:**
- May make wrong decisions
- Less predictable behavior

## Recommended Implementation: Option A

### Files to Modify

#### 1. `packages/a2a-ai-sdk-adapter/src/adapter.ts`

**A. Update `A2AAdapterConfig` interface:**

```typescript
export interface A2AAdapterConfig {
  /**
   * Execution mode for Task-based responses
   * - 'stream': Uses agent.stream() for real-time streaming
   * - 'generate': Uses agent.generate() for single response
   */
  mode: "stream" | "generate";

  /**
   * Determine response type for each request.
   * 
   * A2A protocol allows agents to respond with either:
   * - "message": Stateless, immediate response (no task tracking)
   * - "task": Stateful, tracked operation with lifecycle
   * 
   * Use "message" for:
   * - Simple queries with immediate answers
   * - Trivial interactions (greetings, quick Q&A)
   * - Operations that don't need progress tracking or cancellation
   * 
   * Use "task" for:
   * - Long-running operations
   * - Multi-step workflows (sequential chains, parallel processing)
   * - Operations that benefit from progress tracking
   * - Operations that may need cancellation
   * - Evaluator-optimizer loops
   * - Orchestrator-worker patterns
   * 
   * @param context - Request context
   * @returns "message" or "task"
   * @default Always returns "task" (backward compatible)
   * 
   * @example
   * // Simple heuristic based on message content
   * selectResponseType: ({ userMessage }) => {
   *   const text = extractText(userMessage);
   *   if (text.length < 50 && !text.includes("generate")) {
   *     return "message";
   *   }
   *   return "task";
   * }
   * 
   * @example
   * // Always use message (for simple agents like Hello World)
   * selectResponseType: () => "message"
   * 
   * @example
   * // Classification-based routing
   * selectResponseType: async ({ userMessage }) => {
   *   const classification = await classifyQuery(userMessage);
   *   return classification.complexity === "simple" ? "message" : "task";
   * }
   */
  selectResponseType?: (context: {
    userMessage: Message;
    existingTask?: Task;
  }) => "message" | "task" | Promise<"message" | "task">;

  // ... existing config options
}
```

**B. Update `execute` method:**

```typescript
async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
  const { userMessage, task: existingTask } = requestContext;

  // Determine response type for this request
  const responseType = this.config.selectResponseType
    ? await this.config.selectResponseType({ userMessage, existingTask })
    : "task"; // Default: backward compatible

  if (responseType === "message") {
    await this.executeAsMessage(userMessage, eventBus);
    return;
  }

  // Existing Task-based logic
  await this.executeAsTask(requestContext, eventBus);
}
```

**C. Add `executeAsMessage` method:**

```typescript
/**
 * Execute request and respond with stateless Message.
 * 
 * Per A2A protocol, Message responses are for immediate, self-contained
 * interactions that don't require state management or progress tracking.
 * 
 * No Task lifecycle events are published (no submitted → working → completed).
 */
private async executeAsMessage(
  userMessage: Message,
  eventBus: ExecutionEventBus
): Promise<void> {
  const contextId = userMessage.contextId || uuidv4();
  
  this.logger.debug("Executing as Message response", {
    messageId: userMessage.messageId,
    contextId,
  });

  const userPrompt = this.extractTextFromMessage(userMessage);

  if (!userPrompt) {
    this.logger.warn("No text found in message", { messageId: userMessage.messageId });
    this.publishErrorMessage(contextId, "No message text to process", eventBus);
    return;
  }

  try {
    // Use generate mode for message responses (no streaming needed)
    const messages = this.prepareMessages(userMessage, undefined);
    const aiMessages: ModelMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const result = await this.agent.generate({ prompt: aiMessages });

    const transformed = this.config.transformResponse
      ? this.config.transformResponse(result)
      : result;

    const responseText = typeof transformed === "string" ? transformed : transformed.text;

    // Publish Message response (NOT a Task)
    const responseMessage: Message = {
      kind: "message",
      role: "agent",
      messageId: uuidv4(),
      contextId: contextId,
      parts: [{ kind: "text", text: responseText }],
      metadata: {},
    };

    eventBus.publish(responseMessage);
    this.logger.debug("Published Message response", { contextId });

  } catch (error: unknown) {
    const errorMessage = this.getErrorMessage(error);
    this.logger.error("Error in Message execution", { error: this.toLogContextError(error) });
    this.publishErrorMessage(contextId, errorMessage, eventBus);
  }
}

/**
 * Publish an error as a Message response.
 */
private publishErrorMessage(
  contextId: string,
  errorText: string,
  eventBus: ExecutionEventBus
): void {
  const errorMessage: Message = {
    kind: "message",
    role: "agent",
    messageId: uuidv4(),
    contextId: contextId,
    parts: [{ kind: "text", text: `Error: ${errorText}` }],
    metadata: {},
  };
  eventBus.publish(errorMessage);
}
```

**D. Refactor existing Task logic into `executeAsTask`:**

```typescript
/**
 * Execute request with full Task lifecycle.
 * 
 * Creates a Task with submitted → working → completed lifecycle.
 * Supports streaming, progress tracking, and cancellation.
 */
private async executeAsTask(
  requestContext: RequestContext,
  eventBus: ExecutionEventBus
): Promise<void> {
  // ... existing execute() logic moved here
}
```

#### 2. `examples/workers/hello-world/src/index.ts`

Update Hello World to use Message responses:

```typescript
const config = defineWorkerConfig<BaseWorkerEnv>({
  agentName: "Hello World Agent",

  createAgent: (model: LanguageModel) => createHelloWorldAgent(model),

  createAgentCard: (baseUrl: string) =>
    buildAgentCard(baseUrl, {
      name: "Hello World Agent",
      description: "The simplest possible A2A agent - responds with friendly greetings",
      skills: [helloWorldSkill],
      capabilities: {
        // No state transition history needed for Message responses
        stateTransitionHistory: false,
      },
    }),

  adapterOptions: {
    mode: "generate",
    // Hello World always responds with Message (simple, immediate)
    selectResponseType: () => "message",
  },
});
```

#### 3. Example: Dynamic Selection Agent

Create an example showing dynamic response type selection:

```typescript
// examples/workers/smart-router/src/index.ts

const config = defineWorkerConfig<BaseWorkerEnv>({
  agentName: "Smart Router Agent",

  createAgent: (model: LanguageModel) => createSmartRouterAgent(model),

  adapterOptions: {
    mode: "stream",
    
    // Dynamic response type based on request complexity
    selectResponseType: async ({ userMessage }) => {
      const text = extractTextFromMessage(userMessage);
      
      // Simple heuristics for demo
      const isSimple = 
        text.length < 100 &&
        !text.toLowerCase().includes("generate") &&
        !text.toLowerCase().includes("analyze") &&
        !text.toLowerCase().includes("create") &&
        !text.toLowerCase().includes("write");
      
      if (isSimple) {
        return "message"; // Quick response, no tracking
      }
      
      return "task"; // Complex request, use task tracking
    },
  },
});
```

#### 4. Example: Classification-Based Routing

More sophisticated example using LLM classification:

```typescript
// In adapter config
selectResponseType: async ({ userMessage }) => {
  const text = extractTextFromMessage(userMessage);
  
  // Use a fast model to classify the request
  const { object: classification } = await generateObject({
    model: classificationModel,
    schema: z.object({
      complexity: z.enum(["trivial", "simple", "complex"]),
      estimatedDuration: z.enum(["instant", "seconds", "minutes"]),
      needsTracking: z.boolean(),
    }),
    prompt: `Classify this user request:
    "${text}"
    
    Determine:
    - Complexity: trivial (greeting, simple question), simple (lookup, quick calculation), complex (generation, analysis, multi-step)
    - Estimated duration: instant (<1s), seconds (1-10s), minutes (>10s)
    - Needs tracking: whether progress updates would be useful`,
  });
  
  // Use Message for trivial/simple instant responses
  if (
    classification.complexity !== "complex" &&
    classification.estimatedDuration === "instant" &&
    !classification.needsTracking
  ) {
    return "message";
  }
  
  return "task";
}
```

## Mapping AI SDK Patterns to Response Types

### Pattern: Sequential Processing (Chains)

```typescript
// Multiple steps → Use Task for progress tracking
selectResponseType: () => "task"

// In execution, can publish status updates between steps:
// Step 1: Generate copy → status-update "Generating initial copy..."
// Step 2: Quality check → status-update "Evaluating quality..."
// Step 3: Improve if needed → status-update "Improving copy..."
// Final: completed
```

### Pattern: Parallel Processing

```typescript
// Multiple parallel operations → Use Task
selectResponseType: () => "task"

// Can show progress as parallel tasks complete:
// status-update "Running security review..."
// status-update "Running performance review..."
// status-update "Running maintainability review..."
// status-update "Aggregating results..."
// completed
```

### Pattern: Evaluator-Optimizer Loops

```typescript
// Iterative improvement → Use Task (may need cancellation)
selectResponseType: () => "task"

// Show iteration progress:
// status-update "Translation attempt 1..."
// status-update "Evaluating translation..."
// status-update "Translation attempt 2..."
// status-update "Quality threshold met"
// completed
```

### Pattern: Orchestrator-Worker

```typescript
// Complex coordination → Use Task
selectResponseType: () => "task"

// Show orchestration progress:
// status-update "Planning implementation..."
// status-update "Implementing file 1 of 3..."
// status-update "Implementing file 2 of 3..."
// status-update "Implementing file 3 of 3..."
// completed with artifacts
```

### Pattern: Simple Query (Routing)

```typescript
// Classification + simple response → Can be Message
selectResponseType: async ({ userMessage }) => {
  const classification = await classifyQuery(userMessage);
  return classification.complexity === "simple" ? "message" : "task";
}
```

## Testing

### Unit Tests

```typescript
describe("A2AAdapter dynamic response type", () => {
  it("should use Message when selectResponseType returns 'message'", async () => {
    const adapter = new A2AAdapter(mockAgent, {
      mode: "generate",
      selectResponseType: () => "message",
    });
    
    await adapter.execute(mockRequestContext, eventBus);
    
    expect(eventBus.published).toHaveLength(1);
    expect(eventBus.published[0].kind).toBe("message");
  });

  it("should use Task when selectResponseType returns 'task'", async () => {
    const adapter = new A2AAdapter(mockAgent, {
      mode: "generate",
      selectResponseType: () => "task",
    });
    
    await adapter.execute(mockRequestContext, eventBus);
    
    // Should have Task lifecycle events
    const kinds = eventBus.published.map(e => e.kind);
    expect(kinds).toContain("task");
    expect(kinds).toContain("status-update");
  });

  it("should default to Task when selectResponseType not provided", async () => {
    const adapter = new A2AAdapter(mockAgent, { mode: "generate" });
    
    await adapter.execute(mockRequestContext, eventBus);
    
    // Should behave as before (Task-based)
    const kinds = eventBus.published.map(e => e.kind);
    expect(kinds).toContain("task");
  });

  it("should support async selectResponseType", async () => {
    const adapter = new A2AAdapter(mockAgent, {
      mode: "generate",
      selectResponseType: async () => {
        await delay(10);
        return "message";
      },
    });
    
    await adapter.execute(mockRequestContext, eventBus);
    
    expect(eventBus.published[0].kind).toBe("message");
  });
});
```

## Acceptance Criteria

- [ ] `selectResponseType` hook added to `A2AAdapterConfig`
- [ ] Hook receives request context (userMessage, existingTask)
- [ ] Hook can return "message" or "task" (sync or async)
- [ ] Default behavior unchanged (returns "task") for backward compatibility
- [ ] `executeAsMessage` method handles Message responses correctly
- [ ] No Task lifecycle events for Message responses
- [ ] Errors in Message mode returned as error Messages
- [ ] Hello World agent updated to use `selectResponseType: () => "message"`
- [ ] Example agent with dynamic selection created
- [ ] Unit tests pass
- [ ] Documentation updated

## References

- [A2A Protocol: Life of a Task](https://raw.githubusercontent.com/a2aproject/A2A/main/docs/topics/life-of-a-task.md)
- [AI SDK: Workflow Patterns](https://sdk.vercel.ai/docs/agents/overview)
- [Anthropic: Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)
- [Local Documentation](../A2A_PROTOCOL_UNDERSTANDING.md)
- Current adapter: `packages/a2a-ai-sdk-adapter/src/adapter.ts`

## Notes

- The `selectResponseType` hook runs BEFORE any agent execution
- For complex classification, consider using a fast/cheap model
- Existing Task in context (`existingTask`) suggests continuing a Task flow
- The `mode` config ("stream" | "generate") only applies to Task responses
- Message responses always use `agent.generate()` (no streaming needed for immediate responses)
- Consider adding telemetry to track Message vs Task usage patterns
