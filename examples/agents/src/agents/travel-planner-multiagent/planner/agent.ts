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
 * - Local server: Uses a2a-ai-provider-v3 (HTTP)
 * - Cloudflare Worker: Uses Service Bindings or HTTP fallback
 *
 * V3 CAPABILITIES LEVERAGED:
 * - Context continuity via contextId/taskId
 * - Input-required state detection and handling
 * - Artifact extraction from sub-agent responses
 * - Rich metadata exposure
 */

import { type LanguageModel, ToolLoopAgent } from "ai";
import { z } from "zod";
import { getTravelPlannerPrompt } from "./prompt.js";

// ============================================================================
// Types - Communication Abstraction (V3 Enhanced)
// ============================================================================

/**
 * Options for sendMessage - supports V3 provider capabilities
 */
export interface SendMessageOptions {
  /** Task ID for resuming an existing task (input-required flows) */
  taskId?: string;
  /** Context ID for multi-turn conversation continuity */
  contextId?: string;
  /** Custom metadata to attach to the message */
  metadata?: Record<string, unknown>;
}

/**
 * Serialized artifact part from sub-agent response
 */
export interface AgentArtifactPart {
  kind: "text" | "file" | "data";
  text?: string;
  data?: Record<string, unknown>;
  file?: {
    name?: string;
    mimeType?: string;
    bytes?: string;
    uri?: string;
  };
}

/**
 * Serialized artifact from sub-agent response
 */
export interface AgentArtifact {
  artifactId: string;
  name?: string;
  description?: string;
  parts: AgentArtifactPart[];
}

/**
 * Rich result from sub-agent call - leverages V3 provider metadata
 */
export interface SendMessageResult {
  /** The text response from the agent */
  text: string;

  /** Task ID for follow-up messages (if task-based response) */
  taskId?: string;

  /** Context ID for conversation continuity */
  contextId?: string;

  /** Whether the agent requires more user input to complete */
  inputRequired: boolean;

  /** Current task state (completed, input-required, failed, etc.) */
  taskState?: string;

  /** Artifacts produced by the agent */
  artifacts: AgentArtifact[];

  /** Agent-level metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Function type for sending messages to other agents
 *
 * Returns rich result with V3 metadata for:
 * - Context continuity (taskId, contextId)
 * - Input-required detection
 * - Artifact access
 */
export type SendMessageFn = (
  agentName: string,
  task: string,
  options?: SendMessageOptions
) => Promise<SendMessageResult>;

/**
 * Agent context tracking - maintains conversation state with each sub-agent
 */
export interface AgentContext {
  /** Last task ID from this agent */
  taskId?: string;
  /** Context ID for ongoing conversation */
  contextId?: string;
  /** Whether agent is waiting for more input */
  inputRequired: boolean;
}

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

  /** Agent context map for conversation continuity (optional) */
  agentContexts?: Map<string, AgentContext>;

  /** Callback when agent context updates (for state persistence) */
  onAgentContextUpdate?: (agentName: string, context: AgentContext) => void;
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
  continueConversation: z
    .boolean()
    .optional()
    .describe(
      "Set to true to continue a previous conversation with this agent using the stored context"
    ),
});

type SendMessageParams = z.infer<typeof sendMessageSchema>;

// ============================================================================
// Agent Creation
// ============================================================================

/**
 * Create a Travel Planner agent with dynamic routing
 *
 * This matches the Python airbnb_planner_multiagent pattern with V3 enhancements:
 * - Uses single sendMessage tool for all routing
 * - Tracks active agent for follow-ups
 * - Agent roster injected into prompt
 * - Context continuity via contextId/taskId
 * - Input-required state handling
 * - Artifact extraction
 *
 * Communication is handled by the injected sendMessage function,
 * making this agent platform-agnostic.
 *
 * @param config - Agent configuration with injected sendMessage function
 * @returns A configured ToolLoopAgent
 */
export function createPlannerAgent(config: PlannerAgentConfig) {
  const {
    model,
    agentRoster,
    activeAgent,
    availableAgents,
    sendMessage,
    onActiveAgentChange,
    agentContexts = new Map(),
    onAgentContextUpdate,
  } = config;

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
       * V3 ENHANCEMENTS:
       * - Uses contextId for conversation continuity
       * - Handles input-required state
       * - Extracts and reports artifacts
       * - Surfaces rich metadata
       *
       * The actual communication is handled by the injected sendMessage function.
       */
      sendMessage: {
        description: `Send a task to a specialist agent by name. Available agents: ${availableAgents.join(", ")}. Set continueConversation=true to continue a previous conversation.`,
        inputSchema: sendMessageSchema,
        execute: async (params: SendMessageParams) => {
          const { agentName, task, continueConversation } = params;

          // Validate agent exists
          if (!availableAgents.includes(agentName)) {
            return `Error: Agent "${agentName}" not found. Available agents: ${availableAgents.join(", ")}`;
          }

          // Update active agent state (for follow-up routing)
          onActiveAgentChange?.(agentName);

          // Get existing context for conversation continuity
          const existingContext = agentContexts.get(agentName);
          const options: SendMessageOptions = {};

          // Use existing context if continuing conversation or if agent is waiting for input
          if (continueConversation || existingContext?.inputRequired) {
            if (existingContext?.contextId) {
              options.contextId = existingContext.contextId;
            }
            if (existingContext?.taskId && existingContext.inputRequired) {
              options.taskId = existingContext.taskId;
            }
          }

          // Call the agent via injected function
          const result = await sendMessage(agentName, task, options);

          // Update context with response metadata
          const newContext: AgentContext = {
            taskId: result.taskId,
            contextId: result.contextId,
            inputRequired: result.inputRequired,
          };
          agentContexts.set(agentName, newContext);
          onAgentContextUpdate?.(agentName, newContext);

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
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export type { PlannerPromptConfig } from "./prompt.js";
export { getTravelPlannerPrompt } from "./prompt.js";
