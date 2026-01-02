/**
 * Utils Tests - Focus on serialization round-trips and edge cases
 */

import type { Message, Part, Task } from "@drew-foxall/a2a-js-sdk";
import { describe, expect, it } from "vitest";
import {
  deserializePart,
  extractA2aMetadata,
  mapTaskStateToFinishReason,
  serializePart,
} from "./utils.js";

describe("mapTaskStateToFinishReason", () => {
  it.each([
    ["completed", "stop"],
    ["input-required", "stop"],
    ["canceled", "stop"],
    ["failed", "error"],
    ["auth-required", "error"],
    ["rejected", "error"],
    ["working", "other"],
    ["submitted", "other"],
    [null, "stop"],
    [undefined, "stop"],
  ] as const)("maps %s → %s", (state, expected) => {
    const result = mapTaskStateToFinishReason(state);
    expect(result.unified).toBe(expected);
    // raw should match state or be undefined for null/undefined
    if (state === null || state === undefined) {
      expect(result.raw).toBeUndefined();
    } else {
      expect(result.raw).toBe(state);
    }
  });
});

describe("serializePart / deserializePart round-trip", () => {
  it("round-trips text parts", () => {
    const original: Part = { kind: "text", text: "Hello", metadata: { key: "value" } };
    const result = deserializePart(serializePart(original));

    expect(result.kind).toBe("text");
    expect((result as { text: string }).text).toBe("Hello");
    expect(result.metadata?.key).toBe("value");
  });

  it("round-trips file parts with bytes", () => {
    const original: Part = {
      kind: "file",
      file: { bytes: "SGVsbG8=", mimeType: "text/plain", name: "test.txt" },
    };
    const result = deserializePart(serializePart(original));

    expect(result.kind).toBe("file");
    const file = (result as { file: { bytes: string } }).file;
    expect(file.bytes).toBe("SGVsbG8=");
  });

  it("round-trips file parts with URI", () => {
    const original: Part = {
      kind: "file",
      file: { uri: "https://example.com/file.pdf", mimeType: "application/pdf" },
    };
    const result = deserializePart(serializePart(original));

    expect(result.kind).toBe("file");
    const file = (result as { file: { uri: string } }).file;
    expect(file.uri).toBe("https://example.com/file.pdf");
  });

  it("round-trips data parts", () => {
    const original: Part = { kind: "data", data: { event: "test", values: [1, 2] } };
    const result = deserializePart(serializePart(original));

    expect(result.kind).toBe("data");
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data.event).toBe("test");
  });
});

describe("extractA2aMetadata", () => {
  it("extracts from completed task", () => {
    const task: Task = {
      kind: "task",
      id: "task-123",
      contextId: "ctx-456",
      status: {
        state: "completed",
        timestamp: new Date().toISOString(),
        message: {
          kind: "message",
          messageId: "msg-789",
          role: "agent",
          parts: [{ kind: "text", text: "Done" }],
        },
      },
      artifacts: [{ artifactId: "art-1", parts: [{ kind: "text", text: "Artifact" }] }],
    };

    const metadata = extractA2aMetadata(task);

    expect(metadata.taskId).toBe("task-123");
    expect(metadata.contextId).toBe("ctx-456");
    expect(metadata.taskState).toBe("completed");
    expect(metadata.inputRequired).toBe(false);
    expect(metadata.statusMessage?.parts[0].text).toBe("Done");
    expect(metadata.artifacts).toHaveLength(1);
  });

  it("detects input-required state", () => {
    const task: Task = {
      kind: "task",
      id: "task-123",
      status: { state: "input-required", timestamp: new Date().toISOString() },
    };

    const metadata = extractA2aMetadata(task);

    expect(metadata.inputRequired).toBe(true);
    expect(metadata.taskState).toBe("input-required");
  });

  it("extracts from direct message", () => {
    const message: Message = {
      kind: "message",
      messageId: "msg-123",
      contextId: "ctx-456",
      role: "agent",
      parts: [{ kind: "text", text: "Response" }],
    };

    const metadata = extractA2aMetadata(message);

    expect(metadata.taskId).toBeNull();
    expect(metadata.contextId).toBe("ctx-456");
    expect(metadata.statusMessage?.parts[0].text).toBe("Response");
  });
});
