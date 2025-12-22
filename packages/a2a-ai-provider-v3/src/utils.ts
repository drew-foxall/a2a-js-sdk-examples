/**
 * A2A V3 Provider Utilities
 *
 * Helper functions for converting between A2A protocol types and AI SDK V3 types.
 *
 * ## Conversion Categories
 *
 * 1. **Finish Reason Mapping**: A2A TaskState → AI SDK FinishReason
 * 2. **Part Serialization**: A2A Part ↔ JSON-safe A2aSerializedPart
 * 3. **Metadata Extraction**: A2A Task/Message → A2aProviderMetadata
 * 4. **Type Guards**: Runtime type checking for A2A part types
 *
 * ## Why Serialization?
 *
 * A2A SDK types use `Record<string, unknown>` for metadata, but AI SDK's
 * `providerMetadata` requires `JSONObject`. These utilities handle safe
 * conversion while preserving all A2A protocol information.
 *
 * @module
 */

import type { LanguageModelV3FinishReason } from "@ai-sdk/provider";
import type {
  FilePart,
  Message,
  Part,
  Task,
  TaskState,
  TaskStatusUpdateEvent,
  TextPart,
} from "@drew-foxall/a2a-js-sdk";
import type {
  A2AStreamEventData,
  A2aProviderMetadata,
  A2aSerializedArtifact,
  A2aSerializedPart,
  A2aSerializedStatusMessage,
} from "./types.js";
import { fromJSONObject, toJSONObject, toJSONObjectOrNull } from "./types.js";

// ============================================================================
// Finish Reason Mapping
// ============================================================================

/**
 * Map A2A TaskStatusUpdateEvent to AI SDK V3 finish reason.
 *
 * Used during streaming to determine when the response is complete.
 *
 * ## Mapping Logic
 *
 * | A2A State | AI SDK FinishReason | Notes |
 * |-----------|---------------------|-------|
 * | completed | "stop" | Normal completion |
 * | input-required | "stop" | Check `inputRequired` flag for details |
 * | auth-required | "error" | Agent needs authentication |
 * | failed | "error" | Task processing failed |
 * | canceled | "stop" | Task was canceled |
 * | rejected | "error" | Agent rejected the request |
 * | submitted | "stop" | (Rare) Task queued |
 * | working | "unknown" | Still processing |
 *
 * @param event - A2A TaskStatusUpdateEvent from streaming
 * @returns AI SDK finish reason
 *
 * @see https://a2a-protocol.org/latest/topics/life-of-a-task/
 */
export function mapFinishReason(event: TaskStatusUpdateEvent): LanguageModelV3FinishReason {
  const state = event.status.state;

  if (state === "completed") return "stop";
  if (state === "input-required") return "stop";
  if (state === "auth-required") return "error";
  if (state === "failed") return "error";
  if (state === "canceled") return "stop";
  if (state === "rejected") return "error";
  if (state === "submitted") return "stop";
  if (state === "unknown") return "unknown";
  if (state === "working") return "unknown";

  return "unknown";
}

/**
 * Map A2A TaskState to AI SDK V3 finish reason.
 *
 * Used for non-streaming responses where we have the final task state.
 *
 * **Important**: AI SDK V3 doesn't have a dedicated "needs-input" finish reason.
 * When `taskState === "input-required"`, this returns `"stop"`, but consumers
 * should check `providerMetadata.a2a.inputRequired` to detect this case.
 *
 * ```typescript
 * const result = await generateText({ model, prompt });
 *
 * if (result.finishReason === 'stop') {
 *   // Could be completed OR input-required - check metadata
 *   if (result.providerMetadata?.a2a?.inputRequired) {
 *     // Handle input-required case
 *   }
 * }
 * ```
 *
 * @param taskState - A2A task state (or null/undefined)
 * @returns AI SDK finish reason
 */
