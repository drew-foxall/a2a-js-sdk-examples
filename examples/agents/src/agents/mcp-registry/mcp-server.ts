/**
 * MCP Agent Registry Server
 *
 * Implements the Model Context Protocol for agent discovery.
 * Provides tools and resources for finding and managing agents.
 */

import { z } from "zod";
import type { AgentRegistry } from "./registry.js";
import type {
  FindAgentQuery,
  FindAgentResult,
  RegisterAgentRequest,
  RegisteredAgentCard,
  RegistryStats,
} from "./types.js";

// ============================================================================
// MCP Protocol Types
// ============================================================================

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
// Tool Schemas
// ============================================================================

const findAgentSchema = z.object({
  query: z.string().describe("Natural language description of the task to find an agent for"),
  requiredCapabilities: z.array(z.string()).optional().describe("Capabilities the agent must have"),
  preferredTags: z.array(z.string()).optional().describe("Preferred tags for ranking"),
  limit: z.number().optional().describe("Maximum number of results (default: 5)"),
});

const listAgentsSchema = z.object({
  tags: z.array(z.string()).optional().describe("Filter by tags"),
  healthyOnly: z.boolean().optional().describe("Only return healthy agents"),
});

const getAgentSchema = z.object({
  name: z.string().describe("Exact name of the agent to retrieve"),
});

const registerAgentSchema = z.object({
  agentCard: z.object({
    name: z.string(),
    description: z.string(),
    url: z.string(),
    version: z.string().optional(),
    capabilities: z
      .object({
        streaming: z.boolean().optional(),
        pushNotifications: z.boolean().optional(),
      })
      .optional(),
    skills: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          description: z.string().optional(),
          tags: z.array(z.string()).optional(),
        })
      )
      .optional(),
  }),
  tags: z.array(z.string()).optional().describe("Additional tags for the agent"),
});

const unregisterAgentSchema = z.object({
  name: z.string().describe("Name of the agent to unregister"),
});

// ============================================================================
// Tool Definitions (MCP Format)
// ============================================================================

const TOOLS = [
  {
    name: "find_agent",
    description:
      "Find the best agent(s) for a given task. Uses capability matching to find agents that can handle the request. Returns ranked results with match scores.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Natural language description of the task",
        },
        requiredCapabilities: {
          type: "array",
          items: { type: "string" },
          description: "Capabilities the agent must have",
        },
        preferredTags: {
          type: "array",
          items: { type: "string" },
          description: "Preferred tags for ranking",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default: 5)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "list_agents",
    description:
      "List all registered agents in the registry. Can filter by tags and health status.",
    inputSchema: {
      type: "object" as const,
      properties: {
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Filter by tags",
        },
        healthyOnly: {
          type: "boolean",
          description: "Only return healthy agents",
        },
      },
    },
  },
  {
    name: "get_agent",
    description: "Get a specific agent by its exact name.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Exact name of the agent",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "register_agent",
    description:
      "Register a new agent in the registry. Requires an Agent Card with name, description, and URL.",
    inputSchema: {
      type: "object" as const,
      properties: {
        agentCard: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            url: { type: "string" },
            version: { type: "string" },
            capabilities: {
              type: "object",
              properties: {
                streaming: { type: "boolean" },
                pushNotifications: { type: "boolean" },
              },
            },
            skills: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  description: { type: "string" },
                  tags: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
          required: ["name", "description", "url"],
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Additional tags for the agent",
        },
      },
      required: ["agentCard"],
    },
  },
  {
    name: "unregister_agent",
    description: "Remove an agent from the registry.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Name of the agent to unregister",
        },
      },
      required: ["name"],
    },
  },
];

// ============================================================================
// MCP Server Class
// ============================================================================

/**
 * MCP Server for Agent Registry
 *
 * Implements the Model Context Protocol with:
 * - Tools: find_agent, list_agents, get_agent, register_agent, unregister_agent
 * - Resources: agent_cards/list, agent_cards/{name}, registry/stats
 */
export class MCPRegistryServer {
  private registry: AgentRegistry;

  constructor(registry: AgentRegistry) {
    this.registry = registry;
  }

  /**
   * Handle an MCP request
   */
  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    const { id, method, params } = request;

    try {
      switch (method) {
        case "initialize":
          return this.handleInitialize(id);

        case "tools/list":
          return this.handleToolsList(id);

        case "tools/call":
          return await this.handleToolCall(
            id,
            params as { name: string; arguments: Record<string, unknown> }
          );

        case "resources/list":
          return this.handleResourcesList(id);

        case "resources/read":
          return await this.handleResourceRead(id, params as { uri: string });

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

  // ==========================================================================
  // Protocol Handlers
  // ==========================================================================

  private handleInitialize(id: string | number): MCPResponse {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        serverInfo: {
          name: "agent-registry",
          version: "1.0.0",
        },
        capabilities: {
          tools: {},
          resources: {},
        },
      },
    };
  }

