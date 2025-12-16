/**
 * Travel Planner - Multi-Agent Orchestrator (Local Node.js Server)
 *
 * This is the orchestrator that coordinates Weather and Airbnb agents.
 * It uses the Python airbnb_planner_multiagent pattern:
 * - Dynamic agent discovery via Agent Card fetching
 * - Single sendMessage tool for routing to any agent
 * - Active agent state tracking for follow-ups
 *
 * V3 PROVIDER CAPABILITIES LEVERAGED:
 * - discoverAgent() with supportsCapability() for capability checking
 * - contextId/taskId for multi-turn conversation continuity
 * - providerMetadata.a2a for input-required detection
 * - Artifact extraction from responses
 * - Rich task state handling
 *
 * Port: 41254
 *
 * Usage:
 *   1. Start Weather Agent (port 41252)
 *   2. Start Airbnb Agent (port 41253)
 *   3. Start this orchestrator (port 41254)
 *
 *   pnpm agents:travel-planner
 */

import {
  type A2aProviderMetadata,
  a2aV3,
  discoverAgent,
  supportsCapability,
  toJSONObject,
} from "@drew-foxall/a2a-ai-provider-v3";
import { A2AAdapter } from "@drew-foxall/a2a-ai-sdk-adapter";
import type { AgentCard } from "@drew-foxall/a2a-js-sdk";
import {
  type AgentExecutor,
  DefaultRequestHandler,
  InMemoryTaskStore,
  type TaskStore,
} from "@drew-foxall/a2a-js-sdk/server";
import { A2AHonoApp } from "@drew-foxall/a2a-js-sdk/server/hono";
import { serve } from "@hono/node-server";
import { generateText } from "ai";
import { Hono } from "hono";
import { loadEnv } from "../../../shared/load-env.js";
import { getModel } from "../../../shared/utils.js";
import {
  type AgentArtifact,
  type AgentContext,
  createPlannerAgent,
  type SendMessageFn,
  type SendMessageResult,
} from "./agent.js";
import { DEFAULT_LOCAL_AGENT_URLS } from "./agent-discovery.js";
import { createTravelPlannerCard } from "./card.js";

// Load environment variables
loadEnv(import.meta.url);

// ============================================================================
// Configuration
// ============================================================================

const PORT = 41254;
const HOST = "0.0.0.0";
const BASE_URL = `http://localhost:${PORT}`;

// Specialist agent URLs (base URLs, discovery will fetch Agent Cards)
const WEATHER_AGENT_URL = process.env.WEATHER_AGENT_URL || DEFAULT_LOCAL_AGENT_URLS.weatherAgent;
const AIRBNB_AGENT_URL = process.env.AIRBNB_AGENT_URL || DEFAULT_LOCAL_AGENT_URLS.airbnbAgent;

// ============================================================================
// Agent Registry with V3 Discovery
// ============================================================================

/**
 * Registered agent info with full V3 capabilities
 */
interface RegisteredAgent {
  name: string;
  description: string;
  url: string;
  /** Full agent card for capability checking */
  card?: AgentCard;
  /** Whether agent supports streaming */
  supportsStreaming: boolean;
}

/**
 * Agent registry using V3 provider discovery with capability checking
 */
class AgentRegistry {
  private agents = new Map<string, RegisteredAgent>();

  /**
   * Discover an agent using V3 provider's discoverAgent helper
   * Stores full agent card for capability checking
   */
  async discover(url: string, fallback?: { name: string; description: string }): Promise<void> {
    try {
      const { agentUrl, agentCard } = await discoverAgent(url);

      // Check capabilities using V3 helper
      const supportsStreaming = supportsCapability(agentCard, "streaming");

      this.agents.set(agentCard.name, {
        name: agentCard.name,
        description: agentCard.description ?? `Agent at ${url}`,
        url: agentUrl,
        card: agentCard,
        supportsStreaming,
      });

      console.log(
        `   ✓ ${agentCard.name}: streaming=${supportsStreaming}, skills=${agentCard.skills?.length ?? 0}`
      );
    } catch (error) {
      if (fallback) {
        this.agents.set(fallback.name, {
          ...fallback,
          url,
          supportsStreaming: false, // Assume no streaming if discovery failed
        });
        console.warn(`   ⚠ Discovery failed for ${url}, using fallback: ${fallback.name}`);
      } else {
        throw error;
      }
    }
  }

