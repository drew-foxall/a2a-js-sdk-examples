/**
 * MCP Client for Airbnb Agent
 *
 * Connects to the @openbnb/mcp-server-airbnb MCP server to get real Airbnb tools.
 * This matches the Python implementation's use of MCP for real data.
 */

import { experimental_createMCPClient, type experimental_MCPClient } from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";

/**
 * MCP client instance (singleton pattern)
 */
let mcpClientInstance: experimental_MCPClient | null = null;

/**
 * Initialize the MCP client for Airbnb tools
 *
 * This connects to the @openbnb/mcp-server-airbnb MCP server using stdio transport.
 * The MCP server provides real Airbnb search capabilities.
 *
 * @returns MCP client instance
 */
export async function initializeMCPClient(): Promise<experimental_MCPClient> {
  if (mcpClientInstance) {
    return mcpClientInstance;
  }

  console.log("🔌 Initializing MCP client for Airbnb tools...");

  try {
    mcpClientInstance = await experimental_createMCPClient({
      transport: new Experimental_StdioMCPTransport({
        command: "npx",
        args: ["-y", "@openbnb/mcp-server-airbnb", "--ignore-robots-txt"],
      }),
    });

    console.log("✅ MCP client connected to @openbnb/mcp-server-airbnb");
    return mcpClientInstance;
  } catch (error) {
    console.error("❌ Failed to initialize MCP client:", error);
    throw new Error(
      `MCP client initialization failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get Airbnb tools from the MCP server
 *
 * @returns Object with tool names as keys and Tool instances as values from the MCP server
 */
export async function getAirbnbMCPTools(): Promise<
  Awaited<ReturnType<experimental_MCPClient["tools"]>>
> {
  const client = await initializeMCPClient();

  console.log("🔧 Fetching tools from MCP server...");
  const tools = await client.tools();

  console.log(
    `✅ Retrieved ${Object.keys(tools).length} tool(s) from MCP server:`,
    Object.keys(tools).join(", ")
  );

  return tools;
}

/**
 * Close the MCP client connection
 *
 * Should be called when shutting down the agent server.
 */
export async function closeMCPClient(): Promise<void> {
  if (mcpClientInstance) {
    console.log("🔌 Closing MCP client connection...");
    await mcpClientInstance.close();
    mcpClientInstance = null;
    console.log("✅ MCP client closed");
  }
}

/**
 * Setup graceful shutdown handlers for MCP client
 */
export function setupMCPShutdownHandlers(): void {
  const shutdownHandler = async () => {
    console.log("\n🛑 Shutting down gracefully...");
    await closeMCPClient();
    process.exit(0);
  };

  process.on("SIGINT", shutdownHandler);
  process.on("SIGTERM", shutdownHandler);
}
