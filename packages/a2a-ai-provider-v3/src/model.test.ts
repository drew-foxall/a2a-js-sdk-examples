/**
 * Model Integration Tests - Core A2A user flows
 */

import type { Message, Task, TaskStatusUpdateEvent } from "@drew-foxall/a2a-js-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { a2aV3 } from "./provider.js";
import type { A2aProviderMetadata } from "./types.js";

// Mock ClientFactory
const mockSendMessage = vi.fn();
const mockSendMessageStream = vi.fn();
const mockGetAgentCard = vi.fn();

vi.mock("@drew-foxall/a2a-js-sdk/client", () => ({
  ClientFactory: class {
    async createFromUrl() {
      return {
        sendMessage: mockSendMessage,
        sendMessageStream: mockSendMessageStream,
        getAgentCard: mockGetAgentCard,
      };
    }
  },
}));

// Test fixtures
const completedTask = (text: string, opts: Partial<Task> = {}): Task => ({
  kind: "task",
  id: opts.id ?? "task-123",
  contextId: opts.contextId ?? "ctx-456",
  status: {
    state: "completed",
    timestamp: new Date().toISOString(),
    message: {
      kind: "message",
      messageId: "msg-789",
      role: "agent",
      parts: [{ kind: "text", text }],
    },
  },
  artifacts: opts.artifacts,
});

const inputRequiredTask = (question: string): Task => ({
  kind: "task",
  id: "task-input-123",
  contextId: "ctx-456",
  status: {
    state: "input-required",
    timestamp: new Date().toISOString(),
    message: {
      kind: "message",
      messageId: "msg-789",
      role: "agent",
      parts: [{ kind: "text", text: question }],
    },
  },
});

const messageResponse = (text: string): Message => ({
  kind: "message",
  messageId: "msg-direct",
  contextId: "ctx-789",
  role: "agent",
  parts: [{ kind: "text", text }],
});

describe("A2A Flow: Request/Response", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAgentCard.mockResolvedValue({ capabilities: { streaming: true } });
  });

  it("handles completed task", async () => {
    mockSendMessage.mockResolvedValue(completedTask("Hello from agent!"));

    const model = a2aV3("http://localhost:3001");
    const result = await model.doGenerate({
      inputFormat: "prompt",
      mode: { type: "regular" },
      prompt: [{ role: "user", content: [{ type: "text", text: "Hi" }] }],
    });

    expect(result.finishReason).toBe("stop");
    expect(result.content[0]).toEqual({ type: "text", text: "Hello from agent!" });

    const meta = result.providerMetadata?.a2a as A2aProviderMetadata;
    expect(meta.taskId).toBe("task-123");
    expect(meta.taskState).toBe("completed");
  });

  it("handles direct message response", async () => {
    mockSendMessage.mockResolvedValue(messageResponse("Direct reply"));

    const model = a2aV3("http://localhost:3001");
    const result = await model.doGenerate({
      inputFormat: "prompt",
      mode: { type: "regular" },
      prompt: [{ role: "user", content: [{ type: "text", text: "Hello" }] }],
    });

    const meta = result.providerMetadata?.a2a as A2aProviderMetadata;
    expect(meta.taskId).toBeNull();
    expect(meta.contextId).toBe("ctx-789");
  });
});

describe("A2A Flow: Input-Required", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAgentCard.mockResolvedValue({ capabilities: { streaming: true } });
  });

  it("detects input-required and enables task resumption", async () => {
    mockSendMessage
      .mockResolvedValueOnce(inputRequiredTask("Where to?"))
      .mockResolvedValueOnce(completedTask("Trip planned!"));

    const model = a2aV3("http://localhost:3001");

    // First call - agent needs more info
    const turn1 = await model.doGenerate({
      inputFormat: "prompt",
      mode: { type: "regular" },
      prompt: [{ role: "user", content: [{ type: "text", text: "Plan a trip" }] }],
    });

    const meta1 = turn1.providerMetadata?.a2a as A2aProviderMetadata;
    expect(meta1.inputRequired).toBe(true);
    expect(meta1.taskId).toBe("task-input-123");

    // Second call - resume with taskId
    await model.doGenerate({
      inputFormat: "prompt",
      mode: { type: "regular" },
      prompt: [{ role: "user", content: [{ type: "text", text: "Paris" }] }],
      providerOptions: { a2a: { taskId: meta1.taskId } },
    });

    expect(mockSendMessage.mock.calls[1][0].message.taskId).toBe("task-input-123");
  });
});

