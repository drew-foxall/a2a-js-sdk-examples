/**
 * Travel Planner Agent - Multi-Agent Orchestrator
 *
 * This agent coordinates specialist agents using the Python airbnb_planner_multiagent pattern:
 * - Dynamic agent discovery via Agent Card fetching
 * - Single sendMessage tool for routing to any agent
 * - Active agent state tracking for follow-ups
 * - Agent roster injection into prompt
 *
 * KEY PATTERN: Communication is injected via SendMessageFn, making this platform-agnostic.
 * - Local server: Uses a2a-ai-provider (HTTP)
 * - Cloudflare Worker: Uses Service Bindings or HTTP fallback
 */

import { type LanguageModel, ToolLoopAgent } from "ai";
import { z } from "zod";
import { getTravelPlannerPrompt } from "./prompt.js";

// ============================================================================
// Types - Communication Abstraction
// ============================================================================

/**
 * Options for sendMessage (matches Python's taskId/contextId support)
 */
export interface SendMessageOptions {
  /** Task ID for conversation continuity */
  taskId?: string;
  /** Context ID for session tracking */
  contextId?: string;
}

/**
 * Function type for sending messages to other agents
 *
 * This abstraction allows the agent to work in any environment:
 * - Local: HTTP via a2a-ai-provider
 * - Cloudflare: Service Bindings
 * - AWS: Lambda invoke
 * - etc.
 */
export type SendMessageFn = (
  agentName: string,
  task: string,
  options?: SendMessageOptions
) => Promise<string>;

/**
 * Configuration for the Travel Planner agent
 */
export interface PlannerAgentConfig {
  /** Language model to use */
  model: LanguageModel;

  /** Agent roster in JSON-lines format (from discovery) */
  agentRoster: string;

  /** Currently active agent (for follow-up routing) */
  activeAgent: string | null;

  /** List of available agent names (for tool description) */
  availableAgents: string[];

  /** Injected function to send messages to other agents */
  sendMessage: SendMessageFn;

  /** Callback when active agent changes (for state tracking) */
  onActiveAgentChange?: (agentName: string) => void;
}

// ============================================================================
// Tool Schema
// ============================================================================

/**
 * Schema for the sendMessage tool
 */
const sendMessageSchema = z.object({
  agentName: z
    .string()
    .describe("The exact name of the agent to send the message to (from the Agent Roster)"),
  task: z
    .string()
    .describe(
      "The comprehensive task description including all relevant context for the specialist agent"
    ),
});

type SendMessageParams = z.infer<typeof sendMessageSchema>;

// ============================================================================
// Agent Creation
// ============================================================================

/**
 * Create a Travel Planner agent with dynamic routing
 *
 * This matches the Python airbnb_planner_multiagent pattern:
 * - Uses single sendMessage tool for all routing
 * - Tracks active agent for follow-ups
 * - Agent roster injected into prompt
 *
 * Communication is handled by the injected sendMessage function,
 * making this agent platform-agnostic.
 *
 * @param config - Agent configuration with injected sendMessage function
 * @returns A configured ToolLoopAgent
 */
export function createPlannerAgent(config: PlannerAgentConfig) {
  const { model, agentRoster, activeAgent, availableAgents, sendMessage, onActiveAgentChange } =
    config;

  // Build prompt with discovered agent roster
  const instructions = getTravelPlannerPrompt({
    agentRoster,
    activeAgent,
  });

  return new ToolLoopAgent({
    model,
    instructions,
    tools: {
      /**
       * Send a message to a specialist agent
       *
       * This is the single dynamic routing tool that replaces
       * individual getWeatherForecast/searchAccommodations tools.
       *
       * The actual communication is handled by the injected sendMessage function.
       */
      sendMessage: {
        description: `Send a task to a specialist agent by name. Available agents: ${availableAgents.join(", ")}`,
        inputSchema: sendMessageSchema,
        execute: async (params: SendMessageParams) => {
          const { agentName, task } = params;

          // Validate agent exists
          if (!availableAgents.includes(agentName)) {
            return `Error: Agent "${agentName}" not found. Available agents: ${availableAgents.join(", ")}`;
          }

          // Update active agent state (for follow-up routing)
          onActiveAgentChange?.(agentName);

          // Call the agent via injected function
          // This is where platform-specific logic is abstracted away
          return await sendMessage(agentName, task);
        },
      },
    },
  });
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export type { PlannerPromptConfig } from "./prompt.js";
export { getTravelPlannerPrompt } from "./prompt.js";
