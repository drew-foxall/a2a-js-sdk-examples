/**
 * HTTP MCP Client for Airbnb Agent
 *
 * A composable MCP client that works in both Node.js and Cloudflare Workers.
 * Uses HTTP transport instead of stdio for cross-platform compatibility.
 */

import { z } from "zod";

/**
 * MCP Tool Result from the server
 */
export interface MCPToolResult {
  content: Array<{ type: string; text: string }>;
}

/**
 * Cloudflare Fetcher interface (for Service Bindings)
 * This is a minimal interface compatible with Cloudflare Workers' Fetcher type.
 */
export interface CloudflareFetcher {
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
}

/**
 * HTTP-based MCP client configuration
 */
export interface MCPHttpClientConfig {
  /** Base URL of the MCP server */
  url: string;
  /** Optional Cloudflare Service Binding fetcher */
  fetcher?: CloudflareFetcher;
}

/**
 * Abstract interface for MCP client
 */
export interface MCPClient {
  callTool(name: string, args: Record<string, unknown>): Promise<string>;
}

/**
 * HTTP-based MCP client for Airbnb
 *
 * Works in both Node.js and Cloudflare Workers environments.
 */
export class MCPHttpClient implements MCPClient {
  private url: string;
  private fetcher?: CloudflareFetcher;

  constructor(config: MCPHttpClientConfig) {
    this.url = config.url;
    this.fetcher = config.fetcher;
  }

  /**
   * Call an MCP tool via HTTP
   */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<string> {
    const requestBody = {
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args,
      },
    };

    let response: Response;

    if (this.fetcher) {
      // Use Service Binding (faster, no network hop)
      response = await this.fetcher.fetch("https://internal/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
    } else {
      // Use HTTP URL
      response = await fetch(`${this.url}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
    }

    if (!response.ok) {
      throw new Error(`MCP call failed: ${response.status} ${response.statusText}`);
    }

    const result = (await response.json()) as {
      result?: MCPToolResult;
      error?: { message: string };
    };

    if (result.error) {
      throw new Error(`MCP error: ${result.error.message}`);
    }

    // Extract text from MCP response
    const content = result.result?.content?.[0];
    if (content?.type === "text") {
      return content.text;
    }

    return JSON.stringify(result.result);
  }
}

/**
 * Create an HTTP-based MCP client
 */
export function createMCPHttpClient(config: MCPHttpClientConfig): MCPClient {
  return new MCPHttpClient(config);
}

// ============================================================================
// Airbnb-specific schemas and tools
// ============================================================================

/**
 * Airbnb search parameters schema
 */
export const airbnbSearchSchema = z.object({
  location: z.string().describe("Location to search (city, state, country)"),
  checkin: z.string().optional().describe("Check-in date in YYYY-MM-DD format"),
  checkout: z.string().optional().describe("Check-out date in YYYY-MM-DD format"),
  adults: z.number().optional().describe("Number of adults (default: 1)"),
  children: z.number().optional().describe("Number of children"),
  infants: z.number().optional().describe("Number of infants"),
  pets: z.number().optional().describe("Number of pets"),
  minPrice: z.number().optional().describe("Minimum price per night"),
  maxPrice: z.number().optional().describe("Maximum price per night"),
});

/**
 * Airbnb listing details parameters schema
 */
export const listingDetailsSchema = z.object({
  id: z.string().describe("The Airbnb listing ID"),
  checkin: z.string().optional().describe("Check-in date in YYYY-MM-DD format"),
  checkout: z.string().optional().describe("Check-out date in YYYY-MM-DD format"),
  adults: z.number().optional().describe("Number of adults"),
});

export type AirbnbSearchParams = z.infer<typeof airbnbSearchSchema>;
export type ListingDetailsParams = z.infer<typeof listingDetailsSchema>;

/**
 * Airbnb tools interface
 */
export interface AirbnbTools {
  searchAirbnb(params: AirbnbSearchParams): Promise<string>;
  getListingDetails(params: ListingDetailsParams): Promise<string>;
}

/**
 * Create Airbnb tools using an MCP client
 */
export function createAirbnbMCPTools(client: MCPClient): AirbnbTools {
  return {
    searchAirbnb: async (params: AirbnbSearchParams) => {
      try {
        return await client.callTool("airbnb_search", params);
      } catch (error) {
        return `Error searching Airbnb: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    },

    getListingDetails: async (params: ListingDetailsParams) => {
      try {
        return await client.callTool("airbnb_listing_details", params);
      } catch (error) {
        return `Error getting listing details: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    },
  };
}