describe("A2A Flow: Multi-Turn & Context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAgentCard.mockResolvedValue({ capabilities: { streaming: true } });
  });

  it("maintains context with contextId", async () => {
    mockSendMessage.mockResolvedValue(completedTask("Response", { contextId: "conv-123" }));

    const model = a2aV3("http://localhost:3001");
    await model.doGenerate({
      inputFormat: "prompt",
      mode: { type: "regular" },
      prompt: [{ role: "user", content: [{ type: "text", text: "Continue" }] }],
      providerOptions: { a2a: { contextId: "conv-123" } },
    });

    expect(mockSendMessage.mock.calls[0][0].message.contextId).toBe("conv-123");
  });

  it("uses contextId from model settings", async () => {
    mockSendMessage.mockResolvedValue(completedTask("Response"));

    const model = a2aV3("http://localhost:3001", { contextId: "preset-ctx" });
    await model.doGenerate({
      inputFormat: "prompt",
      mode: { type: "regular" },
      prompt: [{ role: "user", content: [{ type: "text", text: "Hello" }] }],
    });

    expect(mockSendMessage.mock.calls[0][0].message.contextId).toBe("preset-ctx");
  });
});

describe("A2A Flow: Artifacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAgentCard.mockResolvedValue({ capabilities: { streaming: true } });
  });

  it("exposes artifacts in metadata and content", async () => {
    const task = completedTask("Report ready", {
      artifacts: [
        { artifactId: "art-1", name: "report.pdf", parts: [{ kind: "text", text: "Content" }] },
      ],
    });
    mockSendMessage.mockResolvedValue(task);

    const model = a2aV3("http://localhost:3001");
    const result = await model.doGenerate({
      inputFormat: "prompt",
      mode: { type: "regular" },
      prompt: [{ role: "user", content: [{ type: "text", text: "Generate report" }] }],
    });

    const meta = result.providerMetadata?.a2a as A2aProviderMetadata;
    expect(meta.artifacts).toHaveLength(1);
    expect(meta.artifacts[0].artifactId).toBe("art-1");
  });
});

describe("A2A Flow: Custom DataParts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAgentCard.mockResolvedValue({ capabilities: { streaming: true } });
  });

  it("sends and receives custom DataParts", async () => {
    const taskWithData: Task = {
      kind: "task",
      id: "task-123",
      status: {
        state: "input-required",
        timestamp: new Date().toISOString(),
        message: {
          kind: "message",
          messageId: "msg-789",
          role: "agent",
          parts: [
            { kind: "text", text: "Select option:" },
            { kind: "data", data: { type: "selection", options: ["A", "B"] } },
          ],
        },
      },
    };
    mockSendMessage.mockResolvedValue(taskWithData);

    const model = a2aV3("http://localhost:3001");
    const result = await model.doGenerate({
      inputFormat: "prompt",
      mode: { type: "regular" },
      prompt: [{ role: "user", content: [{ type: "text", text: "Start" }] }],
      providerOptions: { a2a: { customParts: [{ kind: "data", data: { event: "click" } }] } },
    });

    // Verify sent
    const sentParts = mockSendMessage.mock.calls[0][0].message.parts;
    expect(sentParts.some((p: { kind: string }) => p.kind === "data")).toBe(true);

    // Verify received
    const meta = result.providerMetadata?.a2a as A2aProviderMetadata;
    const dataParts = meta.statusMessage?.parts.filter((p) => p.kind === "data");
    expect(dataParts?.[0].data?.type).toBe("selection");
  });
});

