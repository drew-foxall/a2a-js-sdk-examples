/**
 * MCP Agent Registry Worker
 *
 * A Cloudflare Worker that provides MCP-based agent discovery.
 * Agents can register themselves, and orchestrators can find agents by capability.
 *
 * Endpoints:
 * - GET  /                    - Server info
 * - GET  /health              - Health check
 * - POST /mcp                 - MCP JSON-RPC endpoint
 * - GET  /agents              - List all agents (REST)
 * - POST /agents              - Register an agent (REST)
 * - GET  /agents/:name        - Get agent by name (REST)
 * - DELETE /agents/:name      - Unregister agent (REST)
 * - GET  /find                - Find agent by query (REST)
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { Redis } from "@upstash/redis/cloudflare";
import {
  createAgentRegistry,
  createMCPRegistryServer,
  createRedisRegistryStore,
  createInMemoryRegistryStore,
  type RegistryStore,
  type RegisteredAgentCard,
} from "a2a-agents/agents/mcp-registry";

// ============================================================================
// Types
// ============================================================================

interface Env {
  // Upstash Redis (optional - for persistence)
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
}

interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

// ============================================================================
// Store Factory
// ============================================================================

function createStore(env: Env): RegistryStore {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    const redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
    return createRedisRegistryStore({ redis });
  }
  return createInMemoryRegistryStore();
}

// ============================================================================
// App Setup
// ============================================================================

const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use("*", cors());

// ============================================================================
// Routes
// ============================================================================

// Server info
app.get("/", (c) => {
  return c.json({
    name: "MCP Agent Registry",
    description:
      "Model Context Protocol server for dynamic agent discovery. Register agents and find them by capability.",
    version: "1.0.0",
    endpoints: {
      mcp: "POST /mcp - MCP JSON-RPC endpoint",
      agents: "GET/POST /agents - List/register agents",
      find: "GET /find?query=... - Find agent by capability",
      health: "GET /health",
    },
    tools: [
      { name: "find_agent", description: "Find the best agent for a task" },
      { name: "list_agents", description: "List all registered agents" },
      { name: "get_agent", description: "Get a specific agent by name" },
      { name: "register_agent", description: "Register a new agent" },
      { name: "unregister_agent", description: "Remove an agent" },
    ],
  });
});

// Health check
app.get("/health", async (c) => {
  const hasRedis = !!(c.env.UPSTASH_REDIS_REST_URL && c.env.UPSTASH_REDIS_REST_TOKEN);

  return c.json({
    status: "healthy",
    server: "mcp-agent-registry",
    version: "1.0.0",
    persistence: hasRedis ? "redis" : "memory",
    timestamp: new Date().toISOString(),
  });
});

// MCP JSON-RPC endpoint
app.post("/mcp", async (c) => {
  try {
    const request = await c.req.json<MCPRequest>();

    // Load registry from storage
    const store = createStore(c.env);
    const savedAgents = await store.load();
    const registry = createAgentRegistry();
    registry.importAgents(savedAgents);
    const mcpServer = createMCPRegistryServer(registry);

    // Handle the request
    const response = await mcpServer.handleRequest(request);

    // Save agents back to storage if modified
    if (
      request.method === "tools/call" &&
      request.params &&
      ["register_agent", "unregister_agent"].includes(
        (request.params as { name?: string }).name || ""
      )
    ) {
      await store.save(registry.exportAgents());
    }

    return c.json(response);
  } catch (error) {
    return c.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32700,
          message: "Parse error",
        },
      },
      400
    );
  }
});

// REST: List agents
app.get("/agents", async (c) => {
  const store = createStore(c.env);
  const savedAgents = await store.load();
  const registry = createAgentRegistry();
  registry.importAgents(savedAgents);

  const tags = c.req.query("tags")?.split(",");
  const healthyOnly = c.req.query("healthyOnly") === "true";

  const agents = registry.listAgents({ tags, healthyOnly });

  return c.json({
    count: agents.length,
    agents,
  });
});

// REST: Register agent
app.post("/agents", async (c) => {
  try {
    const body = await c.req.json<{
      agentCard: {
        name: string;
        description: string;
        url: string;
        version?: string;
        protocolVersion?: string;
        defaultInputModes?: string[];
        defaultOutputModes?: string[];
        capabilities?: { streaming?: boolean; pushNotifications?: boolean };
        skills?: Array<{
          id: string;
          name: string;
          description?: string;
          tags?: string[];
        }>;
      };
      tags?: string[];
    }>();

    // Ensure required fields have defaults for A2A protocol compliance
    const agentCard = {
      ...body.agentCard,
      protocolVersion: body.agentCard.protocolVersion ?? "0.3.0",
      defaultInputModes: body.agentCard.defaultInputModes ?? ["text"],
      defaultOutputModes: body.agentCard.defaultOutputModes ?? ["text"],
    } as const;

    const store = createStore(c.env);
    const savedAgents = await store.load();
    const registry = createAgentRegistry();
    registry.importAgents(savedAgents);

    // Register expects AgentCard - the spread above ensures required fields
    const registered = registry.register({
      agentCard: agentCard as Parameters<typeof registry.register>[0]["agentCard"],
      tags: body.tags,
    });

    await store.save(registry.exportAgents());

    return c.json({
      success: true,
      agent: registered,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Invalid request",
      },
      400
    );
  }
});

// REST: Get agent by name
app.get("/agents/:name", async (c) => {
  const name = c.req.param("name");

  const store = createStore(c.env);
  const savedAgents = await store.load();
  const registry = createAgentRegistry();
  registry.importAgents(savedAgents);

  const agent = registry.getAgent(name);

  if (!agent) {
    return c.json({ error: `Agent not found: ${name}` }, 404);
  }

  return c.json(agent);
});

// REST: Unregister agent
app.delete("/agents/:name", async (c) => {
  const name = c.req.param("name");

  const store = createStore(c.env);
  const savedAgents = await store.load();
  const registry = createAgentRegistry();
  registry.importAgents(savedAgents);

  const removed = registry.unregister(name);

  if (removed) {
    await store.save(registry.exportAgents());
  }

  return c.json({
    success: removed,
    message: removed ? `Agent "${name}" unregistered` : `Agent "${name}" not found`,
  });
});

// REST: Find agent by query
app.get("/find", async (c) => {
  const query = c.req.query("query");

  if (!query) {
    return c.json({ error: "Missing query parameter" }, 400);
  }

  const store = createStore(c.env);
  const savedAgents = await store.load();
  const registry = createAgentRegistry();
  registry.importAgents(savedAgents);

  const limit = parseInt(c.req.query("limit") || "5", 10);
  const requiredCapabilities = c.req.query("capabilities")?.split(",");
  const preferredTags = c.req.query("tags")?.split(",");

  const results = registry.findAgent({
    query,
    limit,
    requiredCapabilities,
    preferredTags,
  });

  return c.json({
    query,
    count: results.length,
    results,
  });
});

// REST: Registry stats
app.get("/stats", async (c) => {
  const store = createStore(c.env);
  const savedAgents = await store.load();
  const registry = createAgentRegistry();
  registry.importAgents(savedAgents);

  return c.json(registry.getStats());
});

// ============================================================================
// Export
// ============================================================================

export default app;
