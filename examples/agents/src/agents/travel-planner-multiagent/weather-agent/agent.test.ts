import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import { ToolLoopAgent, type LanguageModel } from "ai";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createWeatherAgent } from "./agent";
import { getWeatherAgentPrompt } from "./prompt";
import {
	getWeatherForecast,
	isWeatherError,
	type WeatherForecast,
} from "./tools";

// Mock the weather tools to avoid actual API calls
vi.mock("./tools.js", async (importOriginal) => {
	const mod = await importOriginal<typeof import("./tools.js")>();
	return {
		...mod,
		getWeatherForecast: vi.fn(
			async (
				location: string,
				days: number = 7,
			): Promise<WeatherForecast | { error: string }> => {
				if (location.toLowerCase().includes("invalid")) {
					return { error: "Location not found" };
				}
				if (location.toLowerCase().includes("error")) {
					return { error: "Weather API error" };
				}

				return {
					location: `${location}, Test State`,
					latitude: 40.0,
					longitude: -74.0,
					timezone: "America/New_York",
					dates: Array.from({ length: days }, (_, i) => `2025-11-${23 + i}`),
					temperatureMax: Array(days).fill(70),
					temperatureMin: Array(days).fill(50),
					precipitation: Array(days).fill(0.1),
					weatherCode: Array(days).fill(1),
				};
			},
		),
	};
});