  private handleToolsList(id: string | number): MCPResponse {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        tools: TOOLS,
      },
    };
  }

  private async handleToolCall(
    id: string | number,
    params: { name: string; arguments: Record<string, unknown> }
  ): Promise<MCPResponse> {
    const { name, arguments: args } = params;

    try {
      let result: unknown;

      switch (name) {
        case "find_agent": {
          const parsed = findAgentSchema.safeParse(args);
          if (!parsed.success) {
            return this.errorResponse(id, -32602, `Invalid parameters: ${parsed.error.message}`);
          }
          result = this.findAgent(parsed.data);
          break;
        }

        case "list_agents": {
          const parsed = listAgentsSchema.safeParse(args);
          if (!parsed.success) {
            return this.errorResponse(id, -32602, `Invalid parameters: ${parsed.error.message}`);
          }
          result = this.listAgents(parsed.data);
          break;
        }

        case "get_agent": {
          const parsed = getAgentSchema.safeParse(args);
          if (!parsed.success) {
            return this.errorResponse(id, -32602, `Invalid parameters: ${parsed.error.message}`);
          }
          result = this.getAgent(parsed.data.name);
          break;
        }

        case "register_agent": {
          const parsed = registerAgentSchema.safeParse(args);
          if (!parsed.success) {
            return this.errorResponse(id, -32602, `Invalid parameters: ${parsed.error.message}`);
          }
          result = this.registerAgent(parsed.data as RegisterAgentRequest);
          break;
        }

        case "unregister_agent": {
          const parsed = unregisterAgentSchema.safeParse(args);
          if (!parsed.success) {
            return this.errorResponse(id, -32602, `Invalid parameters: ${parsed.error.message}`);
          }
          result = this.unregisterAgent(parsed.data.name);
          break;
        }

        default:
          return this.errorResponse(id, -32602, `Unknown tool: ${name}`);
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
      return this.errorResponse(
        id,
        -32603,
        error instanceof Error ? error.message : "Tool execution failed"
      );
    }
  }

  private handleResourcesList(id: string | number): MCPResponse {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        resources: [
          {
            uri: "agent_cards/list",
            name: "Agent Cards List",
            description: "List of all registered agent cards",
            mimeType: "application/json",
          },
          {
            uri: "registry/stats",
            name: "Registry Statistics",
            description: "Statistics about the registry",
            mimeType: "application/json",
          },
        ],
      },
    };
  }

  private async handleResourceRead(
    id: string | number,
    params: { uri: string }
  ): Promise<MCPResponse> {
    const { uri } = params;

    try {
      let content: unknown;

      if (uri === "agent_cards/list") {
        content = this.registry.listAgents();
      } else if (uri === "registry/stats") {
        content = this.registry.getStats();
      } else if (uri.startsWith("agent_cards/")) {
        const name = uri.replace("agent_cards/", "");
        content = this.registry.getAgent(name);
        if (!content) {
          return this.errorResponse(id, -32602, `Agent not found: ${name}`);
        }
      } else {
        return this.errorResponse(id, -32602, `Unknown resource: ${uri}`);
      }

      return {
        jsonrpc: "2.0",
        id,
        result: {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(content, null, 2),
            },
          ],
        },
      };
    } catch (error) {
      return this.errorResponse(
        id,
        -32603,
        error instanceof Error ? error.message : "Resource read failed"
      );
    }
  }

  // ==========================================================================
  // Tool Implementations
  // ==========================================================================

  private findAgent(query: FindAgentQuery): FindAgentResult[] {
    return this.registry.findAgent(query);
  }

  private listAgents(options?: { tags?: string[]; healthyOnly?: boolean }): RegisteredAgentCard[] {
    return this.registry.listAgents(options);
  }

  private getAgent(name: string): RegisteredAgentCard | { error: string } {
    const agent = this.registry.getAgent(name);
    if (!agent) {
      return { error: `Agent not found: ${name}` };
    }
    return agent;
  }

  private registerAgent(request: RegisterAgentRequest): RegisteredAgentCard {
    return this.registry.register(request);
  }

  private unregisterAgent(name: string): { success: boolean; message: string } {
    const removed = this.registry.unregister(name);
    return {
      success: removed,
      message: removed ? `Agent "${name}" unregistered` : `Agent "${name}" not found`,
    };
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private errorResponse(id: string | number, code: number, message: string): MCPResponse {
    return {
      jsonrpc: "2.0",
      id,
      error: { code, message },
    };
  }

  /**
   * Get the underlying registry (for direct access)
   */
  getRegistry(): AgentRegistry {
    return this.registry;
  }

  /**
   * Get tool definitions (for documentation)
   */
  getTools(): typeof TOOLS {
    return TOOLS;
  }

  /**
   * Get registry stats
   */
  getStats(): RegistryStats {
    return this.registry.getStats();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an MCP Registry Server
 */
export function createMCPRegistryServer(registry: AgentRegistry): MCPRegistryServer {
  return new MCPRegistryServer(registry);
}
