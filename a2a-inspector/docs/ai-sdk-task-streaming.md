# AI SDK Task Streaming (A2A) — Current Behavior & Planned Fix

Reference:

- [AI SDK `UIMessage` reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/ui-message)
- [AI SDK UI Chatbot (`useChat`) guide](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot)
- [AI Elements Chatbot example](https://ai-sdk.dev/elements/examples/chatbot)

## Goal

Use AI SDK v6 `useChat` **as natively as possible**, while mapping A2A task streams so that:

- **Working status updates** stream progressively (deltas) as the task progresses.
- The **final completed payload** may differ from streamed deltas and therefore must **replace** what the user saw during streaming.
- The UI does **not** flash duplicate content when the final payload arrives.
- The final assistant message is labeled correctly (e.g. **kind = task** when a task completes).

## A2A semantics (important)

- **Message**: a single payload (one response).
- **Task**: a stream of many payloads over time (status-update, artifact-update, task), culminating in a final "completed" payload.

This doc is about the **mapping layer** between A2A events and AI SDK's `UIMessage`/parts model — not changing A2A semantics.

---

## How AI SDK `useChat` Streaming Works (CRITICAL)

From the [AI SDK Chatbot docs](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot), the standard pattern:

```tsx
{messages.map(message => (
  <div key={message.id}>
    {message.role === 'user' ? 'User: ' : 'AI: '}
    {message.parts.map((part, index) =>
      part.type === 'text' ? <span key={index}>{part.text}</span> : null,
    )}
  </div>
))}
```

### Key insight: ONE text part, GROWS as deltas arrive

During streaming:

1. Provider emits: `text-start` with an `id` → creates a new text part in the message
2. Provider emits: `text-delta` with same `id` and `delta` string → **APPENDS** to that text part's `.text`
3. Provider emits: `text-delta` again → **APPENDS** more text
4. Provider emits: `text-end` with same `id` → closes that text part

Result: **ONE** text part whose `.text` property grew incrementally.

```
text-start(id="abc")           →  parts: [{ type: "text", text: "" }]
text-delta(id="abc", "Hello")  →  parts: [{ type: "text", text: "Hello" }]
text-delta(id="abc", " world") →  parts: [{ type: "text", text: "Hello world" }]
text-end(id="abc")             →  parts: [{ type: "text", text: "Hello world" }] (closed)
```

### What happens if we emit multiple `text-start` events with DIFFERENT IDs?

Each `text-start` creates a **NEW** text part:

```
text-start(id="abc")           →  parts: [{ type: "text", text: "" }]
text-delta(id="abc", "Hello")  →  parts: [{ type: "text", text: "Hello" }]
text-start(id="xyz")           →  parts: [{ type: "text", text: "Hello" }, { type: "text", text: "" }]
text-delta(id="xyz", "World")  →  parts: [{ type: "text", text: "Hello" }, { type: "text", text: "World" }]
```

Result: **TWO** text parts. The UI renders both.

---

## Current Problem Analysis

### What we WANT

Task streaming should work like this:

```
Status update 1: "Hel"         → UI shows: "Hel"
Status update 2: "Hello"       → UI shows: "Hello" (replaced/grown)
Status update 3: "Hello wor"   → UI shows: "Hello wor"
Status update 4: "Hello world" → UI shows: "Hello world"
Completed:       "Hello world" → UI shows: "Hello world" (same, no flash)
```

This requires a SINGLE text part that GROWS (or is replaced in-place).

### What's CURRENTLY happening

**Symptom**: "each task part is streamed the ui very briefly displays each chunk before the final message appears"

This suggests:
- Each chunk appears momentarily
- Then it's replaced by the next chunk
- Finally the "completed" content appears

### Root cause analysis

Looking at `model.ts` `handleStatusUpdate()`:

```typescript
// WORKING STATE
const snapshotText = event.status.message.parts.filter(isTextPart).map(p => p.text).join("");
const prevText = streamedTextById.get(textStreamId) ?? "";
const delta = snapshotText.startsWith(prevText)
  ? snapshotText.slice(prevText.length)  // True delta
  : snapshotText;                         // Full snapshot if can't compute delta

this.enqueueParts(controller, [{ kind: "text", text: delta }], textStreamId, false, activeTextIds);
streamedTextById.set(textStreamId, snapshotText);
```

**Problem 1: Snapshot-to-delta conversion can fail**

If A2A agent sends independent status messages (not cumulative snapshots):
- Update 1: "Processing..."
- Update 2: "Thinking..."   ← Does NOT start with "Processing..."
- Update 3: "Hello world"   ← Does NOT start with "Thinking..."

Our logic falls back to emitting the FULL text as a delta, causing accumulation:
```
"Processing..." + "Thinking..." + "Hello world" = "Processing...Thinking...Hello world"
```

**Problem 2: Separate stream ID for completed content**

```typescript
// COMPLETED STATE
if (hasStreamedContentForTask) {
  controller.enqueue({ type: "text-end", id: textStreamId });
  activeTextIds.delete(textStreamId);
  
  const completedStreamId = `${textStreamId}-completed`;  // ← DIFFERENT ID
  this.enqueueParts(controller, event.status.message.parts, completedStreamId, true, activeTextIds);
}
```

This creates TWO text parts:
1. Working stream (`taskId`): accumulated deltas
2. Completed stream (`taskId-completed`): authoritative final text

The UI then has two text parts, causing a "flash" when completed arrives.

**Problem 3: UI renders all text parts during streaming**

Even with our "render only last text part" fix, during streaming:
1. Working text part exists and is being rendered
2. Completed stream starts → new text part appears
3. Brief moment where BOTH exist before React re-renders

---

## Correct Approach: Single Stream ID, Cumulative Deltas

### Strategy

1. **Use ONE stream ID** (`taskId`) for the entire task lifecycle
2. **Emit TRUE deltas** only when we can compute them (snapshot starts with previous)
3. **For non-cumulative agents**: emit the full snapshot but RESET the accumulated text
4. **On completed**: if content matches accumulated, do nothing; if different, emit a CLEAR + full text

### The key realization

The AI SDK expects `text-delta` to APPEND. There's no "replace" operation.

For A2A agents that send cumulative snapshots:
- We can compute true deltas → works perfectly with AI SDK

For A2A agents that send non-cumulative status messages:
- Option A: Don't stream status messages at all; wait for completed
- Option B: Treat each status as a "status indicator" (not response content)
- Option C: Use a custom data part for status, only emit text for completed

### Recommendation: Option C (cleanest)

Status update text in "working" state → emit as `data-a2a-status` (for UI status indicator)
Status update text in "completed" state → emit as `text-delta` (actual response)

This way:
- `useChat` accumulates only the final response text
- Status indicators are shown via custom data parts (ephemeral UI)
- No "flash" or accumulation issues

---

## Implementation Plan

### A) Provider changes (`model.ts`)

1. **Don't stream working status text as text-delta**
   - Working state message text is a STATUS INDICATOR, not response content
   - Emit it as a custom data part (or don't emit at all if server handles raw events)

2. **Only emit text-delta for completed state**
   - This is the authoritative response text
   - Single `text-start` → `text-delta` (full text) → `text-end`

3. **Remove the separate `-completed` stream logic**
   - No need for "replacement" if we only emit completed text

### B) Server changes (`ai-sdk-chat.ts`)

- Already emits raw A2A events via `data-a2a-event` custom parts
- Status indicator text can be shown from these events in the UI

### C) Client changes (`ai-sdk-view.tsx`)

1. **Remove onFinish deduplication**
   - No longer needed if provider emits single text part

2. **Show status indicator from raw events**
   - While streaming, show the latest "status-update" event's text as a status line
   - Once completed arrives, show the final message text

3. **Standard parts rendering**
   - `message.parts.map(...)` renders the single text part (from completed)
   - No need for "render only last text part" hack

---

## Alternative: Keep Working Deltas (if agents send true cumulative snapshots)

If we want to show working progress AND the agent sends cumulative snapshots:

### Provider logic

```typescript
// WORKING STATE - emit delta if cumulative
if (snapshotText.startsWith(prevText)) {
  const delta = snapshotText.slice(prevText.length);
  if (delta.length > 0) {
    this.enqueueParts(controller, [{ kind: "text", text: delta }], textStreamId, false, activeTextIds);
  }
} else {
  // Non-cumulative: skip text streaming, let completed handle it
  // Or: close current stream and start fresh (creates new text part - not ideal)
}
streamedTextById.set(textStreamId, snapshotText);

// COMPLETED STATE - emit remaining delta or full text if different
const completedText = event.status.message.parts.filter(isTextPart).map(p => p.text).join("");
const accumulatedText = streamedTextById.get(textStreamId) ?? "";

if (completedText.startsWith(accumulatedText)) {
  // Completed is extension of accumulated - emit delta
  const delta = completedText.slice(accumulatedText.length);
  if (delta.length > 0) {
    this.enqueueParts(controller, [{ kind: "text", text: delta }], textStreamId, false, activeTextIds);
  }
} else if (completedText === accumulatedText) {
  // Perfect match - nothing to do
} else {
  // Completed differs - we HAVE to create a new stream (no replace in AI SDK)
  // This will cause a brief flash, but it's unavoidable
  controller.enqueue({ type: "text-end", id: textStreamId });
  const completedStreamId = `${textStreamId}-completed`;
  this.enqueueParts(controller, event.status.message.parts, completedStreamId, true, activeTextIds);
}

// Close the stream
controller.enqueue({ type: "text-end", id: textStreamId });
```

---

## Acceptance criteria

- **No flash** of duplicate message content when task completes (unless completed genuinely differs from accumulated)
- Working status updates stream smoothly if agent sends cumulative deltas
- If agent sends non-cumulative status messages, they're shown as status indicators, not accumulated junk
- Final message replaces working content if they differ
- Kind chip correctly shows `task` at completion
- Raw Events view remains intact

---

## Next steps

1. Review actual A2A agent behavior (do they send cumulative snapshots or independent messages?)
2. Choose implementation: "completed only" vs "cumulative deltas"
3. Update provider, server, and client accordingly
4. Test with multiple agent types
