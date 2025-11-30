/**
 * Travel Planner Agent Card
 *
 * Defines the Agent Card for the Travel Planner orchestrator.
 * This is shared between local server and Cloudflare Worker deployments.
 */

import type { AgentCard, AgentSkill } from "@drew-foxall/a2a-js-sdk";

/**
 * Travel Planning skill definition
 */
export const travelPlanningSkill: AgentSkill = {
  id: "travel_planning",
  name: "Travel Planning",
  description:
    "Comprehensive travel planning by coordinating weather forecasts and accommodation searches",
  tags: ["travel", "planning", "orchestration", "multi-agent", "weather", "accommodations"],
  examples: [
    "Plan a trip to Paris for 2 people",
    "What's the weather in Los Angeles and find hotels",
    "I need accommodations in Tokyo and the weather forecast",
    "Plan a trip to New York, June 20-25, 2 adults",
  ],
};

/**
 * Create a Travel Planner Agent Card
 *
 * @param url - The URL where this agent is hosted
 * @returns A complete AgentCard for the Travel Planner
 */
export function createTravelPlannerCard(url: string): AgentCard {
  return {
    name: "Travel Planner",
    description:
      "Multi-agent orchestrator that coordinates weather and accommodation searches for comprehensive travel planning. Uses dynamic agent discovery and the sendMessage routing pattern.",
    url,
    protocolVersion: "0.3.0",
    preferredTransport: "JSONRPC",
    version: "1.0.0",
    defaultInputModes: ["text"],
    defaultOutputModes: ["text"],
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: true,
    },
    skills: [travelPlanningSkill],
  };
}