  getAgent(name: string): RegisteredAgent | undefined {
    return this.agents.get(name);
  }

  getAgentNames(): string[] {
    return Array.from(this.agents.keys());
  }

  getAllAgents(): RegisteredAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Build agent roster with capability info for prompt injection
   */
  buildAgentRoster(): string {
    return this.getAllAgents()
      .map((agent) =>
        JSON.stringify({
          name: agent.name,
          description: agent.description,
          capabilities: {
            streaming: agent.supportsStreaming,
          },
        })
      )
      .join("\n");
  }
}

// ============================================================================
// V3-Enhanced sendMessage Implementation
// ============================================================================

/**
 * Extract artifacts from V3 provider metadata
 */
function extractArtifacts(metadata: A2aProviderMetadata | undefined): AgentArtifact[] {
  if (!metadata?.artifacts) return [];

  return metadata.artifacts.map((artifact) => ({
    artifactId: artifact.artifactId ?? "unknown",
    name: artifact.name ?? undefined,
    description: artifact.description ?? undefined,
    parts:
      artifact.parts?.map((part) => ({
        kind: part.kind as "text" | "file" | "data",
        text: part.text ?? undefined,
        data: part.data ?? undefined,
        file: part.file ?? undefined,
      })) ?? [],
  }));
}

/**
 * Create an HTTP-based sendMessage function using a2a-ai-provider-v3
 *
 * LEVERAGES V3 CAPABILITIES:
 * - providerOptions.a2a for contextId/taskId continuity
 * - providerMetadata.a2a for rich response metadata
 * - inputRequired flag for multi-turn handling
 * - Artifact extraction
 * - Task state mapping
 *
 * NOTE: Uses generateText (non-streaming) for agent-to-agent communication.
 * The orchestrator needs the complete response to decide what to do next.
 * Streaming to the USER is handled by the A2AAdapter wrapping the ToolLoopAgent.
 */
function createHttpSendMessage(registry: AgentRegistry): SendMessageFn {
  return async (agentName, task, options): Promise<SendMessageResult> => {
    const agent = registry.getAgent(agentName);
    if (!agent) {
      return {
        text: `Error: Agent "${agentName}" not found. Available: ${registry.getAgentNames().join(", ")}`,
        inputRequired: false,
        artifacts: [],
      };
    }

    try {
      // Use a2a-ai-provider-v3 with full providerOptions support
      const result = await generateText({
        model: a2aV3(agent.url),
        prompt: task,
        // V3 Provider Options for context continuity
        providerOptions: {
          a2a: {
            contextId: options?.contextId,
            taskId: options?.taskId,
            metadata: options?.metadata ? toJSONObject(options.metadata) : undefined,
          },
        },
      });

      // Extract V3 provider metadata
      const a2aMetadata = result.providerMetadata?.a2a as A2aProviderMetadata | undefined;

      // Build rich result with all V3 metadata
      return {
        text: result.text,
        taskId: a2aMetadata?.taskId ?? undefined,
        contextId: a2aMetadata?.contextId ?? undefined,
        inputRequired: a2aMetadata?.inputRequired ?? false,
        taskState: a2aMetadata?.taskState ?? undefined,
        artifacts: extractArtifacts(a2aMetadata),
        metadata: a2aMetadata?.metadata ?? undefined,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        text: `Error communicating with ${agent.name}: ${errorMessage}`,
        inputRequired: false,
        artifacts: [],
        taskState: "failed",
      };
    }
  };
}

// ============================================================================
// HTTP Server (Hono + A2A)
// ============================================================================