describe("Weather Agent", () => {
	describe("Agent Creation", () => {
		it("should create an agent instance", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createWeatherAgent(mockModel);

			expect(agent).toBeDefined();
			expect(agent).toBeInstanceOf(ToolLoopAgent);
		});

		it("should initialize with weather agent prompt", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createWeatherAgent(mockModel);

			expect(agent).toBeDefined();
			expect(getWeatherAgentPrompt()).toBeDefined();
			expect(getWeatherAgentPrompt().length).toBeGreaterThan(0);
		});

		it("should have one tool defined: get_weather_forecast", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createWeatherAgent(mockModel);

			expect(Object.keys(agent.tools)).toHaveLength(1);
			expect(agent.tools.get_weather_forecast).toBeDefined();
		});

		it("should have get_weather_forecast tool with description and schema", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createWeatherAgent(mockModel);

			expect(agent.tools.get_weather_forecast).toBeDefined();
			expect(agent.tools.get_weather_forecast.description).toBeTypeOf("string");
			expect(
				agent.tools.get_weather_forecast.description.toLowerCase(),
			).toContain("weather");
			expect(agent.tools.get_weather_forecast.inputSchema).toBeInstanceOf(
				z.ZodObject,
			);
			expect(agent.tools.get_weather_forecast.execute).toBeDefined();
		});
	});

	describe("Tool Execution", () => {
		it("should execute get_weather_forecast successfully", async () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createWeatherAgent(mockModel);

			const result = await agent.tools.get_weather_forecast.execute({
				location: "San Francisco",
				days: 3,
			});

			expect(result).toBeDefined();
			expect(result.success).toBe(true);
			expect(result.location).toContain("San Francisco");
			expect(result.forecasts).toHaveLength(3);
			expect(getWeatherForecast).toHaveBeenCalledWith("San Francisco", 3);
		});

		it("should handle location not found error", async () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createWeatherAgent(mockModel);

			const result = await agent.tools.get_weather_forecast.execute({
				location: "InvalidLocation12345",
			});

			expect(result).toBeDefined();
			expect(result.error).toBeDefined();
			expect(result.error).toContain("Location not found");
		});

		it("should handle API errors", async () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createWeatherAgent(mockModel);

			const result = await agent.tools.get_weather_forecast.execute({
				location: "ErrorLocation",
			});

			expect(result).toBeDefined();
			expect(result.error).toBeDefined();
			expect(result.error).toContain("Weather API error");
		});

		it("should default to 7 days when days not specified", async () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createWeatherAgent(mockModel);

			const result = await agent.tools.get_weather_forecast.execute({
				location: "New York",
			});

			expect(result).toBeDefined();
			expect(result.success).toBe(true);
			expect(result.forecasts).toHaveLength(7);
			expect(getWeatherForecast).toHaveBeenCalledWith("New York", 7);
		});

		it("should format weather data correctly", async () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createWeatherAgent(mockModel);

			const result = await agent.tools.get_weather_forecast.execute({
				location: "Boston",
				days: 2,
			});

			expect(result.success).toBe(true);
			expect(result.forecasts).toHaveLength(2);
			expect(result.forecasts[0]).toHaveProperty("date");
			expect(result.forecasts[0]).toHaveProperty("temperatureHigh");
			expect(result.forecasts[0]).toHaveProperty("temperatureLow");
			expect(result.forecasts[0]).toHaveProperty("precipitation");
			expect(result.forecasts[0]).toHaveProperty("conditions");

			// Check formatting
			expect(result.forecasts[0]?.temperatureHigh).toMatch(/°F$/);
			expect(result.forecasts[0]?.temperatureLow).toMatch(/°F$/);
			expect(result.forecasts[0]?.precipitation).toMatch(/inches$/);
		});
	});

	describe("Agent Execution (Mocked Model)", () => {
		it("should generate response for weather requests", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => {
					return {
						finishReason: "stop",
						usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
						content: [
							{
								type: "text",
								text: "The weather in Paris for the next 5 days will be sunny with temperatures around 70°F.",
							},
						],
						warnings: [],
					};
				},
			});
			const agent = createWeatherAgent(mockModel);

			const result = await agent.generate({
				prompt: "What's the weather in Paris for the next 5 days?",
			});

			expect(result).toBeDefined();
			expect(result.text).toBeDefined();
			expect(result.text).toContain("Paris");
			expect(result.text).toContain("weather");
		});

		it("should provide weather information in response", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => {
					return {
						finishReason: "stop",
						usage: { inputTokens: 15, outputTokens: 50, totalTokens: 65 },
						content: [
							{
								type: "text",
								text: "The weather in Seattle for the next 3 days will be partly cloudy with temperatures ranging from 50°F to 70°F.",
							},
						],
						warnings: [],
					};
				},
			});
			const agent = createWeatherAgent(mockModel);

			const result = await agent.generate({
				prompt: "What's the weather like in Seattle?",
			});

			expect(result).toBeDefined();
			expect(result.text).toBeDefined();
			expect(result.text).toContain("weather");
		});

		it("should handle weather-related queries", async () => {
			const mockModel = new MockLanguageModelV3({
				doGenerate: async () => {
					return {
						finishReason: "stop",
						usage: { inputTokens: 20, outputTokens: 40, totalTokens: 60 },
						content: [
							{
								type: "text",
								text: "Based on the forecast, Miami will have pleasant weather with temperatures around 70°F.",
							},
						],
						warnings: [],
					};
				},
			});
			const agent = createWeatherAgent(mockModel);

			const result = await agent.generate({
				prompt: "Should I travel to Miami this week?",
			});

			expect(result).toBeDefined();
			expect(result.text).toContain("Miami");
			expect(result.text).toContain("weather");
		});
	});

	describe("Agent Configuration", () => {
		it("should create agent with custom model", () => {
			const customModel = new MockLanguageModelV3({
				modelId: "custom-weather-model",
			});
			const agent = createWeatherAgent(customModel);

			expect(agent).toBeDefined();
			expect(agent).toBeInstanceOf(ToolLoopAgent);
		});

		it("should accept any language model", () => {
			const customModel: LanguageModel = {
				doGenerate: vi.fn(),
				doStream: vi.fn(),
				modelId: "gpt-4",
				provider: "openai",
				specificationVersion: "v3",
				_supportedUrls: vi.fn(),
			};
			const agent = createWeatherAgent(customModel);

			expect(agent).toBeDefined();
			expect(agent).toBeInstanceOf(ToolLoopAgent);
		});
	});

	describe("Tool Schema Validation", () => {
		it("should accept valid location and days parameters", async () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createWeatherAgent(mockModel);

			const result = await agent.tools.get_weather_forecast.execute({
				location: "Chicago",
				days: 5,
			});

			expect(result.success).toBe(true);
		});

		it("should handle days parameter within valid range (1-7)", async () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createWeatherAgent(mockModel);

			const result1 = await agent.tools.get_weather_forecast.execute({
				location: "Denver",
				days: 1,
			});
			expect(result1.success).toBe(true);
			expect(result1.forecasts).toHaveLength(1);

			const result7 = await agent.tools.get_weather_forecast.execute({
				location: "Denver",
				days: 7,
			});
			expect(result7.success).toBe(true);
			expect(result7.forecasts).toHaveLength(7);
		});

		it("should have proper input schema for the tool", () => {
			const mockModel = new MockLanguageModelV3();
			const agent = createWeatherAgent(mockModel);

			const schema = agent.tools.get_weather_forecast.inputSchema;
			expect(schema).toBeDefined();

			// Test that the schema is a ZodObject
			expect(schema).toBeInstanceOf(z.ZodObject);

			// The schema should accept valid input
			const validInput = { location: "Test City", days: 3 };
			expect(() => schema.parse(validInput)).not.toThrow();
		});
	});
});

