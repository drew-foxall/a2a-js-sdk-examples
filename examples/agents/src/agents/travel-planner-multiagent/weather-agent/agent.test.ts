import { ToolLoopAgent } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import { createWeatherAgent } from "./agent";
import type { WeatherForecast } from "./tools";

// Mock the weather tools to avoid actual API calls
vi.mock("./tools.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("./tools.js")>();
  return {
    ...mod,
    getWeatherForecast: vi.fn(
      async (location: string, days: number = 7): Promise<WeatherForecast | { error: string }> => {
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
      }
    ),
  };
});

/**
 * Weather Agent Tests (Multi-Agent System)
 *
 * Purpose: Specialist agent providing weather forecasts
 * - Part of travel planner multi-agent system
 * - Uses Open-Meteo API
 * - 7-day forecasts
 *
 * Note: API integration tested in tools.test.ts
 */

describe("Weather Agent", () => {
  it("should create agent with weather tool", () => {
    const mockModel = new MockLanguageModelV3();
    const agent = createWeatherAgent(mockModel);

    expect(agent).toBeInstanceOf(ToolLoopAgent);
    expect(agent.tools.get_weather_forecast).toBeDefined();
  });

  it("should respond to weather queries", async () => {
    const mockModel = new MockLanguageModelV3({
      doGenerate: async () => ({
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: {
            total: 20,
            noCache: undefined,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: { total: 40, text: undefined, reasoning: undefined },
        },
        content: [
          {
            type: "text",
            text: "Here's the weather forecast for Paris.",
          },
        ],
        warnings: [],
      }),
    });

    const agent = createWeatherAgent(mockModel);
    const result = await agent.generate({
      prompt: "What's the weather in Paris?",
    });

    expect(result.text).toBeDefined();
  });
});
