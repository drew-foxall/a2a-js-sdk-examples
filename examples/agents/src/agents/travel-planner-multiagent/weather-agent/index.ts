/**
 * Weather Agent
 *
 * A specialist agent for weather forecasts using Open-Meteo API.
 * Part of the Travel Planner Multi-Agent System.
 * This module exports ONLY the agent logic - no HTTP framework dependencies.
 */

export { createWeatherAgent } from "./agent.js";
export { getWeatherAgentPrompt } from "./prompt.js";
export {
  type GeocodeResult,
  geocodeLocation,
  getWeatherDescription,
  getWeatherForecast,
  isWeatherError,
  type WeatherForecast,
} from "./tools.js";
