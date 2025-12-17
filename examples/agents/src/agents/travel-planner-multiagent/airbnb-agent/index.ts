/**
 * Airbnb Agent
 *
 * A specialist agent for Airbnb accommodation search using MCP tools.
 * Part of the Travel Planner Multi-Agent System.
 * This module exports ONLY the agent logic - no HTTP framework dependencies.
 */

// Stdio MCP client (for Node.js)
export { createAirbnbAgent } from "./agent.js";
// HTTP MCP client (for Workers and cross-platform)
export { type AirbnbAgentHttpConfig, createAirbnbAgentHttp } from "./agent-http.js";
export {
  closeMCPClient,
  getAirbnbMCPTools,
  initializeMCPClient,
  setupMCPShutdownHandlers,
} from "./mcp-client.js";
export {
  type AirbnbSearchParams,
  type AirbnbTools,
  type CloudflareFetcher,
  createAirbnbMCPTools,
  createMCPHttpClient,
  type ListingDetailsParams,
  type MCPClient,
  MCPHttpClient,
  type MCPHttpClientConfig,
} from "./mcp-client-http.js";
// Prompt
export { getAirbnbAgentPrompt } from "./prompt.js";
// Mock tools (for testing)
export {
  type AirbnbListing,
  getAvailableLocations,
  isSearchError,
  type SearchResult,
  searchAirbnbListings,
} from "./tools.mock.js";