export function mapTaskStateToFinishReason(
  taskState?: TaskState | null
): LanguageModelV3FinishReason {
  if (!taskState) return "stop";

  switch (taskState) {
    case "completed":
      return "stop";
    case "input-required":
      return "stop";
    case "auth-required":
      return "error";
    case "failed":
      return "error";
    case "canceled":
      return "stop";
    case "rejected":
      return "error";
    case "submitted":
    case "working":
      return "unknown";
    default:
      return "unknown";
  }
}

// ============================================================================
// Response Metadata Extraction
// ============================================================================

/**
 * Extract AI SDK response metadata from an A2A event.
 *
 * Maps A2A identifiers and timestamps to AI SDK's response format.
 *
 * @param event - A2A event (Task, Message, or update event)
 * @returns Object with `id`, `modelId`, and `timestamp` for AI SDK response
 */
export function getResponseMetadata(event: A2AStreamEventData) {
  if (event.kind === "task") {
    return {
      id: event.id,
      modelId: undefined,
      timestamp: event.status?.timestamp ? new Date(event.status.timestamp) : undefined,
    };
  }
  if (event.kind === "message") {
    return {
      id: event.messageId,
      modelId: undefined,
      timestamp: undefined,
    };
  }
  if (event.kind === "status-update") {
    return {
      id: event.taskId,
      modelId: undefined,
      timestamp: event.status?.timestamp ? new Date(event.status.timestamp) : undefined,
    };
  }
  if (event.kind === "artifact-update") {
    return {
      id: event.taskId,
      modelId: undefined,
      timestamp: undefined,
    };
  }

  return {};
}

// ============================================================================
// Part Type Guards
// ============================================================================
// A2A Parts use discriminated unions with `kind` field. These type guards
// enable safe access to part-specific properties at runtime.

/**
 * Type guard for A2A TextPart.
 *
 * TextParts contain plain text content.
 *
 * ```typescript
 * for (const part of message.parts) {
 *   if (isTextPart(part)) {
 *     console.log(part.text); // Type-safe access to text
 *   }
 * }
 * ```
 *
 * @param part - Any A2A Part
 * @returns True if part is a TextPart
 */
export function isTextPart(part: Part): part is TextPart {
  return part.kind === "text";
}

/**
 * Type guard for A2A FilePart.
 *
 * FileParts contain binary files (images, documents, etc.) either inline
 * (base64 bytes) or by reference (URI).
 *
 * ```typescript
 * for (const part of message.parts) {
 *   if (isFilePart(part)) {
 *     // Further narrow to bytes or URI variant
 *     if (isFilePartWithBytes(part)) {
 *       const data = part.file.bytes; // Base64 string
 *     } else if (isFilePartWithUri(part)) {
 *       const url = part.file.uri; // Remote URL
 *     }
 *   }
 * }
 * ```
 *
 * @param part - Any A2A Part
 * @returns True if part is a FilePart
 */
export function isFilePart(part: Part): part is FilePart {
  return part.kind === "file";
}

/**
 * Type guard for A2A DataPart.
 *
 * DataParts contain structured JSON data. Use these for custom events,
 * form data, or any structured information beyond text/files.
 *
 * ```typescript
 * // Extract custom events from agent response
 * const dataEvents = message.parts
 *   .filter(isDataPart)
 *   .map(part => part.data);
 *
 * for (const data of dataEvents) {
 *   if (data.eventType === 'selection-required') {
 *     showSelectionUI(data.options);
 *   }
 * }
 * ```
 *
 * @param part - Any A2A Part
 * @returns True if part is a DataPart
 */
export function isDataPart(
  part: Part
): part is Part & { kind: "data"; data: Record<string, unknown> } {
  return part.kind === "data";
}

/**
 * Type guard for FilePart containing inline bytes.
 *
 * Use this to check if a FilePart has base64-encoded content
 * (as opposed to a URI reference).
 *
 * @param part - An A2A FilePart
 * @returns True if file has inline bytes
 */
