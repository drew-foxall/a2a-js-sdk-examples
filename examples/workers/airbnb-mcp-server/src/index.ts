/**
 * Airbnb MCP Server - Cloudflare Worker
 *
 * Exposes Airbnb search functionality via the Model Context Protocol (MCP).
 * This Worker can be consumed by MCP clients using HTTP/SSE transport.
 *
 * Tools:
 * - airbnb_search: Search for Airbnb listings
 * - airbnb_listing_details: Get details of a specific listing
 */

import * as cheerio from "cheerio";
import {
  createAirbnbScraper,
  airbnbSearchParamsSchema,
  airbnbListingDetailsParamsSchema,
  type AirbnbScraper,
} from "a2a-agents/tools/airbnb-scraper";

// ============================================================================
// Types
// ============================================================================

interface Env {
  IGNORE_ROBOTS_TXT?: string;
}

interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// ============================================================================
// MCP Tool Definitions
// ============================================================================

const TOOLS = [
  {
    name: "airbnb_search",
    description:
      "Search for Airbnb listings with various filters. Returns listings with prices, ratings, and direct links.",
    inputSchema: {
      type: "object" as const,
      properties: {
        location: {
          type: "string",
          description: "Location to search for (city, state, country)",
        },
        checkin: {
          type: "string",
          description: "Check-in date (YYYY-MM-DD)",
        },
        checkout: {
          type: "string",
          description: "Check-out date (YYYY-MM-DD)",
        },
        adults: {
          type: "number",
          description: "Number of adults (default: 1)",
        },
        children: {
          type: "number",
          description: "Number of children",
        },
        infants: {
          type: "number",
          description: "Number of infants",
        },
        pets: {
          type: "number",
          description: "Number of pets",
        },
        minPrice: {
          type: "number",
          description: "Minimum price per night",
        },
        maxPrice: {
          type: "number",
          description: "Maximum price per night",
        },
      },
      required: ["location"],
    },
  },
  {
    name: "airbnb_listing_details",
    description:
      "Get detailed information about a specific Airbnb listing including amenities, reviews, and pricing.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: {
          type: "string",
          description: "The Airbnb listing ID",
        },
        checkin: {
          type: "string",
          description: "Check-in date (YYYY-MM-DD)",
        },
        checkout: {
          type: "string",
          description: "Check-out date (YYYY-MM-DD)",
        },
        adults: {
          type: "number",
          description: "Number of adults",
        },
      },
      required: ["id"],
    },
  },
];

// ============================================================================
// Scraper Factory
// ============================================================================

function createScraper(): AirbnbScraper {
  return createAirbnbScraper({
    cheerioLoad: cheerio.load,
  });
}

// ============================================================================
// MCP Protocol Handler
// ============================================================================

function handleMCPRequest(request: MCPRequest): MCPResponse {
  const { id, method } = request;

  try {
    switch (method) {
      case "initialize":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            serverInfo: {
              name: "airbnb-mcp-server",
              version: "1.0.0",
            },
            capabilities: {
              tools: {},
            },
          },
        };

      case "tools/list":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            tools: TOOLS,
          },
        };

      case "tools/call":
        // This will be handled async
        throw new Error("tools/call should be handled asynchronously");

      default:
        return {
          jsonrpc: "2.0",
          id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`,
          },
        };
    }
  } catch (error) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : "Internal error",
      },
    };
  }
}

async function handleToolCall(
  id: string | number,
  toolName: string,
  args: Record<string, unknown>
): Promise<MCPResponse> {
  try {
    const scraper = createScraper();
    let result: unknown;

    switch (toolName) {
      case "airbnb_search": {
        const parseResult = airbnbSearchParamsSchema.safeParse(args);
        if (!parseResult.success) {
          return {
            jsonrpc: "2.0",
            id,
            error: {
              code: -32602,
              message: `Invalid parameters: ${parseResult.error.message}`,
            },
          };
        }
        result = await scraper.search(parseResult.data);
        break;
      }

      case "airbnb_listing_details": {
        const parseResult = airbnbListingDetailsParamsSchema.safeParse(args);
        if (!parseResult.success) {
          return {
            jsonrpc: "2.0",
            id,
            error: {
              code: -32602,
              message: `Invalid parameters: ${parseResult.error.message}`,
            },
          };
        }
        result = await scraper.getListingDetails(parseResult.data);
        break;
      }

      default:
        return {
          jsonrpc: "2.0",
          id,
          error: {
            code: -32602,
            message: `Unknown tool: ${toolName}`,
          },
        };
    }

    return {
      jsonrpc: "2.0",
      id,
      result: {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      },
    };
  } catch (error) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : "Tool execution failed",
      },
    };
  }
}

// ============================================================================
// Worker Entry Point
// ============================================================================

export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check
    if (url.pathname === "/health") {
      return Response.json(
        {
          status: "healthy",
          server: "airbnb-mcp-server",
          version: "1.0.0",
          protocol: "MCP",
        },
        { headers: corsHeaders }
      );
    }

    // MCP endpoint info
    if (url.pathname === "/" && request.method === "GET") {
      return Response.json(
        {
          name: "Airbnb MCP Server",
          description: "Model Context Protocol server for Airbnb search and listing details",
          version: "1.0.0",
          endpoints: {
            mcp: "/mcp (POST - JSON-RPC)",
            sse: "/sse (GET - Server-Sent Events)",
            health: "/health",
          },
          tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
        },
        { headers: corsHeaders }
      );
    }

    // MCP JSON-RPC endpoint
    if (url.pathname === "/mcp" && request.method === "POST") {
      try {
        const body = (await request.json()) as MCPRequest;

        // Handle tools/call specially (async)
        if (body.method === "tools/call") {
          const params = body.params as { name: string; arguments: Record<string, unknown> };
          const response = await handleToolCall(body.id, params.name, params.arguments || {});
          return Response.json(response, { headers: corsHeaders });
        }

        // Handle other MCP methods
        const response = handleMCPRequest(body);
        return Response.json(response, { headers: corsHeaders });
      } catch (_error) {
        return Response.json(
          {
            jsonrpc: "2.0",
            id: null,
            error: {
              code: -32700,
              message: "Parse error",
            },
          },
          { status: 400, headers: corsHeaders }
        );
      }
    }

    // SSE endpoint for streaming MCP
    if (url.pathname === "/sse" && request.method === "GET") {
      return Response.json(
        {
          message: "SSE endpoint - use POST /mcp for JSON-RPC requests",
          note: "Full SSE streaming support coming soon",
        },
        { headers: corsHeaders }
      );
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
};
