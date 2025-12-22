/**
 * Worker Configuration Tests
 */

import { describe, expect, it, vi } from "vitest";
import { InMemoryTaskStore } from "@drew-foxall/a2a-js-sdk/server";
import { MockLanguageModelV3 } from "ai/test";
import { ToolLoopAgent } from "ai";
import {
  createTaskStore,
  createA2AExecutor,
  defineWorkerConfig,
  extractBaseUrl,
  DEFAULT_ADAPTER_OPTIONS,
  DEFAULT_TASK_TTL_SECONDS,
  type A2AWorkerConfig,
  type BaseWorkerEnv,
} from "./worker-config.js";

// Test Fixtures
const mockEnv: BaseWorkerEnv = {
  OPENAI_API_KEY: "test-key",
  MODEL_NAME: "gpt-4o-mini",
};

const mockModel = new MockLanguageModelV3({
  doGenerate: async () => ({
    finishReason: "stop",
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    content: [{ type: "text", text: "Test response" }],
    warnings: [],
  }),
});

function createMockAgent() {
  return new ToolLoopAgent({
    model: mockModel,
    tools: {},
    instructions: "Test agent",
  });
}

const mockAgentCard = {
  name: "Test Agent",
  description: "A test agent",
  url: "https://example.com",
  version: "1.0.0",
  protocolVersion: "0.3.0",
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
  capabilities: { streaming: true, pushNotifications: false, stateTransitionHistory: false },
  skills: [],
};

describe("createTaskStore", () => {
  it("should create InMemoryTaskStore for memory or undefined config", () => {
    expect(createTaskStore(undefined, mockEnv)).toBeInstanceOf(InMemoryTaskStore);
    expect(createTaskStore({ type: "memory" }, mockEnv)).toBeInstanceOf(InMemoryTaskStore);
  });

  it("should fall back to InMemoryTaskStore when Redis not configured", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = createTaskStore({ type: "redis", prefix: "test:" }, mockEnv);

    expect(store).toBeInstanceOf(InMemoryTaskStore);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Redis not configured"));
    consoleSpy.mockRestore();
  });

  it("should call custom factory function", () => {
    const customStore = new InMemoryTaskStore();
    const factory = vi.fn(() => customStore);

    const store = createTaskStore({ type: "custom", factory }, mockEnv);

    expect(factory).toHaveBeenCalledWith(mockEnv);
    expect(store).toBe(customStore);
  });
});

describe("createA2AExecutor", () => {
  it("should create executor with public execute and cancelTask methods", () => {
    const config: A2AWorkerConfig = {
      agentName: "Test Agent",
      createAgent: () => createMockAgent(),
      createAgentCard: () => mockAgentCard,
    };

    const executor = createA2AExecutor(config, mockModel, mockEnv);

    expect(executor).toBeDefined();
    expect(typeof executor.execute).toBe("function");
    expect(typeof executor.cancelTask).toBe("function");
  });

  it("should pass environment to createAgent factory", () => {
    const createAgentSpy = vi.fn(() => createMockAgent());

    createA2AExecutor(
      { agentName: "Test", createAgent: createAgentSpy, createAgentCard: () => mockAgentCard },
      mockModel,
      mockEnv
    );

    expect(createAgentSpy).toHaveBeenCalledWith(mockModel, mockEnv);
  });

  it("should call selectResponseTypeFactory when provided", () => {
    const selectResponseType = vi.fn(() => "message" as const);
    const factorySelect = vi.fn(() => "task" as const);
    const selectResponseTypeFactory = vi.fn(() => factorySelect);

    const config: A2AWorkerConfig = {
      agentName: "Test Agent",
      createAgent: () => createMockAgent(),
      createAgentCard: () => mockAgentCard,
      adapterOptions: {
        mode: "stream",
        selectResponseType,
        selectResponseTypeFactory,
      },
    };

    createA2AExecutor(config, mockModel, mockEnv);

    expect(selectResponseTypeFactory).toHaveBeenCalledTimes(1);
    expect(selectResponseTypeFactory).toHaveBeenCalledWith({
      model: mockModel,
      env: mockEnv,
    });
  });
});

describe("defineWorkerConfig", () => {
  it("should return config unchanged with all properties preserved", () => {
    const parseTaskState = vi.fn();
    const generateArtifacts = vi.fn();

    const config: A2AWorkerConfig = {
      agentName: "Full Agent",
      createAgent: () => createMockAgent(),
      createAgentCard: () => mockAgentCard,
      adapterOptions: { mode: "stream", parseTaskState, generateArtifacts },
      taskStore: { type: "redis", prefix: "test:" },
    };

    const result = defineWorkerConfig(config);

    expect(result).toBe(config);
    expect(result.adapterOptions?.parseTaskState).toBe(parseTaskState);
  });
});

describe("extractBaseUrl", () => {
  it("should extract protocol and host from various URL formats", () => {
    expect(extractBaseUrl("https://example.com/path/to/resource")).toBe("https://example.com");
    expect(extractBaseUrl("http://localhost:3000/api/v1")).toBe("http://localhost:3000");
    expect(extractBaseUrl("https://example.com?query=value#section")).toBe("https://example.com");
  });
});

describe("Default Constants", () => {
  it("should have correct default values", () => {
    expect(DEFAULT_ADAPTER_OPTIONS.mode).toBe("stream");
    expect(DEFAULT_ADAPTER_OPTIONS.debug).toBe(false);
    expect(DEFAULT_TASK_TTL_SECONDS).toBe(7 * 24 * 60 * 60); // 7 days
  });
});