describe("A2A Flow: Error States", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAgentCard.mockResolvedValue({ capabilities: { streaming: true } });
  });

  it("maps failed/auth-required to error finishReason", async () => {
    const failedTask: Task = {
      kind: "task",
      id: "task-123",
      status: {
        state: "failed",
        timestamp: new Date().toISOString(),
        message: {
          kind: "message",
          messageId: "msg",
          role: "agent",
          parts: [{ kind: "text", text: "Error" }],
        },
      },
    };
    mockSendMessage.mockResolvedValue(failedTask);

    const model = a2aV3("http://localhost:3001");
    const result = await model.doGenerate({
      inputFormat: "prompt",
      mode: { type: "regular" },
      prompt: [{ role: "user", content: [{ type: "text", text: "Fail" }] }],
    });

    expect(result.finishReason).toBe("error");
  });

  it("throws on tool usage (unsupported)", async () => {
    const model = a2aV3("http://localhost:3001");

    await expect(
      model.doGenerate({
        inputFormat: "prompt",
        mode: { type: "regular" },
        prompt: [{ role: "user", content: [{ type: "text", text: "Use tool" }] }],
        tools: { myTool: { type: "function", parameters: { type: "object", properties: {} } } },
      })
    ).rejects.toThrow("does not support tools");
  });
});

describe("A2A Flow: Streaming", () => {
  beforeEach(() => vi.clearAllMocks());

  it("streams status and artifact updates", async () => {
    mockGetAgentCard.mockResolvedValue({ capabilities: { streaming: true } });

    const statusUpdate: TaskStatusUpdateEvent = {
      kind: "status-update",
      taskId: "task-123",
      final: true,
      status: {
        state: "completed",
        timestamp: new Date().toISOString(),
        message: {
          kind: "message",
          messageId: "msg",
          role: "agent",
          parts: [{ kind: "text", text: "Done" }],
        },
      },
    };

    async function* streamEvents() {
      yield statusUpdate;
    }
    mockSendMessageStream.mockReturnValue(streamEvents());

    const model = a2aV3("http://localhost:3001");
    const { stream } = await model.doStream({
      inputFormat: "prompt",
      mode: { type: "regular" },
      prompt: [{ role: "user", content: [{ type: "text", text: "Stream" }] }],
    });

    const parts: { type: string }[] = [];
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value as { type: string });
    }

    expect(parts.some((p) => p.type === "finish")).toBe(true);
  });

  it("falls back to non-streaming when unsupported", async () => {
    mockGetAgentCard.mockResolvedValue({ capabilities: { streaming: false } });
    mockSendMessage.mockResolvedValue(completedTask("Fallback response"));

    const model = a2aV3("http://localhost:3001");
    const { stream } = await model.doStream({
      inputFormat: "prompt",
      mode: { type: "regular" },
      prompt: [{ role: "user", content: [{ type: "text", text: "Test" }] }],
    });

    const reader = stream.getReader();
    while (!(await reader.read()).done) {}

    expect(mockSendMessage).toHaveBeenCalled();
    expect(mockSendMessageStream).not.toHaveBeenCalled();
  });
});

describe("File Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAgentCard.mockResolvedValue({ capabilities: { streaming: true } });
    mockSendMessage.mockResolvedValue(completedTask("File received"));
  });

  it("converts Uint8Array to base64", async () => {
    const model = a2aV3("http://localhost:3001");
    await model.doGenerate({
      inputFormat: "prompt",
      mode: { type: "regular" },
      prompt: [
        {
          role: "user",
          content: [
            {
              type: "file",
              data: new Uint8Array([72, 101, 108, 108, 111]),
              mediaType: "text/plain",
            },
          ],
        },
      ],
    });

    const filePart = mockSendMessage.mock.calls[0][0].message.parts[0];
    expect(filePart.file.bytes).toBe(btoa("Hello"));
  });

  it("converts URL to URI", async () => {
    const model = a2aV3("http://localhost:3001");
    await model.doGenerate({
      inputFormat: "prompt",
      mode: { type: "regular" },
      prompt: [
        {
          role: "user",
          content: [
            { type: "file", data: new URL("https://example.com/img.png"), mediaType: "image/png" },
          ],
        },
      ],
    });

    const filePart = mockSendMessage.mock.calls[0][0].message.parts[0];
    expect(filePart.file.uri).toBe("https://example.com/img.png");
  });
});
