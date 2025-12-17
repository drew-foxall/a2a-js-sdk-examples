/**
 * DurableA2AAdapter Tests
 *
 * Tests the adapter that bridges Workflow DevKit durable workflows with A2A protocol.
 */

import type { Message, Task } from "@drew-foxall/a2a-js-sdk";
import type { ExecutionEventBus, RequestContext } from "@drew-foxall/a2a-js-sdk/server";
import type { ModelMessage } from "ai";
import { describe, expect, it, vi, beforeEach, type Mock } from "vitest";
import { DurableA2AAdapter, type DurableWorkflowFn } from "./durable-adapter.js";

// Mock workflow/api
vi.mock("workflow/api", () => ({ start: vi.fn() }));
import { start as mockStart } from "workflow/api";

// Test Fixtures

/**
 * Creates a mock workflow function with proper typing.
 * The workflow function signature matches DurableWorkflowFn.
 */
function createMockWorkflow<TArgs extends unknown[] = []>(): DurableWorkflowFn<TArgs> {
  // Create a function that matches the workflow signature
  const workflowFn = async (
    _messages: ModelMessage[],
    ..._args: TArgs
  ): Promise<{ messages: ModelMessage[] }> => {
    return { messages: [] };
  };

  // Add the workflowId property that the SWC plugin would add
  const workflow = workflowFn as DurableWorkflowFn<TArgs>;
  workflow.workflowId = "test-workflow-id";

  return workflow;
}

function createMockUserMessage(text = "Hello"): Message {
  return {
    kind: "message",
    role: "user",
    messageId: "msg-123",
    parts: [{ kind: "text", text }],
  };
}

function createMockEventBus(): ExecutionEventBus {
  return { publish: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn() };
}

function createMockRun(responseText = "Test response") {
  return {
    runId: "run-123",
    returnValue: Promise.resolve({
      messages: [{ role: "assistant" as const, content: responseText }],
    }),
  };
}

