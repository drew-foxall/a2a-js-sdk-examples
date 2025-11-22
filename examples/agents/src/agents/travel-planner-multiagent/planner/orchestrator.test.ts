import { describe, expect, it, vi, beforeEach } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import { TravelPlannerOrchestrator, type OrchestratorConfig } from "./orchestrator";
import { generateText } from "ai";

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

	describe("Constructor", () => {
		it("should create an orchestrator instance", () => {
			const orchestrator = new TravelPlannerOrchestrator(mockConfig);
			expect(orchestrator).toBeDefined();
		});

		it("should use console as default logger if not provided", () => {
			const configWithoutLogger = { ...mockConfig, logger: undefined };
			const orchestrator = new TravelPlannerOrchestrator(configWithoutLogger);
			expect(orchestrator).toBeDefined();
		});

		it("should store configuration correctly", () => {
			const orchestrator = new TravelPlannerOrchestrator(mockConfig);
			const agents = orchestrator.getAvailableAgents();

			expect(agents).toHaveLength(2);
			expect(agents[0]?.name).toBe("Weather Agent");
			expect(agents[1]?.name).toBe("Airbnb Agent");
		});
	});

	describe("getAvailableAgents", () => {
		it("should return list of available agents", () => {
			const orchestrator = new TravelPlannerOrchestrator(mockConfig);
			const agents = orchestrator.getAvailableAgents();

			expect(agents).toHaveLength(2);
			expect(agents).toContainEqual(mockConfig.weatherAgent);
			expect(agents).toContainEqual(mockConfig.airbnbAgent);
		});

		it("should include agent card URLs", () => {
			const orchestrator = new TravelPlannerOrchestrator(mockConfig);
			const agents = orchestrator.getAvailableAgents();

			for (const agent of agents) {
				expect(agent.agentCardUrl).toBeDefined();
				expect(agent.agentCardUrl).toMatch(/^http/);
			}
		});
	});

	describe("processRequest - Weather Only", () => {
		it("should delegate weather-only requests to weather agent", async () => {
			const orchestrator = new TravelPlannerOrchestrator(mockConfig);

			// Mock analysis response
			mockGenerateText.mockResolvedValueOnce({
				text: '{"needsWeather": true, "needsAccommodation": false}',
				finishReason: "stop",
				usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
				warnings: [],
				request: {} as any,
				response: {} as any,
				providerMetadata: undefined,
				experimental_providerMetadata: undefined,
			});

			// Mock weather agent response
			mockGenerateText.mockResolvedValueOnce({
				text: "The weather in Paris will be sunny with temperatures around 70°F.",
				finishReason: "stop",
				usage: { inputTokens: 15, outputTokens: 25, totalTokens: 40 },
				warnings: [],
				request: {} as any,
				response: {} as any,
				providerMetadata: undefined,
				experimental_providerMetadata: undefined,
			});

			const result = await orchestrator.processRequest("What's the weather in Paris?");

			expect(result).toContain("Weather Forecast");
			expect(result).toContain("sunny");
			expect(mockGenerateText).toHaveBeenCalledTimes(2);
		});

		it("should handle weather forecast responses", async () => {
			const orchestrator = new TravelPlannerOrchestrator(mockConfig);

			mockGenerateText.mockResolvedValueOnce({
				text: '{"needsWeather": true, "needsAccommodation": false}',
				finishReason: "stop",
				usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
				warnings: [],
				request: {} as any,
				response: {} as any,
				providerMetadata: undefined,
				experimental_providerMetadata: undefined,
			});

			mockGenerateText.mockResolvedValueOnce({
				text: "Rain expected tomorrow in London.",
				finishReason: "stop",
				usage: { inputTokens: 15, outputTokens: 25, totalTokens: 40 },
				warnings: [],
				request: {} as any,
				response: {} as any,
				providerMetadata: undefined,
				experimental_providerMetadata: undefined,
			});

			const result = await orchestrator.processRequest("Will it rain tomorrow in London?");

			expect(result).toContain("Rain");
			expect(result).toContain("London");
		});
	});

	describe("processRequest - Accommodation Only", () => {
		it("should delegate accommodation-only requests to airbnb agent", async () => {
			const orchestrator = new TravelPlannerOrchestrator(mockConfig);

			mockGenerateText.mockResolvedValueOnce({
				text: '{"needsWeather": false, "needsAccommodation": true}',
				finishReason: "stop",
				usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
				warnings: [],
				request: {} as any,
				response: {} as any,
				providerMetadata: undefined,
				experimental_providerMetadata: undefined,
			});

			mockGenerateText.mockResolvedValueOnce({
				text: "Found 3 available listings in Tokyo for your dates.",
				finishReason: "stop",
				usage: { inputTokens: 15, outputTokens: 25, totalTokens: 40 },
				warnings: [],
				request: {} as any,
				response: {} as any,
				providerMetadata: undefined,
				experimental_providerMetadata: undefined,
			});

			const result = await orchestrator.processRequest("Find me a room in Tokyo");

			expect(result).toContain("Accommodations");
			expect(result).toContain("Tokyo");
			expect(mockGenerateText).toHaveBeenCalledTimes(2);
		});

		it("should handle airbnb search responses", async () => {
			const orchestrator = new TravelPlannerOrchestrator(mockConfig);

			mockGenerateText.mockResolvedValueOnce({
				text: '{"needsWeather": false, "needsAccommodation": true}',
				finishReason: "stop",
				usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
				warnings: [],
				request: {} as any,
				response: {} as any,
				providerMetadata: undefined,
				experimental_providerMetadata: undefined,
			});

			mockGenerateText.mockResolvedValueOnce({
				text: "Here are some great listings in New York.",
				finishReason: "stop",
				usage: { inputTokens: 15, outputTokens: 25, totalTokens: 40 },
				warnings: [],
				request: {} as any,
				response: {} as any,
				providerMetadata: undefined,
				experimental_providerMetadata: undefined,
			});

			const result = await orchestrator.processRequest("Book accommodation in New York");

			expect(result).toContain("listings");
			expect(result).toContain("New York");
		});
	});

	describe("processRequest - Multiple Agents", () => {
		it("should delegate to both agents when needed", async () => {
			const orchestrator = new TravelPlannerOrchestrator(mockConfig);

			mockGenerateText.mockResolvedValueOnce({
				text: '{"needsWeather": true, "needsAccommodation": true}',
				finishReason: "stop",
				usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
				warnings: [],
				request: {} as any,
				response: {} as any,
				providerMetadata: undefined,
				experimental_providerMetadata: undefined,
			});

			mockGenerateText.mockResolvedValueOnce({
				text: "Weather will be pleasant in Los Angeles.",
				finishReason: "stop",
				usage: { inputTokens: 15, outputTokens: 25, totalTokens: 40 },
				warnings: [],
				request: {} as any,
				response: {} as any,
				providerMetadata: undefined,
				experimental_providerMetadata: undefined,
			});

			mockGenerateText.mockResolvedValueOnce({
				text: "Found several great accommodations in Los Angeles.",
				finishReason: "stop",
				usage: { inputTokens: 15, outputTokens: 25, totalTokens: 40 },
				warnings: [],
				request: {} as any,
				response: {} as any,
				providerMetadata: undefined,
				experimental_providerMetadata: undefined,
			});

			const result = await orchestrator.processRequest("Plan a trip to Los Angeles");

			expect(result).toContain("Your Travel Plan");
			expect(result).toContain("Weather Forecast");
			expect(result).toContain("Accommodations");
			expect(mockGenerateText).toHaveBeenCalledTimes(3);
		});

		it("should combine multiple agent responses in order", async () => {
			const orchestrator = new TravelPlannerOrchestrator(mockConfig);

			mockGenerateText.mockResolvedValueOnce({
				text: '{"needsWeather": true, "needsAccommodation": true}',
				finishReason: "stop",
				usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
				warnings: [],
				request: {} as any,
				response: {} as any,
				providerMetadata: undefined,
				experimental_providerMetadata: undefined,
			});

			mockGenerateText.mockResolvedValueOnce({
				text: "First response: weather",
				finishReason: "stop",
				usage: { inputTokens: 15, outputTokens: 25, totalTokens: 40 },
				warnings: [],
				request: {} as any,
				response: {} as any,
				providerMetadata: undefined,
				experimental_providerMetadata: undefined,
			});

			mockGenerateText.mockResolvedValueOnce({
				text: "Second response: accommodation",
				finishReason: "stop",
				usage: { inputTokens: 15, outputTokens: 25, totalTokens: 40 },
				warnings: [],
				request: {} as any,
				response: {} as any,
				providerMetadata: undefined,
				experimental_providerMetadata: undefined,
			});

			const result = await orchestrator.processRequest("Plan my trip");

			const weatherIndex = result.indexOf("weather");
			const accommodationIndex = result.indexOf("accommodation");
			expect(weatherIndex).toBeGreaterThan(-1);
			expect(accommodationIndex).toBeGreaterThan(-1);
			expect(weatherIndex).toBeLessThan(accommodationIndex);
		});
	});

	describe("processRequest - Unsupported Requests", () => {
		it("should handle requests that need no agents", async () => {
			const orchestrator = new TravelPlannerOrchestrator(mockConfig);

			mockGenerateText.mockResolvedValueOnce({
				text: '{"needsWeather": false, "needsAccommodation": false}',
				finishReason: "stop",
				usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
				warnings: [],
				request: {} as any,
				response: {} as any,
				providerMetadata: undefined,
				experimental_providerMetadata: undefined,
			});

			const result = await orchestrator.processRequest("Tell me a joke");

			expect(result).toContain("not sure how to help");
			expect(mockGenerateText).toHaveBeenCalledTimes(1); // Only analysis
		});

		it("should provide guidance on supported services", async () => {
			const orchestrator = new TravelPlannerOrchestrator(mockConfig);

			mockGenerateText.mockResolvedValueOnce({
				text: '{"needsWeather": false, "needsAccommodation": false}',
				finishReason: "stop",
				usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
				warnings: [],
				request: {} as any,
				response: {} as any,
				providerMetadata: undefined,
				experimental_providerMetadata: undefined,
			});

			const result = await orchestrator.processRequest("Random request");

			expect(result).toContain("weather");
			expect(result).toContain("accommodation");
		});
	});

	describe("Request Analysis", () => {
		it("should handle JSON responses with markdown code blocks", async () => {
			const orchestrator = new TravelPlannerOrchestrator(mockConfig);

			mockGenerateText.mockResolvedValueOnce({
				text: '```json\n{"needsWeather": true, "needsAccommodation": false}\n```',
				finishReason: "stop",
				usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
				warnings: [],
				request: {} as any,
				response: {} as any,
				providerMetadata: undefined,
				experimental_providerMetadata: undefined,
			});

			mockGenerateText.mockResolvedValueOnce({
				text: "Weather response",
				finishReason: "stop",
				usage: { inputTokens: 15, outputTokens: 25, totalTokens: 40 },
				warnings: [],
				request: {} as any,
				response: {} as any,
				providerMetadata: undefined,
				experimental_providerMetadata: undefined,
			});

			const result = await orchestrator.processRequest("Weather query");

			expect(result).toContain("Weather");
		});

		it("should fall back to keyword detection on JSON parse error", async () => {
			const orchestrator = new TravelPlannerOrchestrator(mockConfig);

			mockGenerateText.mockResolvedValueOnce({
				text: "Invalid JSON response",
				finishReason: "stop",
				usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
				warnings: [],
				request: {} as any,
				response: {} as any,
				providerMetadata: undefined,
				experimental_providerMetadata: undefined,
			});

			mockGenerateText.mockResolvedValueOnce({
				text: "Weather response",
				finishReason: "stop",
				usage: { inputTokens: 15, outputTokens: 25, totalTokens: 40 },
				warnings: [],
				request: {} as any,
				response: {} as any,
				providerMetadata: undefined,
				experimental_providerMetadata: undefined,
			});

			const result = await orchestrator.processRequest("What's the weather forecast?");

			expect(result).toContain("Weather");
			expect(mockLogger.error).toHaveBeenCalled();
		});

		it("should detect weather keywords in fallback mode", async () => {
			const orchestrator = new TravelPlannerOrchestrator(mockConfig);

			mockGenerateText.mockResolvedValueOnce({
				text: "Not JSON",
				finishReason: "stop",
				usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
				warnings: [],
				request: {} as any,
				response: {} as any,
				providerMetadata: undefined,
				experimental_providerMetadata: undefined,
			});

			mockGenerateText.mockResolvedValueOnce({
				text: "Weather data",
				finishReason: "stop",
				usage: { inputTokens: 15, outputTokens: 25, totalTokens: 40 },
				warnings: [],
				request: {} as any,
				response: {} as any,
				providerMetadata: undefined,
				experimental_providerMetadata: undefined,
			});

			await orchestrator.processRequest("Will it be sunny tomorrow?");

			// Should call weather agent (2 calls total: analysis + weather)
			expect(mockGenerateText).toHaveBeenCalledTimes(2);
		});

		it("should detect accommodation keywords in fallback mode", async () => {
			const orchestrator = new TravelPlannerOrchestrator(mockConfig);

			mockGenerateText.mockResolvedValueOnce({
				text: "Not JSON",
				finishReason: "stop",
				usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
				warnings: [],
				request: {} as any,
				response: {} as any,
				providerMetadata: undefined,
				experimental_providerMetadata: undefined,
			});

			mockGenerateText.mockResolvedValueOnce({
				text: "Accommodation data",
				finishReason: "stop",
				usage: { inputTokens: 15, outputTokens: 25, totalTokens: 40 },
				warnings: [],
				request: {} as any,
				response: {} as any,
				providerMetadata: undefined,
				experimental_providerMetadata: undefined,
			});

			await orchestrator.processRequest("Book a hotel room");

			// Should call airbnb agent (2 calls total: analysis + airbnb)
			expect(mockGenerateText).toHaveBeenCalledTimes(2);
		});
	});

	describe("Error Handling", () => {
		it("should handle weather agent errors gracefully", async () => {
			const orchestrator = new TravelPlannerOrchestrator(mockConfig);

			mockGenerateText.mockResolvedValueOnce({
				text: '{"needsWeather": true, "needsAccommodation": false}',
				finishReason: "stop",
				usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
				warnings: [],
				request: {} as any,
				response: {} as any,
				providerMetadata: undefined,
				experimental_providerMetadata: undefined,
			});

			mockGenerateText.mockRejectedValueOnce(new Error("Weather API error"));

			const result = await orchestrator.processRequest("Weather query");

			expect(result).toContain("Error getting weather forecast");
			expect(result).toContain("Weather API error");
			expect(mockLogger.error).toHaveBeenCalled();
		});

		it("should handle airbnb agent errors gracefully", async () => {
			const orchestrator = new TravelPlannerOrchestrator(mockConfig);

			mockGenerateText.mockResolvedValueOnce({
				text: '{"needsWeather": false, "needsAccommodation": true}',
				finishReason: "stop",
				usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
				warnings: [],
				request: {} as any,
				response: {} as any,
				providerMetadata: undefined,
				experimental_providerMetadata: undefined,
			});

			mockGenerateText.mockRejectedValueOnce(new Error("Airbnb API error"));

			const result = await orchestrator.processRequest("Accommodation query");

			expect(result).toContain("Error searching accommodations");
			expect(result).toContain("Airbnb API error");
			expect(mockLogger.error).toHaveBeenCalled();
		});

		it("should handle non-Error exceptions", async () => {
			const orchestrator = new TravelPlannerOrchestrator(mockConfig);

			mockGenerateText.mockResolvedValueOnce({
				text: '{"needsWeather": true, "needsAccommodation": false}',
				finishReason: "stop",
				usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
				warnings: [],
				request: {} as any,
				response: {} as any,
				providerMetadata: undefined,
				experimental_providerMetadata: undefined,
			});

			mockGenerateText.mockRejectedValueOnce("String error");

			const result = await orchestrator.processRequest("Weather query");

			expect(result).toContain("Error getting weather forecast");
			expect(result).toContain("Unknown error");
		});
	});

	describe("Logging", () => {
		it("should log processing steps", async () => {
			const orchestrator = new TravelPlannerOrchestrator(mockConfig);

			mockGenerateText.mockResolvedValueOnce({
				text: '{"needsWeather": true, "needsAccommodation": false}',
				finishReason: "stop",
				usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
				warnings: [],
				request: {} as any,
				response: {} as any,
				providerMetadata: undefined,
				experimental_providerMetadata: undefined,
			});

			mockGenerateText.mockResolvedValueOnce({
				text: "Weather response",
				finishReason: "stop",
				usage: { inputTokens: 15, outputTokens: 25, totalTokens: 40 },
				warnings: [],
				request: {} as any,
				response: {} as any,
				providerMetadata: undefined,
				experimental_providerMetadata: undefined,
			});

			await orchestrator.processRequest("Test query");

			expect(mockLogger.log).toHaveBeenCalledWith(
				expect.stringContaining("Processing request"),
			);
			expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining("Analysis:"));
			expect(mockLogger.log).toHaveBeenCalledWith(
				expect.stringContaining("Delegating to Weather Agent"),
			);
		});

		it("should log analysis results", async () => {
			const orchestrator = new TravelPlannerOrchestrator(mockConfig);

			mockGenerateText.mockResolvedValueOnce({
				text: '{"needsWeather": true, "needsAccommodation": true}',
				finishReason: "stop",
				usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
				warnings: [],
				request: {} as any,
				response: {} as any,
				providerMetadata: undefined,
				experimental_providerMetadata: undefined,
			});

			mockGenerateText.mockResolvedValueOnce({
				text: "Weather",
				finishReason: "stop",
				usage: { inputTokens: 15, outputTokens: 25, totalTokens: 40 },
				warnings: [],
				request: {} as any,
				response: {} as any,
				providerMetadata: undefined,
				experimental_providerMetadata: undefined,
			});

			mockGenerateText.mockResolvedValueOnce({
				text: "Accommodation",
				finishReason: "stop",
				usage: { inputTokens: 15, outputTokens: 25, totalTokens: 40 },
				warnings: [],
				request: {} as any,
				response: {} as any,
				providerMetadata: undefined,
				experimental_providerMetadata: undefined,
			});

			await orchestrator.processRequest("Trip planning");

			const analysisCall = (mockLogger.log as any).mock.calls.find((call: any[]) =>
				call[0]?.includes("Analysis:"),
			);
			expect(analysisCall).toBeDefined();
		});
	});
});

