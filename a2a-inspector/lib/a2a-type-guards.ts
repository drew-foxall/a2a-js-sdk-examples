/**
 * Type guards and safe property accessors for A2A protocol types.
 *
 * These utilities provide type-safe ways to work with A2A events and messages
 * without using type assertions. They validate structure at runtime and let
 * TypeScript infer the correct types through narrowing.
 *
 * @see @drew-foxall/a2a-js-sdk - Source of truth for A2A types
 */

import type {
  Message,
  Part,
  Task,
  TaskArtifactUpdateEvent,
  TaskStatusUpdateEvent,
  TextPart,
} from "@drew-foxall/a2a-js-sdk";

// =============================================================================
// Part Type Guards
// =============================================================================

/**
 * Type guard to check if a value is a valid Part object.
 * Parts are the building blocks of Messages and Artifacts.
 */
export function isPart(value: unknown): value is Part {
  return (
    value !== null &&
    typeof value === "object" &&
    "kind" in value &&
    (value.kind === "text" || value.kind === "file" || value.kind === "data")
  );
}

/**
 * Type guard to check if a Part is a TextPart.
 */
export function isTextPart(part: Part): part is TextPart {
  return part.kind === "text";
}

/**
 * Type guard for inline text part filtering.
 * Useful in array filter operations where you need both kind and text properties.
 */
export function isTextPartWithText(value: unknown): value is { kind: "text"; text: string } {
  return (
    value !== null &&
    typeof value === "object" &&
    "kind" in value &&
    value.kind === "text" &&
    "text" in value &&
    typeof value.text === "string"
  );
}

// =============================================================================
// Helper: Convert unknown to Record for property access
// =============================================================================

/**
 * Safely convert unknown to a record type for property access.
 * Returns undefined if the value is not a non-null object.
 */
function toRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

// =============================================================================
// A2A Event Type Guards
// =============================================================================

/**
 * Type guard to check if an event is a Message.
 */
export function isMessage(event: unknown): event is Message {
  const obj = toRecord(event);
  return obj !== undefined && obj.kind === "message" && "role" in obj && Array.isArray(obj.parts);
}

/**
 * Type guard to check if an event is a Task.
 */
export function isTask(event: unknown): event is Task {
  const obj = toRecord(event);
  return obj !== undefined && obj.kind === "task" && "id" in obj && "status" in obj;
}

/**
 * Type guard to check if an event is a TaskStatusUpdateEvent.
 */
export function isTaskStatusUpdateEvent(event: unknown): event is TaskStatusUpdateEvent {
  const obj = toRecord(event);
  return obj !== undefined && obj.kind === "status-update" && "taskId" in obj && "status" in obj;
}

/**
 * Type guard to check if an event is a TaskArtifactUpdateEvent.
 */
export function isTaskArtifactUpdateEvent(event: unknown): event is TaskArtifactUpdateEvent {
  const obj = toRecord(event);
  return (
    obj !== undefined && obj.kind === "artifact-update" && "taskId" in obj && "artifact" in obj
  );
}

/**
 * Union type for all A2A stream events.
 */
export type A2AStreamEventUnion = Message | Task | TaskStatusUpdateEvent | TaskArtifactUpdateEvent;

/**
 * Type guard to check if an event is any valid A2A stream event.
 */
export function isA2AStreamEvent(event: unknown): event is A2AStreamEventUnion {
  return (
    isMessage(event) ||
    isTask(event) ||
    isTaskStatusUpdateEvent(event) ||
    isTaskArtifactUpdateEvent(event)
  );
}

// =============================================================================
// Safe Property Accessors
// =============================================================================

/**
 * Safely extract a string property from an unknown value.
 * Returns undefined if the value is not an object, property doesn't exist, or isn't a string.
 */
export function getStringProp(obj: unknown, key: string): string | undefined {
  const rec = toRecord(obj);
  if (!rec) return undefined;
  const value = rec[key];
  return typeof value === "string" ? value : undefined;
}

