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
import { z } from "zod/v4";

// ============================================================================
// Types & Validation Schemas
// ============================================================================

interface Env {
  IGNORE_ROBOTS_TXT?: string;
}

// Zod schemas for runtime validation of tool arguments
const airbnbSearchParamsSchema = z.object({
  location: z.string(),
  checkin: z.string().optional(),
  checkout: z.string().optional(),
  adults: z.number().optional(),
  children: z.number().optional(),
  infants: z.number().optional(),
  pets: z.number().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  cursor: z.string().optional(),
});

const airbnbListingDetailsParamsSchema = z.object({
  id: z.string(),
  checkin: z.string().optional(),
  checkout: z.string().optional(),
  adults: z.number().optional(),
  children: z.number().optional(),
  infants: z.number().optional(),
  pets: z.number().optional(),
});

type AirbnbSearchParams = z.infer<typeof airbnbSearchParamsSchema>;
type AirbnbListingDetailsParams = z.infer<typeof airbnbListingDetailsParamsSchema>;

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
// Constants
// ============================================================================

const _USER_AGENT =
  "ModelContextProtocol/1.0 (Autonomous; +https://github.com/modelcontextprotocol/servers)";
const BASE_URL = "https://www.airbnb.com";

// Tool definitions (MCP format)
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
// Airbnb Scraping Functions
// ============================================================================

async function fetchWithUserAgent(url: string): Promise<Response> {
  // Use a more realistic browser User-Agent
  const browserUA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  const response = await fetch(url, {
    headers: {
      "User-Agent": browserUA,
      "Accept-Language": "en-US,en;q=0.9",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Cache-Control": "no-cache",
    },
    redirect: "follow", // Follow redirects
  });

  return response;
}

function buildSearchUrl(params: AirbnbSearchParams): string {
  const searchParams = new URLSearchParams();

  // Location is required
  searchParams.set("query", params.location);

  // Dates
  if (params.checkin) searchParams.set("checkin", params.checkin);
  if (params.checkout) searchParams.set("checkout", params.checkout);

  // Guests
  if (params.adults) searchParams.set("adults", String(params.adults));
  if (params.children) searchParams.set("children", String(params.children));
  if (params.infants) searchParams.set("infants", String(params.infants));
  if (params.pets) searchParams.set("pets", String(params.pets));

  // Price filters
  if (params.minPrice) searchParams.set("price_min", String(params.minPrice));
  if (params.maxPrice) searchParams.set("price_max", String(params.maxPrice));

  // Pagination
  if (params.cursor) searchParams.set("cursor", params.cursor);

  return `${BASE_URL}/s/${encodeURIComponent(params.location)}/homes?${searchParams.toString()}`;
}

