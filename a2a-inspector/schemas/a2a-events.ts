/**
 * A2A Event Data Part Schemas
 *
 * Defines zod schemas for A2A events that are passed through the AI SDK
 * stream as custom data parts. This allows the useChat hook to receive
 * raw A2A events alongside the text stream.
 *
 * ## Source of Truth
 *
 * The A2A JS SDK (@drew-foxall/a2a-js-sdk) is the source of truth for event types.
 * The `A2AEventKind` type is derived from `A2AStreamEvent["kind"]` which comes from:
 * - Task.kind = "task"
 * - Message.kind = "message"
 * - TaskStatusUpdateEvent.kind = "status-update"
 * - TaskArtifactUpdateEvent.kind = "artifact-update"
 *
 * See: types/inspector.ts for type definitions
 *
 * ## How It Works
 *
 * 1. Server: The API route uses createUIMessageStream to emit both
 *    text parts (from streamText) and data parts (raw A2A events)
 *
 * 2. Client: useChat receives data parts via the onData callback,
 *    validated against these schemas via dataPartSchemas
 *
 * ## Usage
 *
 * ```typescript
 * // Server (API route)
 * writer.write({
 *   type: "data-a2a-event",
 *   data: { kind: "status-update", timestamp: Date.now(), event: rawEvent }
 * });
 *
 * // Client (useChat)
 * const { messages } = useChat({
 *   dataPartSchemas: a2aDataPartSchemas,
 *   onData: (part) => {
 *     if (part.type === "data-a2a-event") {
 *       handleA2AEvent(part.data);
 *     }
 *   }
 * });
 * ```
 */

import { z } from "zod";
import type { A2AEventKind } from "@/types";

/**
 * A2A event kinds that can be received from the stream.
 *
 * This schema validates the `kind` discriminator from A2A SDK types.
 * The values are derived from A2AStreamEvent["kind"] plus "error".
 *
 * @see types/inspector.ts - A2AEventKind type definition
 * @see @drew-foxall/a2a-js-sdk - Source of truth for A2A types
 */
export const a2aEventKindSchema = z.enum([
  "task",
  "message",
  "status-update",
  "artifact-update",
  "error",
]) satisfies z.ZodType<A2AEventKind>;

/**
 * Schema for a raw A2A event passed through the data stream.
 *
 * The `event` field contains the full raw A2A event object from @drew-foxall/a2a-js-sdk,
 * which can be a Task, Message, TaskStatusUpdateEvent, or TaskArtifactUpdateEvent.
 */
export const a2aEventDataSchema = z.object({
  /** Event kind for categorization - matches A2A SDK discriminator */
  kind: a2aEventKindSchema,
  /** Timestamp when the event was received (ms since epoch) */
  timestamp: z.number(),
  /** The full raw A2A event object (Task | Message | TaskStatusUpdateEvent | TaskArtifactUpdateEvent) */
  event: z.unknown(),
  /** Extracted text content from the event (if any) */
  textContent: z.string().optional(),
  /** Task ID associated with this event */
  taskId: z.string().optional(),
  /** Context ID associated with this event */
  contextId: z.string().optional(),
  /** Message ID if this is a message event */
  messageId: z.string().optional(),
});

export type A2AEventData = z.infer<typeof a2aEventDataSchema>;

/**
 * Data part schemas for useChat configuration.
 *
 * Use this with the dataPartSchemas option in useChat:
 *
 * ```typescript
 * const { messages } = useChat({
 *   dataPartSchemas: a2aDataPartSchemas,
 *   onData: (part) => { ... }
 * });
 * ```
 */
export const a2aDataPartSchemas = {
  "a2a-event": a2aEventDataSchema,
} as const;

/**
 * Type for the data part union (for type inference in onData callback)
 */
export type A2ADataParts = {
  "a2a-event": A2AEventData;
};

// Re-export A2AEventKind for convenience
export type { A2AEventKind };
