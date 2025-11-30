/**
 * Local LLM Chat Agent
 *
 * A protocol-agnostic AI agent designed to work with local LLMs via Ollama
 * or cloud-hosted models. Includes web search and weather tools.
 *
 * Features:
 * - Works with any LLM provider (Ollama, OpenAI, Anthropic, etc.)
 * - Web search capability
 * - Weather information
 * - Demonstrates A2A with self-hosted models
 *
 * This agent demonstrates:
 * - Provider-agnostic design
 * - Tool integration
 * - Local/cloud flexibility
 */

import { type LanguageModel, ToolLoopAgent } from "ai";
import { z } from "zod";
import { getLocalLLMChatPrompt } from "./prompt";

/**
 * Web search tool schema
 */
const webSearchSchema = z.object({
  query: z.string().describe("The search query to look up"),
});

type WebSearchParams = z.infer<typeof webSearchSchema>;

/**
 * Weather tool schema
 */
const weatherSchema = z.object({
  location: z.string().describe("The city or location to get weather for"),
});

type WeatherParams = z.infer<typeof weatherSchema>;

/**
 * Geocoding API response schema
 */
const geoResponseSchema = z.object({
  results: z
    .array(
      z.object({
        latitude: z.number(),
        longitude: z.number(),
        name: z.string(),
      })
    )
    .optional(),
});

/**
 * Weather API response schema
 */
const weatherResponseSchema = z.object({
  current: z.object({
    temperature_2m: z.number(),
    relative_humidity_2m: z.number(),
    weather_code: z.number(),
    wind_speed_10m: z.number(),
  }),
});

/**
 * Simple web search implementation
 * In production, this would use a real search API (Brave, SerpAPI, etc.)
 */
async function performWebSearch(query: string): Promise<string> {
  // This is a placeholder implementation
  // In a real scenario, you would integrate with a search API
  return `Search results for "${query}":

This is a simulated search result. In production, integrate with:
- Brave Search API
- SerpAPI
- Google Custom Search
- DuckDuckGo API

The search would return relevant web pages, snippets, and links.`;
}

/**
 * Simple weather implementation
 * Uses Open-Meteo API (free, no API key required)
 */
async function getWeather(location: string): Promise<string> {
  try {
    // First, geocode the location using Open-Meteo's geocoding API
    const geoResponse = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`
    );

    if (!geoResponse.ok) {
      return `Could not find location: ${location}`;
    }

    const rawGeoData: unknown = await geoResponse.json();
    const geoParseResult = geoResponseSchema.safeParse(rawGeoData);

    if (!geoParseResult.success) {
      return `Invalid response from geocoding API for: ${location}`;
    }

    const geoData = geoParseResult.data;
    if (!geoData.results || geoData.results.length === 0) {
      return `Location not found: ${location}`;
    }

    const firstResult = geoData.results[0];
    if (!firstResult) {
      return `Location not found: ${location}`;
    }

    const { latitude, longitude, name } = firstResult;

    // Get weather data
    const weatherResponse = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`
    );

    if (!weatherResponse.ok) {
      return `Could not fetch weather for ${location}`;
    }

    const rawWeatherData: unknown = await weatherResponse.json();
    const weatherParseResult = weatherResponseSchema.safeParse(rawWeatherData);

    if (!weatherParseResult.success) {
      return `Invalid weather data for: ${location}`;
    }

    const weatherData = weatherParseResult.data;
    const { temperature_2m, relative_humidity_2m, weather_code, wind_speed_10m } =
      weatherData.current;

    // Convert weather code to description
    const weatherDescription = getWeatherDescription(weather_code);

    return `Weather in ${name}:
- Temperature: ${temperature_2m}°C (${Math.round(temperature_2m * 1.8 + 32)}°F)
- Conditions: ${weatherDescription}
- Humidity: ${relative_humidity_2m}%
- Wind Speed: ${wind_speed_10m} km/h`;
  } catch (error) {
    return `Error fetching weather: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}

/**
 * Convert WMO weather code to human-readable description
 */
function getWeatherDescription(code: number): string {
  const descriptions: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
  };
  return descriptions[code] || "Unknown conditions";
}

/**
 * Create a Local LLM Chat Agent
 *
 * This is a protocol-agnostic AI agent that can be exposed through
 * multiple interfaces (A2A, MCP, REST, CLI, etc.)
 *
 * @param model - The language model to use (can be Ollama, OpenAI, etc.)
 * @returns A configured ToolLoopAgent for chat with tools
 */
export function createLocalLLMChatAgent(model: LanguageModel) {
  return new ToolLoopAgent({
    model,
    instructions: getLocalLLMChatPrompt(),
    tools: {
      web_search: {
        description:
          "Search the web for current information. Use this for questions about current events, facts, or topics that require up-to-date information.",
        inputSchema: webSearchSchema,
        execute: async (params: WebSearchParams) => {
          const results = await performWebSearch(params.query);
          return {
            success: true,
            query: params.query,
            results,
          };
        },
      },
      get_weather: {
        description:
          "Get current weather conditions for a location. Use this when users ask about weather.",
        inputSchema: weatherSchema,
        execute: async (params: WeatherParams) => {
          const weather = await getWeather(params.location);
          return {
            success: true,
            location: params.location,
            weather,
          };
        },
      },
    },
  });
}
