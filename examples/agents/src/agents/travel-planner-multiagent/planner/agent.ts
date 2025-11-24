/**
 * Travel Planner Agent - Multi-Agent Orchestrator
 *
 * This agent coordinates Weather and Airbnb agents using ToolLoopAgent.
 * It demonstrates multi-agent orchestration using a2a-ai-provider within tools.
 *
 * KEY PATTERN: Each tool internally uses a2a() to delegate to specialist A2A agents.
 */

import { a2a } from "a2a-ai-provider";
import { ToolLoopAgent, generateText, type LanguageModel } from "ai";
import { z } from "zod";

/**
 * Configuration for specialist agents
 */
export interface PlannerAgentConfig {
  model: LanguageModel;
  weatherAgentUrl: string;
  airbnbAgentUrl: string;
}

/**
 * System prompt for the travel planner
 */
const PLANNER_INSTRUCTIONS = `You are a helpful travel planning assistant that coordinates weather forecasts and accommodation searches.

You have access to two specialist agents:
1. **getWeatherForecast** - Provides 7-day weather forecasts for any location
2. **searchAccommodations** - Searches for Airbnb accommodations

When a user asks about travel plans:
- If they mention weather, use getWeatherForecast
- If they mention accommodations/hotels/rooms, use searchAccommodations
- If they ask for a complete trip plan, use both tools
- Always provide clear, helpful responses based on the tool results

Be conversational and friendly. Format your responses nicely with sections for weather and accommodations.`;

/**
 * Tool Schemas
 */
const weatherForecastSchema = z.object({
  location: z.string().describe("The location to get weather for (e.g., 'Paris', 'Los Angeles', 'Tokyo')"),
});

const searchAccommodationsSchema = z.object({
  location: z.string().describe("The location to search (e.g., 'Paris', 'Los Angeles', 'Tokyo')"),
  guests: z.number().optional().describe("Number of guests (default: 2)"),
});

/**
 * Type-safe parameter types
 */
type WeatherForecastParams = z.infer<typeof weatherForecastSchema>;
type SearchAccommodationsParams = z.infer<typeof searchAccommodationsSchema>;

/**
 * Create the travel planner agent
 *
 * This agent uses ToolLoopAgent with tools that delegate to A2A specialist agents.
 * Each tool internally uses a2a() to consume an A2A agent as a "model".
 */
export function createPlannerAgent(config: PlannerAgentConfig): ToolLoopAgent {
  return new ToolLoopAgent({
    model: config.model,
    instructions: PLANNER_INSTRUCTIONS,
    tools: {
      /**
       * Get weather forecast by delegating to Weather Agent
       */
      getWeatherForecast: {
        description: "Get a 7-day weather forecast for a location. Use this when users ask about weather, temperature, or forecasts.",
        inputSchema: weatherForecastSchema,
        execute: async (params: WeatherForecastParams) => {
          console.log(`🌤️  Delegating to Weather Agent: ${params.location}`);
          
          try {
            // KEY PATTERN: Use a2a() to consume the Weather Agent as a "model"
            const result = await generateText({
              model: a2a(config.weatherAgentUrl),
              prompt: `What is the weather forecast for ${params.location}?`,
            });
            
            return result.text;
          } catch (error) {
            console.error("Weather Agent error:", error);
            return `Error getting weather forecast: ${error instanceof Error ? error.message : "Unknown error"}`;
          }
        },
      },

      /**
       * Search accommodations by delegating to Airbnb Agent
       */
      searchAccommodations: {
        description: "Search for Airbnb accommodations. Use this when users ask about hotels, rooms, stays, or lodging.",
        inputSchema: searchAccommodationsSchema,
        execute: async (params: SearchAccommodationsParams) => {
          const guestInfo = params.guests ? ` for ${params.guests} guests` : "";
          console.log(`🏠 Delegating to Airbnb Agent: ${params.location}${guestInfo}`);
          
          try {
            // KEY PATTERN: Use a2a() to consume the Airbnb Agent as a "model"
            const result = await generateText({
              model: a2a(config.airbnbAgentUrl),
              prompt: `Find accommodations in ${params.location}${guestInfo}`,
            });
            
            return result.text;
          } catch (error) {
            console.error("Airbnb Agent error:", error);
            return `Error searching accommodations: ${error instanceof Error ? error.message : "Unknown error"}`;
          }
        },
      },
    },
  });
}

/**
 * Export the agent creation function
 */
export const createTravelPlannerAgent = createPlannerAgent;