async function searchAirbnb(params: AirbnbSearchParams): Promise<unknown> {
  const url = buildSearchUrl(params);

  try {
    const response = await fetchWithUserAgent(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract listing data from the page using the same method as the original MCP server
    // Airbnb embeds JSON data in a script tag with id="data-deferred-state-0"
    const listings: unknown[] = [];
    let paginationInfo: unknown = null;

    // Try to find the embedded JSON data (matching original MCP server approach)
    const scriptElement = $("#data-deferred-state-0").first();

    if (scriptElement.length > 0) {
      try {
        const scriptContent = scriptElement.text();
        if (scriptContent) {
          const data = JSON.parse(scriptContent);

          // Original MCP uses: niobeClientData[0][1].data.presentation.staysSearch.results
          const clientData = data?.niobeClientData?.[0]?.[1];
          const results = clientData?.data?.presentation?.staysSearch?.results;

          if (results?.searchResults) {
            for (const result of results.searchResults) {
              // Extract listing ID from base64 encoded string
              let listingId = result?.demandStayListing?.id;
              if (listingId) {
                try {
                  // Decode base64: "StayListing:12345" -> "12345"
                  const decoded = atob(listingId);
                  listingId = decoded.split(":")[1] || listingId;
                } catch {
                  // Keep original if decode fails
                }
              }

              listings.push({
                id: listingId,
                url: `${BASE_URL}/rooms/${listingId}`,
                description: result?.demandStayListing?.description,
                location: result?.demandStayListing?.location,
                badges: result?.badges,
                rating: result?.avgRatingA11yLabel,
                price: result?.structuredDisplayPrice?.primaryLine?.accessibilityLabel,
                priceSecondary: result?.structuredDisplayPrice?.secondaryLine?.accessibilityLabel,
                content: result?.structuredContent,
              });
            }

            paginationInfo = results.paginationInfo;
          }
        }
      } catch (e) {
        console.error("Error parsing data-deferred-state-0:", e);
      }
    }

    // Fallback: try alternative data structures
    if (listings.length === 0) {
      $('script[id^="data-deferred-state"]').each((_, el) => {
        try {
          const jsonText = $(el).text();
          const data = JSON.parse(jsonText);

          // Try multiple possible paths for the data
          const searchResults =
            data?.niobeMinimalClientData?.[0]?.[1]?.data?.presentation?.explore?.sections
              ?.sectionIndependentData?.staysSearch?.searchResults ||
            data?.niobeClientData?.[0]?.[1]?.data?.presentation?.staysSearch?.results
              ?.searchResults ||
            [];

          for (const result of searchResults) {
            if (result?.listing || result?.demandStayListing) {
              const listing = result.listing || result.demandStayListing;
              listings.push({
                id: listing.id,
                name: listing.name,
                title: listing.title,
                roomType: listing.roomTypeCategory,
                personCapacity: listing.personCapacity,
                avgRating: listing.avgRating,
                reviewsCount: listing.reviewsCount,
                price:
                  result.pricingQuote?.structuredStayDisplayPrice?.primaryLine
                    ?.accessibilityLabel ||
                  result?.structuredDisplayPrice?.primaryLine?.accessibilityLabel,
                url: `${BASE_URL}/rooms/${listing.id}`,
                images:
                  listing.contextualPictures
                    ?.slice(0, 3)
                    .map((p: { picture: string }) => p.picture) || [],
                coordinate: listing.coordinate,
              });
            }
          }
        } catch (e) {
          console.error("Error parsing listing data:", e);
        }
      });
    }

    // Fallback: try to extract from visible HTML if JSON parsing failed
    if (listings.length === 0) {
      $('[data-testid="card-container"]').each((_, el) => {
        const $card = $(el);
        const link = $card.find("a").first().attr("href");
        const title = $card.find('[data-testid="listing-card-title"]').text();
        const price = $card.find('[data-testid="price-availability-row"]').text();

        if (link) {
          const idMatch = link.match(/\/rooms\/(\d+)/);
          listings.push({
            id: idMatch?.[1] || "unknown",
            title: title || "Airbnb Listing",
            price: price || "Price not available",
            url: link.startsWith("http") ? link : `${BASE_URL}${link}`,
          });
        }
      });
    }

    return {
      searchUrl: url,
      location: params.location,
      checkin: params.checkin,
      checkout: params.checkout,
      guests: {
        adults: params.adults || 1,
        children: params.children || 0,
        infants: params.infants || 0,
        pets: params.pets || 0,
      },
      resultsCount: listings.length,
      searchResults: listings,
      paginationInfo,
    };
  } catch (error) {
    console.error("Search error:", error);
    throw error;
  }
}

async function getListingDetails(params: AirbnbListingDetailsParams): Promise<unknown> {
  const searchParams = new URLSearchParams();
  if (params.checkin) searchParams.set("check_in", params.checkin);
  if (params.checkout) searchParams.set("check_out", params.checkout);
  if (params.adults) searchParams.set("adults", String(params.adults));

  const url = `${BASE_URL}/rooms/${params.id}?${searchParams.toString()}`;

  try {
    const response = await fetchWithUserAgent(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract listing details from embedded JSON
    let listingData: Record<string, unknown> = {};

    $('script[id="data-deferred-state"]').each((_, el) => {
      try {
        const jsonText = $(el).text();
        const data = JSON.parse(jsonText);

        // Navigate to find listing details
        const pdpData =
          data?.niobeMinimalClientData?.[0]?.[1]?.data?.presentation?.stayProductDetailPage;

        if (pdpData) {
          const listing = pdpData.sections?.metadata?.loggingContext?.eventDataLogging;
          const sections = pdpData.sections;

          listingData = {
            id: params.id,
            name: listing?.listingName || sections?.title?.title,
            description: sections?.description?.htmlDescription?.htmlText,
            roomType: listing?.roomType,
            personCapacity: listing?.personCapacity,
            bedrooms: listing?.bedroomLabel,
            bathrooms: listing?.bathroomLabel,
            amenities: sections?.amenities?.seeAllAmenitiesGroups?.flatMap(
              (g: { amenities: Array<{ title: string }> }) => g.amenities?.map((a) => a.title) || []
            ),
            rating: sections?.reviews?.overallRating,
            reviewsCount: sections?.reviews?.reviewsCount,
            host: {
              name: sections?.host?.hostAvatar?.title,
              isSuperhost: sections?.host?.isSuperhost,
            },
            location: {
              city: listing?.city,
              neighborhood: sections?.location?.subtitle,
            },
            pricing: sections?.bookIt?.bookItPrice,
            url,
          };
        }
      } catch (e) {
        console.error("Error parsing listing details:", e);
      }
    });

    // Fallback extraction from HTML
    if (Object.keys(listingData).length === 0) {
      listingData = {
        id: params.id,
        title: $("h1").first().text() || "Listing Details",
        url,
        note: "Detailed data extraction limited - please visit the URL for full details",
      };
    }

    return listingData;
  } catch (error) {
    console.error("Listing details error:", error);
    throw error;
  }
}

// ============================================================================
// MCP Protocol Handler
// ============================================================================

function handleMCPRequest(request: MCPRequest): MCPResponse {
  const { id, method, params: _params } = request;

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
        result = await searchAirbnb(parseResult.data);
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
        result = await getListingDetails(parseResult.data);
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
      // For SSE, we'd need a more complex implementation
      // For now, return info about using the POST endpoint
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
