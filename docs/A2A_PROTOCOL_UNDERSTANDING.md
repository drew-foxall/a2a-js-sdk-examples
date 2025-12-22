# A2A Protocol Understanding

This document captures our understanding of the A2A (Agent-to-Agent) protocol,
particularly around streaming, messages, and parts. This serves as a reference
for future iteration and debugging.

## Official Documentation References

- [Key Concepts](https://raw.githubusercontent.com/a2aproject/A2A/main/docs/topics/key-concepts.md)
- [Life of a Task](https://raw.githubusercontent.com/a2aproject/A2A/main/docs/topics/life-of-a-task.md)
- [Streaming & Async Operations](https://raw.githubusercontent.com/a2aproject/A2A/main/docs/topics/streaming-and-async.md)

## Core Communication Elements

From the A2A protocol specification:

| Element | Description | Key Purpose |
|---------|-------------|-------------|
| **Message** | A single turn of communication between client and agent, containing content and a role ("user" or "agent") | Conveys instructions, context, questions, answers, or status updates |
| **Part** | The fundamental content container (TextPart, FilePart, DataPart) | Provides flexibility for agents to exchange various content types |
| **Artifact** | A tangible output generated during a task (document, image, structured data) | Delivers concrete results of an agent's work |
| **Task** | A stateful unit of work with unique ID and defined lifecycle | Facilitates tracking of long-running operations |

## Task States and Lifecycle

Tasks progress through defined states:

- `submitted` - Task has been received
- `working` - Agent is actively processing
- `input-required` - Agent needs additional input from user
- `auth-required` - Authentication needed
- `completed` - Task finished successfully
- `canceled` - Task was canceled
- `rejected` - Task was rejected
- `failed` - Task encountered an error

## Status Updates vs Response Content

### The Key Distinction

**Status Update Messages** and **Response Content** serve different purposes:

1. **Status Messages** (in `status-update` events during `working` state):
   - Indicate what the agent is doing
   - Examples: "Processing your request...", "Analyzing data...", "Generating response..."
   - These are **ephemeral indicators** - NOT part of the final response
   - Should be displayed differently in UI (e.g., loading indicator, status bar)

2. **Response Content** (in `status-update` events during `completed` state OR streaming deltas):
   - The actual agent response
   - This IS the content the user requested
   - Should be displayed as the conversation message

### Current Bug: Misuse of TextPart for Status Messages

**Problem**: Our Hello World agent sends "Processing your greeting..." as a TextPart:

```typescript
// In adapter.ts publishWorkingStatus()
status: {
  state: "working",
  message: {
    role: "agent",
    parts: [{ kind: "text", text: "Processing your greeting..." }],  // ❌ WRONG
  },
}
```

This causes the status message to be treated as response content and accumulated
with the actual response, resulting in:

```
"Processing your greeting...Hello! How can I assist you today? 😊"
```

**Root Cause**: The `workingMessage` is being sent as a `TextPart` inside the
status update's message. Per A2A protocol, this message field is for conveying
information, but when the status is `working`, the content should be understood
as a status indicator, not response content.

### Proposed Solutions

#### Option 1: Don't Include Message in Working Status (Recommended)

The simplest fix - don't include a message in the working status at all:

```typescript
const workingStatusUpdate: TaskStatusUpdateEvent = {
  kind: "status-update",
  taskId: taskId,
  contextId: contextId,
  status: {
    state: "working",
    // No message - just indicate we're working
    timestamp: new Date().toISOString(),
  },
  final: false,
};
```

Clients can show a generic "Agent is working..." indicator.

#### Option 2: Use DataPart for Status Metadata

If we want to convey status information, use a `DataPart` instead of `TextPart`:

```typescript
status: {
  state: "working",
  message: {
    role: "agent",
    parts: [{
      kind: "data",
      data: {
        type: "status-indicator",
        text: "Processing your greeting...",
        displayAs: "loading"  // Hint for UI
      }
    }],
  },
}
```

This clearly separates status metadata from response content.

#### Option 3: Provider-Side Filtering

The A2A provider could filter out messages from `working` state events:

```typescript
// In handleStatusUpdate()
if (taskState === "working") {
  // Don't emit text content from working state - it's a status indicator
  // Only emit from completed state
}
```

This is what we currently do as a workaround, but it's not ideal because:
- It loses the status information entirely
- Other clients might want to display status messages

## Streaming Behavior

### How Streaming Works in A2A

Per the [Streaming documentation](https://raw.githubusercontent.com/a2aproject/A2A/main/docs/topics/streaming-and-async.md):

1. Client sends `message/stream` request
2. Server responds with SSE stream
3. Stream contains `TaskStatusUpdateEvent` events with incremental content
4. Final event has `final: true` or state is terminal (`completed`, `failed`, etc.)

### Status Update Event Structure

```typescript
interface TaskStatusUpdateEvent {
  kind: "status-update";
  taskId: string;
  contextId: string;
  status: {
    state: TaskState;
    message?: Message;  // Optional message with parts
    timestamp: string;
  };
  final?: boolean;
}
```

### Correct Usage Pattern

```
Event 1: state="working", message=null (or status indicator)
Event 2: state="working", message.parts=[{text: "Hello"}]  // Delta
Event 3: state="working", message.parts=[{text: " world"}] // Delta
Event 4: state="completed", message.parts=[{text: "Hello world!"}] // Full text
```

The `completed` state message contains the **full authoritative text**, not a delta.

## AI SDK Integration Challenges

### The Accumulation Problem

AI SDK's `useChat` hook accumulates all `text-delta` events. When we emit:
1. Working status message ("Processing...")
2. Streaming deltas ("Hello", " world")
3. Completed message ("Hello world!")

The result is: "Processing...Hello worldHello world!" (duplicated/concatenated)

### Our Solution

See `packages/a2a-ai-provider-v3/src/model.ts` and `a2a-inspector/components/views/AISDKView.tsx`:

1. **Provider**: Emits completed content as a SEPARATE text stream (different ID)
2. **Client**: Uses the LAST text part as authoritative content

This works around AI SDK's accumulation behavior while preserving streaming UX.

## Recommendations for Agent Developers

1. **Don't use TextPart for status messages** - Use DataPart or omit the message
2. **Working state deltas should be incremental** - Each delta adds to previous
3. **Completed state contains full text** - Not a delta, the complete response
4. **Use consistent taskId** - All events for a task should use the same taskId
5. **Test with both streaming and non-streaming clients** - Behavior differs

## Files to Review

- `packages/a2a-ai-sdk-adapter/src/adapter.ts` - `publishWorkingStatus()` method
- `packages/a2a-ai-provider-v3/src/model.ts` - `handleStatusUpdate()` method
- `a2a-inspector/components/views/AISDKView.tsx` - `onFinish` handler
- `examples/workers/hello-world/src/index.ts` - `workingMessage` config

## Task vs Message Response

### When to Use Each

Per the [Life of a Task](https://raw.githubusercontent.com/a2aproject/A2A/main/docs/topics/life-of-a-task.md) documentation:

| Response Type | Use Case | Characteristics |
|---------------|----------|-----------------|
| **Message** | Trivial interactions | Immediate, self-contained, no state management |
| **Task** | Stateful interactions | Long-running, trackable, multi-turn capable |

### Examples

**Use Message for:**
- Simple greetings (Hello World agent)
- Quick Q&A without follow-up
- Stateless API-style interactions
- Agents that always complete immediately

**Use Task for:**
- Long-running operations (image generation, data analysis)
- Multi-turn conversations with context
- Operations that need cancellation support
- Workflows with progress tracking

### Current Implementation Gap

**Problem**: Our `A2AAdapter` currently **always creates Tasks**, even for simple agents like Hello World.

The Hello World agent should ideally respond with a **Message** (stateless), not a **Task** (stateful), because:
- Responses are immediate (no long-running processing)
- No state management needed between interactions
- No cancellation support needed
- No progress tracking needed

**Current behavior** (incorrect for simple agents):
```
Client sends: "Hello!"
Server responds: Task { id: "...", status: { state: "submitted" } }
Server streams: status-update { state: "working" }
Server streams: status-update { state: "completed", message: "Hello!" }
Server sends: Task { status: { state: "completed" } }
```

**Ideal behavior** for Hello World:
```
Client sends: "Hello!"
Server responds: Message { role: "agent", parts: [{ kind: "text", text: "Hello!" }] }
```

### Provider Support

The `@drew-foxall/a2a-ai-provider-v3` **does** support Message responses via `handleMessageEvent()`.
The gap is in `A2AAdapter` which always creates Tasks.

## Future Work

1. ~~**Fix the adapter** - Update `publishWorkingStatus()` to not include TextPart~~ ✅ Done
2. **Add Message-only mode to A2AAdapter** - For simple, stateless agents
3. **Add DataPart support** - For proper status metadata
4. **Update all agents** - Remove or fix `workingMessage` usage
5. **Add protocol validation** - Warn when TextPart used in working status
6. **Hello World agent** - Switch to Message-only mode once available