export function isFilePartWithBytes(
  part: FilePart
): part is FilePart & { file: { bytes: string; mimeType?: string; name?: string } } {
  return "bytes" in part.file;
}

/**
 * Type guard for FilePart containing a URI reference.
 *
 * Use this to check if a FilePart references a remote URL
 * (as opposed to inline base64 bytes).
 *
 * @param part - An A2A FilePart
 * @returns True if file has URI reference
 */
export function isFilePartWithUri(
  part: FilePart
): part is FilePart & { file: { uri: string; mimeType?: string; name?: string } } {
  return "uri" in part.file;
}

// ============================================================================
// Part Serialization (A2A Part ↔ Serialized Part)
// ============================================================================
// These functions convert between A2A SDK's Part type and JSON-serializable
// A2aSerializedPart. This is necessary because AI SDK's providerMetadata
// must be JSON-compatible, but A2A SDK uses Record<string, unknown>.

/**
 * Serialize an A2A Part to JSON-safe format for `providerMetadata`.
 *
 * Converts A2A SDK's `Part` type to `A2aSerializedPart`, which is
 * safe for transport via AI SDK's `providerMetadata`. Handles:
 *
 * - **TextPart**: Text content preserved as-is
 * - **FilePart**: Base64 bytes or URI reference preserved
 * - **DataPart**: Structured data converted via `toJSONObject`
 *
 * Metadata fields are converted from `Record<string, unknown>` to
 * `JSONObject` via `toJSONObject`, dropping non-JSON-compatible values.
 *
 * @param part - A2A SDK Part to serialize
 * @returns JSON-safe serialized part
 *
 * @see deserializePart - Reverse operation
 */
export function serializePart(part: Part): A2aSerializedPart {
  if (part.kind === "text") {
    return {
      kind: "text",
      text: part.text,
      metadata: toJSONObject(part.metadata),
    };
  }
  if (part.kind === "data") {
    return {
      kind: "data",
      data: toJSONObject(part.data),
      metadata: toJSONObject(part.metadata),
    };
  }
  if (part.kind === "file") {
    const filePart: A2aSerializedPart = {
      kind: "file",
      metadata: toJSONObject(part.metadata),
    };
    if ("bytes" in part.file) {
      filePart.file = {
        mimeType: part.file.mimeType,
        name: part.file.name,
        bytes: part.file.bytes,
      };
    } else if ("uri" in part.file) {
      filePart.file = {
        mimeType: part.file.mimeType,
        name: part.file.name,
        uri: part.file.uri,
      };
    }
    return filePart;
  }
  return { kind: "data", data: {} };
}

/**
 * Deserialize a JSON part back to A2A SDK Part format.
 *
 * Converts `A2aSerializedPart` (from `providerMetadata`) back to
 * A2A SDK's `Part` type for use with A2A SDK functions.
 *
 * Useful when you need to send parts from a previous response
 * back to an agent:
 *
 * ```typescript
 * // Get parts from previous response metadata
 * const serializedParts = result.providerMetadata?.a2a?.statusMessage?.parts;
 *
 * // Convert back to A2A SDK format
 * const parts = serializedParts?.map(deserializePart) ?? [];
 *
 * // Use with A2A SDK directly or re-serialize for another request
 * ```
 *
 * @param serialized - JSON-safe serialized part from providerMetadata
 * @returns A2A SDK Part
 *
 * @see serializePart - Reverse operation
 */
