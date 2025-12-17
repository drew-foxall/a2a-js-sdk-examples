/**
 * Airbnb Agent (HTTP MCP)
 *
 * A composable version of the Airbnb agent that uses HTTP-based MCP tools.
 * Works in both Node.js and Cloudflare Workers environments.
 */

import { type LanguageModel, ToolLoopAgent } from "ai";
import {
  type AirbnbSearchParams,
  type AirbnbTools,
  airbnbSearchSchema,
  createAirbnbMCPTools,
  createMCPHttpClient,
  type ListingDetailsParams,
  listingDetailsSchema,
  type MCPClient,
  type MCPHttpClientConfig,
} from "./mcp-client-http.js";
import { getAirbnbAgentPrompt } from "./prompt.js";

/**
 * Configuration for creating an Airbnb agent with HTTP MCP
 */
export interface AirbnbAgentHttpConfig {
  /** Language model to use */
  model: LanguageModel;
  /** MCP client configuration or pre-created client */
  mcp: MCPHttpClientConfig | MCPClient;
  /** Optional pre-created tools (for testing) */
  tools?: AirbnbTools;
}

/**
 * Create an Airbnb Agent with HTTP-based MCP tools
 *
 * @param config - Configuration including model and MCP client
 * @returns A configured ToolLoopAgent
 *
 * @example
 * ```typescript
 * // With URL
 * const agent = createAirbnbAgentHttp({
 *   model,
 *   mcp: { url: 'http://localhost:8788' }
 * });
 *
 * // With Service Binding
 * const agent = createAirbnbAgentHttp({
 *   model,
 *   mcp: { url: 'https://internal', fetcher: env.AIRBNB_MCP }
 * });
 * ```
 */
export function createAirbnbAgentHttp(config: AirbnbAgentHttpConfig) {
  const { model, mcp, tools: providedTools } = config;

  // Create MCP client if config provided
  const client: MCPClient =
    "callTool" in mcp ? mcp : createMCPHttpClient(mcp as MCPHttpClientConfig);

  // Create tools
  const tools = providedTools ?? createAirbnbMCPTools(client);

  return new ToolLoopAgent({
    model,
    instructions: getAirbnbAgentPrompt(),
    tools: {
      searchAirbnb: {
        description:
          "Search for Airbnb listings. Returns accommodations matching the criteria with prices and direct links.",
        inputSchema: airbnbSearchSchema,
        execute: async (params: AirbnbSearchParams) => {
          return tools.searchAirbnb(params);
        },
      },

      getListingDetails: {
        description:
          "Get detailed information about a specific Airbnb listing including amenities, reviews, and pricing.",
        inputSchema: listingDetailsSchema,
        execute: async (params: ListingDetailsParams) => {
          return tools.getListingDetails(params);
        },
      },
    },
  });
}