async function main() {
  console.log(`
🎭 Travel Planner Orchestrator - Starting...

🔍 Discovering specialist agents (using a2a-ai-provider-v3)...
   - Weather Agent: ${WEATHER_AGENT_URL}
   - Airbnb Agent: ${AIRBNB_AGENT_URL}
`);

  // Discover agents using V3 provider's discovery helpers
  const registry = new AgentRegistry();

  await Promise.all([
    registry.discover(WEATHER_AGENT_URL, {
      name: "Weather Agent",
      description: "Provides weather forecasts for any location worldwide",
    }),
    registry.discover(AIRBNB_AGENT_URL, {
      name: "Airbnb Agent",
      description: "Searches for Airbnb accommodations",
    }),
  ]);

  console.log(`
✅ Discovered ${registry.getAllAgents().length} agents with capabilities`);

  // Track active agent state
  let activeAgent: string | null = null;

  // Track agent contexts for conversation continuity (V3 feature)
  const agentContexts = new Map<string, AgentContext>();

  // Create the planner agent with V3-enhanced sendMessage
  const plannerAgent = createPlannerAgent({
    model: getModel(),
    agentRoster: registry.buildAgentRoster(),
    activeAgent,
    availableAgents: registry.getAgentNames(),
    sendMessage: createHttpSendMessage(registry),
    onActiveAgentChange: (name) => {
      activeAgent = name;
      console.log(`📌 Active agent: ${name}`);
    },
    // V3 context tracking
    agentContexts,
    onAgentContextUpdate: (name, context) => {
      console.log(
        `🔄 Context updated for ${name}: taskId=${context.taskId}, contextId=${context.contextId}, inputRequired=${context.inputRequired}`
      );
    },
  });

  // Create A2A adapter
  const agentExecutor: AgentExecutor = new A2AAdapter(plannerAgent, {
    mode: "stream",
    workingMessage: "Planning your trip...",
  });

  // Use shared Agent Card from card.ts
  const agentCard = createTravelPlannerCard(BASE_URL);

  const taskStore: TaskStore = new InMemoryTaskStore();
  const requestHandler = new DefaultRequestHandler(agentCard, taskStore, agentExecutor);

  const app = new Hono();
  const appBuilder = new A2AHonoApp(requestHandler);
  appBuilder.setupRoutes(app);

  console.log(`
📍 Port: ${PORT}
🌐 URL: ${BASE_URL}
📋 Agent Card: ${BASE_URL}/.well-known/agent-card.json

🤖 Agent: Travel Planner (Orchestrator)
🔧 Framework: AI SDK v6 (ToolLoopAgent) + a2a-ai-provider-v3 + A2A Protocol
🧠 Model: ${process.env.AI_PROVIDER || "openai"} / ${process.env.AI_MODEL || "default"}
🌊 Streaming: ENABLED

✨ V3 Provider Capabilities:
   - Agent discovery with capability checking
   - Context continuity (contextId/taskId)
   - Input-required state handling
   - Artifact extraction from sub-agents
   - Rich task state metadata

📝 Try it:
   curl -X POST ${BASE_URL}/ \\
     -H "Content-Type: application/json" \\
     -d '{
       "jsonrpc": "2.0",
       "method": "message/send",
       "id": "1",
       "params": {
         "message": {
           "role": "user",
           "messageId": "msg-1",
           "parts": [{"kind": "text", "text": "Plan a trip to Los Angeles"}]
         }
       }
     }'

💡 Examples:
   - "What's the weather in Paris?"
   - "Find accommodations in Tokyo for 3 people"
   - "Plan a trip to New York, June 20-25, 2 adults"

⚠️  Prerequisites:
   Make sure the specialist agents are running:
   1. Weather Agent: ${WEATHER_AGENT_URL}
   2. Airbnb Agent: ${AIRBNB_AGENT_URL}

🚀 Ready to orchestrate travel planning...
`);

  serve({
    fetch: app.fetch,
    port: PORT,
    hostname: HOST,
  });
}

main().catch(console.error);