/**
 * Safely extract an object property from an unknown value.
 * Returns undefined if the value is not an object, property doesn't exist, or isn't an object.
 */
export function getObjectProp(obj: unknown, key: string): Record<string, unknown> | undefined {
  const rec = toRecord(obj);
  if (!rec) return undefined;
  return toRecord(rec[key]);
}

/**
 * Safely extract an array property from an unknown value.
 * Returns undefined if the value is not an object, property doesn't exist, or isn't an array.
 */
export function getArrayProp(obj: unknown, key: string): unknown[] | undefined {
  const rec = toRecord(obj);
  if (!rec) return undefined;
  const value = rec[key];
  return Array.isArray(value) ? value : undefined;
}

// =============================================================================
// Text Extraction Utilities
// =============================================================================

/**
 * Extract text content from an array of parts.
 * Filters to TextParts and joins their text content.
 */
export function extractTextFromParts(parts: unknown[]): string {
  return parts
    .filter(isPart)
    .filter(isTextPart)
    .map((part) => part.text)
    .join("");
}

/**
 * Extract text content from a Message.
 */
export function extractTextFromMessage(message: Message): string {
  return message.parts
    .filter(isTextPart)
    .map((part) => part.text)
    .join("");
}

/**
 * Extract text content from a TaskStatusUpdateEvent.
 * Text may be in status.message.parts for streaming agents.
 */
export function extractTextFromStatusUpdate(event: TaskStatusUpdateEvent): string {
  const message = event.status.message;
  const messageObj = toRecord(message);
  if (messageObj) {
    const parts = messageObj.parts;
    if (Array.isArray(parts)) {
      return extractTextFromParts(parts);
    }
  }
  return "";
}

/**
 * Extract text content from a Task.
 * Text may be in the task's history messages.
 */
export function extractTextFromTask(task: Task): string {
  if (task.history) {
    return task.history
      .filter((msg) => msg.role === "agent")
      .flatMap((msg) => msg.parts.filter(isTextPart).map((part) => part.text))
      .join("");
  }
  return "";
}

/**
 * Extract text content from a TaskArtifactUpdateEvent.
 * Text may be in artifact.parts.
 */
export function extractTextFromArtifactUpdate(event: TaskArtifactUpdateEvent): string {
  if (event.artifact?.parts) {
    return event.artifact.parts
      .filter(isTextPart)
      .map((part) => part.text)
      .join("");
  }
  return "";
}

/**
 * Extract text content from any A2A stream event.
 */
export function extractTextFromEvent(event: A2AStreamEventUnion): string {
  if (isMessage(event)) {
    return extractTextFromMessage(event);
  }
  if (isTaskStatusUpdateEvent(event)) {
    return extractTextFromStatusUpdate(event);
  }
  if (isTask(event)) {
    return extractTextFromTask(event);
  }
  if (isTaskArtifactUpdateEvent(event)) {
    return extractTextFromArtifactUpdate(event);
  }
  return "";
}

// =============================================================================
// Validation Helpers (for validators.ts)
// =============================================================================

/**
 * Check if an event has Message-like structure (for validation before type guard).
 * Use this when you need to validate events that might not have the `kind` discriminator.
 */
export function hasMessageStructure(event: object): boolean {
  return "role" in event && "parts" in event;
}

/**
 * Check if an event has Task-like structure (for validation before type guard).
 */
export function hasTaskStructure(event: object): boolean {
  return "id" in event && "status" in event && !("taskId" in event);
}

/**
 * Check if an event has TaskStatusUpdateEvent-like structure.
 */
export function hasTaskStatusUpdateStructure(event: object): boolean {
  return "taskId" in event && "status" in event && !("artifact" in event);
}

/**
 * Check if an event has TaskArtifactUpdateEvent-like structure.
 */
export function hasTaskArtifactUpdateStructure(event: object): boolean {
  return "taskId" in event && "artifact" in event;
}
