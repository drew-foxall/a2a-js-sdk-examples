/**
 * Weather Agent
 *
 * A specialist agent for weather forecasts.
 * Part of the Travel Planner Multi-Agent System.
 */

import { type LanguageModel, ToolLoopAgent } from "ai";
import { z } from "zod";
import { getWeatherAgentPrompt } from "./prompt";
import { getWeatherDescription, getWeatherForecast, isWeatherError } from "./tools";

/**
 * Weather forecast tool parameter schema
 */
const weatherForecastSchema = z.object({
  location: z.string().describe("Location to get weather for (city, state, country)"),
  days: z.number().min(1).max(7).optional().describe("Number of days to forecast (1-7, default 7)"),
});

type WeatherForecastParams = z.infer<typeof weatherForecastSchema>;

/**
 * Create a Weather Agent
 *
 * This specialist agent provides weather forecasts using the Open-Meteo API.
 * It can be:
 * 1. Used standalone as an A2A agent
 * 2. Consumed by an orchestrator agent via a2a-ai-provider
 *
 * @param model - The language model to use
 * @returns A configured ToolLoopAgent
 */
export function createWeatherAgent(model: LanguageModel) {
  return new ToolLoopAgent({
    model,
    instructions: getWeatherAgentPrompt(),
    tools: {
      get_weather_forecast: {
        description: "Get weather forecast for a location using Open-Meteo API (free, no API key)",
        inputSchema: weatherForecastSchema,
        execute: async (params: WeatherForecastParams) => {
          const forecast = await getWeatherForecast(params.location, params.days || 7);

          // Return error if API failed
          if (isWeatherError(forecast)) {
            return { error: forecast.error };
          }

          // Format weather data for the agent
          const dailyForecasts = forecast.dates.map((date, index) => ({
            date,
            temperatureHigh: `${forecast.temperatureMax[index]}°F`,
            temperatureLow: `${forecast.temperatureMin[index]}°F`,
            precipitation: `${forecast.precipitation[index]} inches`,
            conditions: getWeatherDescription(forecast.weatherCode[index] ?? 0),
          }));

          return {
            success: true,
            location: forecast.location,
            timezone: forecast.timezone,
            forecasts: dailyForecasts,
          };
        },
      },
    },
  });
}
