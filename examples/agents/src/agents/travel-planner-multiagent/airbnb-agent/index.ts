/**
 * Airbnb Agent
 *
 * A specialist agent for Airbnb accommodation search using MCP tools.
 * Part of the Travel Planner Multi-Agent System.
 * This module exports ONLY the agent logic - no HTTP framework dependencies.
 */

// Stdio MCP client (for Node.js)
export { createAirbnbAgent } from "./agent.js";
export {
  closeMCPClient,
  getAirbnbMCPTools,
  initializeMCPClient,
  setupMCPShutdownHandlers,
} from "./mcp-client.js";

// HTTP MCP client (for Workers and cross-platform)
export { createAirbnbAgentHttp, type AirbnbAgentHttpConfig } from "./agent-http.js";
export {
  createAirbnbMCPTools,
  createMCPHttpClient,
  MCPHttpClient,
  type AirbnbSearchParams,
  type AirbnbTools,
  type CloudflareFetcher,
  type ListingDetailsParams,
  type MCPClient,
  type MCPHttpClientConfig,
} from "./mcp-client-http.js";

// Mock tools (for testing)
export {
  getAvailableLocations,
  isSearchError,
  searchAirbnbListings,
  type AirbnbListing,
  type SearchResult,
} from "./tools.mock.js";

// Prompt
export { getAirbnbAgentPrompt } from "./prompt.js";
