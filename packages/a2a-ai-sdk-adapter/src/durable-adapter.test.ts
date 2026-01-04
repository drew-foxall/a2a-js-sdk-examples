/**
 * DurableA2AAdapter Tests
 *
 * Tests the adapter that bridges Workflow DevKit durable workflows with A2A protocol.
 */

import type { Message, Task } from "@drew-foxall/a2a-js-sdk";
import { type ExecutionEventBus, RequestContext } from "@drew-foxall/a2a-js-sdk/server";
import type { ModelMessage } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Run } from "workflow/api";
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

/**
 * Creates a mock ExecutionEventBus that matches the SDK's interface.
 * The SDK uses EventEmitter-style methods (on/off/once/removeAllListeners/finished).
 */
function createMockEventBus(): ExecutionEventBus {
  const mockBus = {
    publish: vi.fn(),
    on: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    once: vi.fn().mockReturnThis(),
    removeAllListeners: vi.fn().mockReturnThis(),
    finished: vi.fn(),
  };
  return mockBus;
}

/**
 * Creates a mock RequestContext with required taskId and contextId.
 */
function createMockRequestContext(userMessage: Message, task?: Task): RequestContext {
  const taskId = task?.id ?? "test-task-123";
  const contextId = task?.contextId ?? "test-context-123";
  return new RequestContext(userMessage, taskId, contextId, task);
}

/**
 * Creates a mock Run object that matches the workflow/api Run class.
 * We only mock the properties actually used by DurableA2AAdapter:
 * - runId: for logging
 * - returnValue: for getting the workflow result
 *
 * We cast to Run<TResult> since we're mocking for tests and don't need
 * all the internal properties (world, readable, etc.)
 */
function createMockRun<TResult>(result: TResult): Run<TResult> {
  return {
    runId: "run-123",
    returnValue: Promise.resolve(result),
  } as Run<TResult>;
}

function createMockWorkflowResult(responseText = "Test response") {
  return {
    messages: [{ role: "assistant" as const, content: responseText }],
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
      const context = createMockRequestContext(createMockUserMessage());

      vi.mocked(mockStart).mockResolvedValue(createMockRun(createMockWorkflowResult()));

      await adapter.execute(context, eventBus);

      expect(mockStart).toHaveBeenCalledWith(workflow, expect.arrayContaining([expect.any(Array)]));
    });

    it("should publish task lifecycle events", async () => {
      const workflow = createMockWorkflow();
      const adapter = new DurableA2AAdapter(workflow);
      const eventBus = createMockEventBus();
      const context = createMockRequestContext(createMockUserMessage());

      vi.mocked(mockStart).mockResolvedValue(createMockRun(createMockWorkflowResult("Response")));

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
      const context = createMockRequestContext(createMockUserMessage());

      vi.mocked(mockStart).mockResolvedValue(
        createMockRun(createMockWorkflowResult("I need more info"))
      );

      await adapter.execute(context, eventBus);

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          status: expect.objectContaining({ state: "input-required" }),
        })
      );
    });

    it("should call generateArtifacts and publish artifact events", async () => {
      const generateArtifacts = vi
        .fn()
        .mockResolvedValue([
          { artifactId: "artifact-1", parts: [{ kind: "text", text: "Generated" }] },
        ]);

      const workflow = createMockWorkflow();
      const adapter = new DurableA2AAdapter(workflow, { generateArtifacts });
      const eventBus = createMockEventBus();
      const context = createMockRequestContext(createMockUserMessage());

      vi.mocked(mockStart).mockResolvedValue(createMockRun(createMockWorkflowResult()));

      await adapter.execute(context, eventBus);

      expect(generateArtifacts).toHaveBeenCalled();
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "artifact-update" })
      );
    });

    it("should handle workflow errors gracefully", async () => {
      const workflow = createMockWorkflow();
      const adapter = new DurableA2AAdapter(workflow);
      const eventBus = createMockEventBus();
      const context = createMockRequestContext(createMockUserMessage());

      vi.mocked(mockStart).mockRejectedValue(new Error("Workflow failed"));

      await adapter.execute(context, eventBus);

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
      const emptyMessage: Message = {
        kind: "message",
        role: "user",
        messageId: "msg-123",
        parts: [],
      };
      const context = createMockRequestContext(emptyMessage);

      await adapter.execute(context, eventBus);

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
        history: [
          {
            kind: "message",
            role: "user",
            messageId: "old",
            parts: [{ kind: "text", text: "Old" }],
          },
        ],
        artifacts: [],
      };
      const context = createMockRequestContext(createMockUserMessage("New"), existingTask);

      vi.mocked(mockStart).mockResolvedValue(createMockRun(createMockWorkflowResult()));

      await adapter.execute(context, eventBus);

      const startCall = vi.mocked(mockStart).mock.calls[0];
      expect(startCall).toBeDefined();
      // The second argument to start() is an array of [messages, ...workflowArgs]
      const args = startCall?.[1] as unknown as [ModelMessage[], ...unknown[]];
      const messages = args?.[0];
      expect(messages).toHaveLength(1);
      expect(messages?.[0]?.content).toBe("New");
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
        history: [
          {
            kind: "message",
            role: "user",
            messageId: "old",
            parts: [{ kind: "text", text: "Old" }],
          },
        ],
        artifacts: [],
      };
      const context = createMockRequestContext(createMockUserMessage("New"), existingTask);

      vi.mocked(mockStart).mockResolvedValue(createMockRun(createMockWorkflowResult()));

      await adapter.execute(context, eventBus);

      const startCall = vi.mocked(mockStart).mock.calls[0];
      expect(startCall).toBeDefined();
      // The second argument to start() is an array of [messages, ...workflowArgs]
      const args = startCall?.[1] as unknown as [ModelMessage[], ...unknown[]];
      const messages = args?.[0];
      expect(messages?.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Response Text Extraction", () => {
    it("should extract text from string and array content", async () => {
      const workflow = createMockWorkflow();
      const adapter = new DurableA2AAdapter(workflow);
      const eventBus = createMockEventBus();
      const context = createMockRequestContext(createMockUserMessage());

      // String content
      vi.mocked(mockStart).mockResolvedValue(
        createMockRun({
          messages: [{ role: "assistant" as const, content: "String response" }],
        })
      );

      await adapter.execute(context, eventBus);

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
      const context2 = createMockRequestContext(createMockUserMessage());
      vi.mocked(mockStart).mockResolvedValue(
        createMockRun({
          messages: [
            {
              role: "assistant" as const,
              content: [
                { type: "text", text: "Part 1" },
                { type: "text", text: "Part 2" },
              ],
            },
          ],
        })
      );

      await adapter.execute(context2, eventBus);

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
