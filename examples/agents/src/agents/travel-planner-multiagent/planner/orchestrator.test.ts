import type { GenerateTextResult } from "ai";
import { generateText } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type OrchestratorConfig, TravelPlannerOrchestrator } from "./orchestrator";

// Mock the AI SDK generateText function
vi.mock("ai", async (importOriginal) => {
  const mod = await importOriginal<typeof import("ai")>();
  return {
    ...mod,
    generateText: vi.fn(),
  };
});

// Mock the a2a-ai-provider
vi.mock("a2a-ai-provider", () => ({
  a2a: vi.fn((agentCardUrl: string) => {
    return {
      modelId: `a2a-agent-${agentCardUrl}`,
      provider: "a2a",
      specificationVersion: "v3",
    };
  }),
}));

const mockGenerateText = vi.mocked(generateText);

/**
 * Travel Planner Orchestrator Tests
 *
 * Purpose: Demonstrates multi-agent orchestration
 * - Coordinates Weather and Airbnb specialist agents
 * - Uses a2a-ai-provider for agent-to-agent communication
 * - Delegates to appropriate specialists
 * - Synthesizes responses
 */

describe("Travel Planner Orchestrator", () => {
  const mockLogger = {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  } as unknown as Console;

  const mockConfig: OrchestratorConfig = {
    model: new MockLanguageModelV3(),
    weatherAgent: {
      name: "Weather Agent",
      agentCardUrl: "http://localhost:3001/a2a/card",
      description: "Provides weather forecasts",
    },
    airbnbAgent: {
      name: "Airbnb Agent",
      agentCardUrl: "http://localhost:3002/a2a/card",
      description: "Searches for accommodations",
    },
    logger: mockLogger,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create orchestrator with two specialist agents", () => {
    const orchestrator = new TravelPlannerOrchestrator(mockConfig);
    const agents = orchestrator.getAvailableAgents();

    expect(agents).toHaveLength(2);
    expect(agents.find((a) => a.name === "Weather Agent")).toBeDefined();
    expect(agents.find((a) => a.name === "Airbnb Agent")).toBeDefined();
  });

  it("should delegate weather requests to weather agent", async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: "The weather in Paris will be sunny.",
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      finishReason: "stop",
    } satisfies GenerateTextResult<Record<string, never>>);

    const orchestrator = new TravelPlannerOrchestrator(mockConfig);
    const response = await orchestrator.processRequest("What's the weather in Paris?");

    expect(response).toContain("weather");
  });

  it("should delegate accommodation requests to airbnb agent", async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: "Found great accommodations in Paris.",
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      finishReason: "stop",
    } satisfies GenerateTextResult<Record<string, never>>);

    const orchestrator = new TravelPlannerOrchestrator(mockConfig);
    const response = await orchestrator.processRequest("Find accommodations in Paris for 2 people");

    expect(response).toBeDefined();
    expect(typeof response).toBe("string");
  });

  it("should coordinate both agents for complete travel plans", async () => {
    mockGenerateText
      .mockResolvedValueOnce({
        text: "The weather will be nice.",
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        finishReason: "stop",
      } satisfies GenerateTextResult<Record<string, never>>)
      .mockResolvedValueOnce({
        text: "Found great accommodations.",
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        finishReason: "stop",
      } satisfies GenerateTextResult<Record<string, never>>);

    const orchestrator = new TravelPlannerOrchestrator(mockConfig);
    const response = await orchestrator.processRequest("Plan a trip to Paris");

    expect(response).toBeDefined();
  });
});
