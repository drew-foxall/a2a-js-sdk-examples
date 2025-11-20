/**
 * Airbnb Agent
 *
 * A specialist agent for Airbnb accommodation search.
 * Part of the Travel Planner Multi-Agent System.
 */

import { ToolLoopAgent, type LanguageModel } from "ai";
import { z } from "zod";
import { getAirbnbAgentPrompt } from "./prompt.js";
import { searchAirbnbListings, isSearchError } from "./tools.js";

/**
 * Airbnb search tool parameter schema
 */
const airbnbSearchSchema = z.object({
  location: z.string().describe("City or location to search for accommodations"),
  checkIn: z
    .string()
    .describe("Check-in date in YYYY-MM-DD format (e.g., 2025-06-20)"),
  checkOut: z
    .string()
    .describe("Check-out date in YYYY-MM-DD format (e.g., 2025-06-25)"),
  guests: z
    .number()
    .min(1)
    .describe("Number of guests (minimum 1)"),
});

type AirbnbSearchParams = z.infer<typeof airbnbSearchSchema>;

/**
 * Create an Airbnb Agent
 *
 * This specialist agent searches for Airbnb accommodations (mock data).
 * It can be:
 * 1. Used standalone as an A2A agent
 * 2. Consumed by an orchestrator agent via a2a-ai-provider
 *
 * @param model - The language model to use
 * @returns A configured ToolLoopAgent
 */
export function createAirbnbAgent(model: LanguageModel) {
  return new ToolLoopAgent({
    model,
    instructions: getAirbnbAgentPrompt(),
    tools: {
      search_airbnb_listings: {
        description:
          "Search for Airbnb accommodations in a location for specific dates and number of guests",
        inputSchema: airbnbSearchSchema,
        execute: async (params: AirbnbSearchParams) => {
          const results = await searchAirbnbListings(
            params.location,
            params.checkIn,
            params.checkOut,
            params.guests
          );

          // Return error if search failed
          if (isSearchError(results)) {
            return { error: results.error };
          }

          // Format results for the agent
          return {
            success: true,
            location: results.location,
            checkIn: results.checkIn,
            checkOut: results.checkOut,
            guests: results.guests,
            totalResults: results.totalResults,
            listings: results.results.map((listing) => ({
              id: listing.id,
              title: listing.title,
              type: listing.type,
              location: listing.location,
              pricePerNight: `${listing.currency} $${listing.price}`,
              rating: listing.rating,
              reviews: listing.reviews,
              capacity: `${listing.guests} guests, ${listing.bedrooms} bedrooms, ${listing.beds} beds, ${listing.baths} baths`,
              amenities: listing.amenities.join(", "),
              description: listing.description,
              bookingUrl: listing.url,
            })),
          };
        },
      },
    },
  });
}

