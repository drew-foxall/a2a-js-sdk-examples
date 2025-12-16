/**
 * Travel Planner - Durable Workflow
 *
 * A workflow version of the travel planner orchestrator that provides:
 * - Automatic retry on sub-agent failures
 * - Result caching across workflow restarts
 * - Observability via Workflow DevKit traces
 *
 * This workflow uses the DurableAgent from @drew-foxall/workflow-ai
 * which provides streaming support and proper AI SDK 6 integration.
 *
 * Particularly valuable for travel planning because:
 * - Multi-agent coordination involves multiple external calls
 * - Each sub-agent call (weather, accommodation) can fail transiently
 * - Complex plans shouldn't restart from scratch on failure
 *
 * Usage:
 *   import { travelPlannerWorkflow } from "a2a-agents/travel-planner-multiagent/planner/workflow";
 *   import { start } from "workflow/api";
 *
 *   const run = await start(travelPlannerWorkflow, [messages, agentUrls]);
 */

import { DurableAgent } from "@drew-foxall/workflow-ai/agent";
import type { ModelMessage, UIMessageChunk } from "ai";
import { getWritable } from "workflow";
import { z } from "zod";
import type { SendMessageOptions, SendMessageResult, AgentContext } from "./agent.js";
import { getTravelPlannerPrompt } from "./prompt.js";
import { callSubAgent, discoverSubAgent } from "./steps.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Agent registry entry for discovered agents
 */
interface DiscoveredAgent {
  name: string;
  description: string;
  url: string;
  supportsStreaming: boolean;
}

/**
 * Configuration for the workflow
 */
export interface TravelPlannerWorkflowConfig {
  /** URLs of sub-agents to discover and coordinate */
  agentUrls: string[];
  /** Fallback agent info if discovery fails */
  fallbacks?: Record<string, { name: string; description: string }>;
}

// ============================================================================
// Tool Schemas
// ============================================================================

const sendMessageSchema = z.object({
  agentName: z
    .string()
    .describe("The exact name of the agent to send the message to (from the Agent Roster)"),
  task: z
    .string()
    .describe(
      "The comprehensive task description including all relevant context for the specialist agent"
    ),
  continueConversation: z
    .boolean()
    .optional()
    .describe(
      "Set to true to continue a previous conversation with this agent using the stored context"
    ),
});

// ============================================================================
// Workflow
// ============================================================================

/**
 * Durable Travel Planner Workflow
 *
 * This workflow wraps the travel planner orchestration with Workflow DevKit durability.
 * Sub-agent calls are durable steps that will be cached and retried as needed.
 *
 * The workflow:
 * 1. Discovers all sub-agents (durable step per agent)
 * 2. Builds agent roster from discovery results
 * 3. Runs the DurableAgent with sendMessage tool
 * 4. Each sendMessage call is a durable step
 *
 * @param messages - The conversation messages to process
 * @param config - Configuration including agent URLs
 * @returns The updated messages array after agent processing
 */
export async function travelPlannerWorkflow(
  messages: ModelMessage[],
  config: TravelPlannerWorkflowConfig
): Promise<{ messages: ModelMessage[] }> {
  "use workflow";

  const writable = getWritable<UIMessageChunk>();
  const { agentUrls, fallbacks = {} } = config;

  // Phase 1: Discover all sub-agents (each discovery is a durable step)
  const discoveredAgents = new Map<string, DiscoveredAgent>();
  const agentsByUrl = new Map<string, DiscoveredAgent>();
  const agentContexts = new Map<string, AgentContext>();

  for (const url of agentUrls) {
    const result = await discoverSubAgent(url);

    if (result.success && result.name) {
      const agent: DiscoveredAgent = {
        name: result.name,
        description: result.description ?? `Agent at ${url}`,
        url: result.url ?? url,
        supportsStreaming: result.supportsStreaming ?? false,
      };
      discoveredAgents.set(result.name, agent);
      agentsByUrl.set(url, agent);
    } else {
      // Use fallback if available
      const fallback = fallbacks[url];
      if (fallback) {
        const agent: DiscoveredAgent = {
          name: fallback.name,
          description: fallback.description,
          url,
          supportsStreaming: false,
        };
        discoveredAgents.set(fallback.name, agent);
        agentsByUrl.set(url, agent);
      }
    }
  }

  // Phase 2: Build agent roster for prompt injection
  const agentRoster = Array.from(discoveredAgents.values())
    .map(
      (agent) =>
        `{"name": "${agent.name}", "description": "${agent.description}", "streaming": ${agent.supportsStreaming}}`
    )
    .join("\n");

  const availableAgents = Array.from(discoveredAgents.keys());

  // Track active agent for follow-ups
  let activeAgent: string | null = null;

  // Phase 3: Create DurableAgent with sendMessage tool
  const agent = new DurableAgent({
    model: "openai/gpt-4o-mini",
    system: getTravelPlannerPrompt({
      agentRoster,
      activeAgent,
    }),
    tools: {
      sendMessage: {
        description: `Send a task to a specialist agent by name. Available agents: ${availableAgents.join(", ")}. Set continueConversation=true to continue a previous conversation.`,
        inputSchema: sendMessageSchema,
        execute: async (params: z.infer<typeof sendMessageSchema>): Promise<string> => {
          const { agentName, task, continueConversation } = params;

          // Validate agent exists
          const targetAgent = discoveredAgents.get(agentName);
          if (!targetAgent) {
            return `Error: Agent "${agentName}" not found. Available agents: ${availableAgents.join(", ")}`;
          }

          // Update active agent state
          activeAgent = agentName;

          // Get existing context for conversation continuity
          const existingContext = agentContexts.get(agentName);
          const options: SendMessageOptions = {};

          // Use existing context if continuing conversation
          if (continueConversation || existingContext?.inputRequired) {
            if (existingContext?.contextId) {
              options.contextId = existingContext.contextId;
            }
            if (existingContext?.taskId && existingContext.inputRequired) {
              options.taskId = existingContext.taskId;
            }
          }

          // Call sub-agent via durable step
          const result: SendMessageResult = await callSubAgent(targetAgent.url, task, options);

          // Update context with response metadata
          agentContexts.set(agentName, {
            taskId: result.taskId,
            contextId: result.contextId,
            inputRequired: result.inputRequired,
          });

          // Build response with rich information
          let response = result.text;

          // Handle input-required state
          if (result.inputRequired) {
            response += `\n\n[Agent "${agentName}" needs more information to complete the task. Send a follow-up message with continueConversation=true to provide the requested details.]`;
          }

          // Include artifact summary if present
          if (result.artifacts.length > 0) {
            const artifactList = result.artifacts
              .map((a) => `- ${a.name || a.artifactId}${a.description ? `: ${a.description}` : ""}`)
              .join("\n");
            response += `\n\n[Artifacts received from ${agentName}:]\n${artifactList}`;
          }

          // Include task state if not completed
          if (result.taskState && result.taskState !== "completed") {
            response += `\n\n[Task state: ${result.taskState}]`;
          }

          return response;
        },
      },
    },
  });

  return agent.stream({
    messages,
    writable,
  });
}

/**
 * Export types for workflow consumers
 */
export type TravelPlannerWorkflowParams = Parameters<typeof travelPlannerWorkflow>;
export type TravelPlannerWorkflowResult = Awaited<ReturnType<typeof travelPlannerWorkflow>>;