export function deserializePart(serialized: A2aSerializedPart): Part {
  const metadata = fromJSONObject(serialized.metadata);

  if (serialized.kind === "text") {
    return {
      kind: "text",
      text: serialized.text ?? "",
      metadata,
    } satisfies TextPart;
  }
  if (serialized.kind === "data") {
    return {
      kind: "data",
      data: fromJSONObject(serialized.data ?? {}),
      metadata,
    };
  }
  if (serialized.kind === "file" && serialized.file) {
    if (serialized.file.bytes) {
      return {
        kind: "file",
        file: {
          mimeType: serialized.file.mimeType,
          name: serialized.file.name,
          bytes: serialized.file.bytes,
        },
        metadata,
      } satisfies FilePart;
    }
    if (serialized.file.uri) {
      return {
        kind: "file",
        file: {
          mimeType: serialized.file.mimeType,
          name: serialized.file.name,
          uri: serialized.file.uri,
        },
        metadata,
      } satisfies FilePart;
    }
  }
  return { kind: "data", data: {} };
}

// ============================================================================
// Metadata Extraction
// ============================================================================

/**
 * Extract A2A-specific metadata from a Task or Message response.
 *
 * This function processes the A2A response and creates an `A2aProviderMetadata`
 * object that will be exposed via `result.providerMetadata.a2a`.
 *
 * ## What Gets Extracted
 *
 * | Field | Source | Description |
 * |-------|--------|-------------|
 * | `taskId` | Task.id | Task identifier for follow-ups |
 * | `contextId` | Task/Message.contextId | Conversation context |
 * | `taskState` | Task.status.state | Current lifecycle state |
 * | `inputRequired` | Derived | True if state is "input-required" |
 * | `statusMessage` | Task.status.message | Serialized response message |
 * | `artifacts` | Task.artifacts | Serialized output artifacts |
 * | `metadata` | Task/Message.metadata | Extension metadata |
 *
 * ## Task vs Message Response
 *
 * A2A servers can return either:
 * - **Task**: Long-running work with status and lifecycle
 * - **Message**: Immediate response (no task tracking)
 *
 * For Message responses, `taskId`, `taskState`, and `artifacts` will be null/empty.
 *
 * @param response - A2A Task or Message response
 * @returns Serialized metadata for `providerMetadata.a2a`
 *
 * @see https://a2a-protocol.org/latest/topics/key-concepts/
 */
export function extractA2aMetadata(response: Task | Message): A2aProviderMetadata {
  if (response.kind === "task") {
    const taskState = response.status?.state ?? null;

    // Serialize status message if present
    let statusMessage: A2aSerializedStatusMessage | null = null;
    if (response.status?.message) {
      const msg = response.status.message;
      statusMessage = {
        messageId: msg.messageId,
        role: msg.role,
        parts: msg.parts.map((p) => serializePart(p)),
        metadata: toJSONObject(msg.metadata),
      };
    }

    // Serialize artifacts
    const artifacts: A2aSerializedArtifact[] = (response.artifacts ?? []).map((artifact) => ({
      artifactId: artifact.artifactId,
      name: artifact.name,
      description: artifact.description,
      parts: artifact.parts.map((p) => serializePart(p)),
      metadata: toJSONObject(artifact.metadata),
    }));

    // Extract finalText from completed task's status message
    const finalText =
      taskState === "completed" && statusMessage
        ? statusMessage.parts
            .filter((p): p is { kind: "text"; text: string } => p.kind === "text")
            .map((p) => p.text)
            .join("")
        : null;

    return {
      taskId: response.id,
      contextId: response.contextId ?? null,
      taskState: taskState,
      inputRequired: taskState === "input-required",
      statusMessage,
      finalText,
      artifacts,
      metadata: toJSONObjectOrNull(response.metadata),
    };
  }

  // Message response - serialize the message parts
  const messageText = response.parts
    .filter((p): p is { kind: "text"; text: string } => p.kind === "text")
    .map((p) => p.text)
    .join("");

  return {
    taskId: null,
    contextId: response.contextId ?? null,
    taskState: null,
    inputRequired: false,
    statusMessage: {
      messageId: response.messageId,
      role: response.role,
      parts: response.parts.map((p) => serializePart(p)),
      metadata: toJSONObject(response.metadata),
    },
    finalText: messageText || null,
    artifacts: [],
    metadata: toJSONObjectOrNull(response.metadata),
  };
}
