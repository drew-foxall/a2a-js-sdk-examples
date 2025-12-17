/**
 * Agent Card Builder
 *
 * Provides utilities for building A2A Agent Cards with sensible defaults.
 * Reduces boilerplate while maintaining full flexibility for customization.
 *
 * @example Basic Usage
 * ```typescript
 * const card = buildAgentCard(baseUrl, {
 *   name: "Hello World Agent",
 *   description: "A simple greeting agent",
 *   skills: [helloWorldSkill],
 * });
 * ```
 *
 * @example With Custom Capabilities
 * ```typescript
 * const card = buildAgentCard(baseUrl, {
 *   name: "Streaming Agent",
 *   description: "An agent with state history",
 *   skills: [mySkill],
 *   capabilities: {
 *     stateTransitionHistory: true,
 *   },
 * });
 * ```
 */

import type { AgentCard, AgentSkill } from "@drew-foxall/a2a-js-sdk";

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default agent card configuration values
 *
 * These defaults represent the most common configuration across all agents:
 * - Protocol version 0.3.0 (current A2A spec)
 * - JSONRPC transport (most compatible)
 * - Text input/output modes
 * - Streaming enabled, push notifications disabled
 */
export const DEFAULT_AGENT_CARD_CONFIG = {
  protocolVersion: "0.3.0",
  version: "1.0.0",
  preferredTransport: "JSONRPC" as const,
  defaultInputModes: ["text"] as string[],
  defaultOutputModes: ["text"] as string[],
  capabilities: {
    streaming: true,
    pushNotifications: false,
    stateTransitionHistory: false,
  },
} as const;

// ============================================================================
// Types
// ============================================================================

/**
 * Agent capabilities configuration
 */
export interface AgentCapabilities {
  /** Whether the agent supports SSE streaming responses */
  streaming?: boolean;
  /** Whether the agent supports push notifications */
  pushNotifications?: boolean;
  /** Whether the agent maintains state transition history */
  stateTransitionHistory?: boolean;
}

/**
 * Options for building an agent card
 */
export interface AgentCardOptions {
  /**
   * Agent name (required)
   * Should be human-readable and descriptive
   */
  name: string;

  /**
   * Agent description (required)
   * Explains what the agent does and its capabilities
   */
  description: string;

  /**
   * Agent skills (required)
   * List of capabilities the agent provides
   */
  skills: AgentSkill[];

  /**
   * Agent capabilities (optional)
   * Override default capabilities
   * @default { streaming: true, pushNotifications: false, stateTransitionHistory: false }
   */
  capabilities?: Partial<AgentCapabilities>;

  /**
   * Agent version (optional)
   * Semantic version of this agent
   * @default "1.0.0"
   */
  version?: string;

  /**
   * Protocol version (optional)
   * A2A protocol version supported
   * @default "0.3.0"
   */
  protocolVersion?: string;

  /**
   * Preferred transport (optional)
   * @default "JSONRPC"
   */
  preferredTransport?: "JSONRPC" | "HTTP";

  /**
   * Default input modes (optional)
   * @default ["text"]
   */
  defaultInputModes?: string[];

  /**
   * Default output modes (optional)
   * @default ["text"]
   */
  defaultOutputModes?: string[];

  /**
   * Security schemes (optional)
   * Authentication/authorization configuration per A2A spec Section 4.5
   */
  securitySchemes?: Record<string, unknown>;

  /**
   * Security requirements (optional)
   * Which security schemes are required for this agent
   */
  security?: Record<string, string[]>[];

  /**
   * Provider information (optional)
   */
  provider?: {
    name: string;
    url?: string;
  };
}

// ============================================================================
// Builder Functions
// ============================================================================

/**
 * Build an agent card with sensible defaults
 *
 * This function creates a complete AgentCard by merging provided options
 * with default values. Only the required fields (name, description, skills)
 * need to be specified.
 *
 * @param baseUrl - The base URL where the agent is hosted
 * @param options - Agent card configuration options
 * @returns Complete AgentCard ready for use
 *
 * @example
 * ```typescript
 * const card = buildAgentCard("https://my-agent.workers.dev", {
 *   name: "Currency Agent",
 *   description: "Converts currencies using real-time exchange rates",
 *   skills: [currencyConversionSkill],
 * });
 * ```
 */
export function buildAgentCard(baseUrl: string, options: AgentCardOptions): AgentCard {
  return {
    // URL is always from the parameter
    url: baseUrl,

    // Required fields from options
    name: options.name,
    description: options.description,
    skills: options.skills,

    // Version fields with defaults
    version: options.version ?? DEFAULT_AGENT_CARD_CONFIG.version,
    protocolVersion: options.protocolVersion ?? DEFAULT_AGENT_CARD_CONFIG.protocolVersion,

    // Transport configuration
    preferredTransport: options.preferredTransport ?? DEFAULT_AGENT_CARD_CONFIG.preferredTransport,

    // Input/output modes
    defaultInputModes: options.defaultInputModes ?? DEFAULT_AGENT_CARD_CONFIG.defaultInputModes,
    defaultOutputModes: options.defaultOutputModes ?? DEFAULT_AGENT_CARD_CONFIG.defaultOutputModes,

    // Capabilities with merged defaults
    capabilities: {
      ...DEFAULT_AGENT_CARD_CONFIG.capabilities,
      ...options.capabilities,
    },

    // Optional fields (only included if provided)
    ...(options.securitySchemes && { securitySchemes: options.securitySchemes }),
    ...(options.security && { security: options.security }),
    ...(options.provider && { provider: options.provider }),
  } as AgentCard;
}

/**
 * Create an agent skill definition
 *
 * Helper function for creating properly typed AgentSkill objects.
 *
 * @param skill - Skill configuration
 * @returns Typed AgentSkill object
 *
 * @example
 * ```typescript
 * const rollDiceSkill = createSkill({
 *   id: "roll_dice",
 *   name: "Roll Dice",
 *   description: "Rolls an N-sided dice",
 *   tags: ["dice", "random", "game"],
 *   examples: ["Roll a d20", "Roll 2d6"],
 * });
 * ```
 */
export function createSkill(skill: AgentSkill): AgentSkill {
  return skill;
}

/**
 * Merge multiple skills into a single array
 *
 * Useful for agents that combine skills from multiple sources.
 *
 * @param skills - Arrays of skills to merge
 * @returns Combined skill array
 */
export function mergeSkills(...skills: AgentSkill[][]): AgentSkill[] {
  return skills.flat();
}