describe("DurableA2AAdapter", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("Configuration", () => {
    it("should create adapter with minimal and full config", () => {
      const workflow = createMockWorkflow();

      const minimal = new DurableA2AAdapter(workflow);
      expect(minimal).toBeDefined();
      expect(typeof minimal.execute).toBe("function");
      expect(typeof minimal.cancelTask).toBe("function");

      const full = new DurableA2AAdapter(workflow, {
        workingMessage: "Processing...",
        includeHistory: true,
        parseTaskState: (text) => (text.includes("error") ? "failed" : "completed"),
        generateArtifacts: async () => [],
      });
      expect(full).toBeDefined();
    });

    it("should accept workflow args", () => {
      const workflow = createMockWorkflow<[string]>();
      const adapter = new DurableA2AAdapter(workflow, { workflowArgs: ["api-key"] });
      expect(adapter).toBeDefined();
    });
  });

  describe("Execute", () => {
    it("should call start() with workflow and messages", async () => {
      const workflow = createMockWorkflow();
      const adapter = new DurableA2AAdapter(workflow);
      const eventBus = createMockEventBus();
      const context: RequestContext = { userMessage: createMockUserMessage() };

      vi.mocked(mockStart).mockResolvedValue(createMockRun());

      await adapter.execute(context, eventBus);

      expect(mockStart).toHaveBeenCalledWith(workflow, expect.arrayContaining([expect.any(Array)]));
    });

    it("should publish task lifecycle events", async () => {
      const workflow = createMockWorkflow();
      const adapter = new DurableA2AAdapter(workflow, { workingMessage: "Custom message" });
      const eventBus = createMockEventBus();
      const context: RequestContext = { userMessage: createMockUserMessage() };

      vi.mocked(mockStart).mockResolvedValue(createMockRun("Response"));

      await adapter.execute(context, eventBus);

      // Should publish: initial task, working status, completed status
      expect(eventBus.publish).toHaveBeenCalledWith(expect.objectContaining({ kind: "task" }));
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "status-update",
          status: expect.objectContaining({ state: "working" }),
        })
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "status-update",
          final: true,
          status: expect.objectContaining({ state: "completed" }),
        })
      );
    });

    it("should use parseTaskState when provided", async () => {
      const workflow = createMockWorkflow();
      const adapter = new DurableA2AAdapter(workflow, {
        parseTaskState: (text) => (text.includes("need more") ? "input-required" : "completed"),
      });
      const eventBus = createMockEventBus();

      vi.mocked(mockStart).mockResolvedValue(createMockRun("I need more info"));

      await adapter.execute({ userMessage: createMockUserMessage() }, eventBus);

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          status: expect.objectContaining({ state: "input-required" }),
        })
      );
    });

    it("should call generateArtifacts and publish artifact events", async () => {
      const generateArtifacts = vi.fn().mockResolvedValue([
        { artifactId: "artifact-1", parts: [{ kind: "text", text: "Generated" }] },
      ]);

      const workflow = createMockWorkflow();
      const adapter = new DurableA2AAdapter(workflow, { generateArtifacts });
      const eventBus = createMockEventBus();

      vi.mocked(mockStart).mockResolvedValue(createMockRun());

      await adapter.execute({ userMessage: createMockUserMessage() }, eventBus);

      expect(generateArtifacts).toHaveBeenCalled();
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "artifact-update" })
      );
    });

    it("should handle workflow errors gracefully", async () => {
      const workflow = createMockWorkflow();
      const adapter = new DurableA2AAdapter(workflow);
      const eventBus = createMockEventBus();

      vi.mocked(mockStart).mockRejectedValue(new Error("Workflow failed"));

      await adapter.execute({ userMessage: createMockUserMessage() }, eventBus);

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          status: expect.objectContaining({ state: "failed" }),
        })
      );
    });

    it("should handle empty message gracefully", async () => {
      const workflow = createMockWorkflow();
      const adapter = new DurableA2AAdapter(workflow);
      const eventBus = createMockEventBus();
      const emptyMessage: Message = { kind: "message", role: "user", messageId: "msg-123", parts: [] };

      await adapter.execute({ userMessage: emptyMessage }, eventBus);

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ status: expect.objectContaining({ state: "failed" }) })
      );
    });
  });

  describe("History Handling", () => {
    it("should not include history by default", async () => {
      const workflow = createMockWorkflow();
      const adapter = new DurableA2AAdapter(workflow);
      const eventBus = createMockEventBus();
      const existingTask: Task = {
        kind: "task",
        id: "task-123",
        contextId: "ctx-123",
        status: { state: "working", timestamp: new Date().toISOString() },
        history: [{ kind: "message", role: "user", messageId: "old", parts: [{ kind: "text", text: "Old" }] }],
        artifacts: [],
      };

      vi.mocked(mockStart).mockResolvedValue(createMockRun());

      await adapter.execute({ userMessage: createMockUserMessage("New"), task: existingTask }, eventBus);

      const startCall = vi.mocked(mockStart).mock.calls[0];
      const messages = startCall[1][0] as ModelMessage[];
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe("New");
    });

    it("should include history when configured", async () => {
      const workflow = createMockWorkflow();
      const adapter = new DurableA2AAdapter(workflow, { includeHistory: true });
      const eventBus = createMockEventBus();
      const existingTask: Task = {
        kind: "task",
        id: "task-123",
        contextId: "ctx-123",
        status: { state: "working", timestamp: new Date().toISOString() },
        history: [{ kind: "message", role: "user", messageId: "old", parts: [{ kind: "text", text: "Old" }] }],
        artifacts: [],
      };

      vi.mocked(mockStart).mockResolvedValue(createMockRun());

      await adapter.execute({ userMessage: createMockUserMessage("New"), task: existingTask }, eventBus);

      const startCall = vi.mocked(mockStart).mock.calls[0];
      const messages = startCall[1][0] as ModelMessage[];
      expect(messages.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Response Text Extraction", () => {
    it("should extract text from string and array content", async () => {
      const workflow = createMockWorkflow();
      const adapter = new DurableA2AAdapter(workflow);
      const eventBus = createMockEventBus();

      // String content
      vi.mocked(mockStart).mockResolvedValue({
        runId: "run-1",
        returnValue: Promise.resolve({
          messages: [{ role: "assistant" as const, content: "String response" }],
        }),
      });

      await adapter.execute({ userMessage: createMockUserMessage() }, eventBus);

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          status: expect.objectContaining({
            message: expect.objectContaining({
              parts: expect.arrayContaining([expect.objectContaining({ text: "String response" })]),
            }),
          }),
        })
      );

      vi.clearAllMocks();

      // Array content
      vi.mocked(mockStart).mockResolvedValue({
        runId: "run-2",
        returnValue: Promise.resolve({
          messages: [{ role: "assistant" as const, content: [{ type: "text", text: "Part 1" }, { type: "text", text: "Part 2" }] }],
        }),
      });

      await adapter.execute({ userMessage: createMockUserMessage() }, eventBus);

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          status: expect.objectContaining({
            message: expect.objectContaining({
              parts: expect.arrayContaining([expect.objectContaining({ text: "Part 1\nPart 2" })]),
            }),
          }),
        })
      );
    });
  });
});
