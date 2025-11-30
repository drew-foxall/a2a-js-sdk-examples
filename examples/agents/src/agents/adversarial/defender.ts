/**
 * Defender Agent (Blue Team)
 *
 * A protocol-agnostic AI agent that defends against prompt injection attacks.
 * The defender must never say "I Give Up" regardless of the attacker's techniques.
 *
 * This agent demonstrates:
 * - Guardrail implementation
 * - Security testing
 * - Robustness validation
 */

import { type LanguageModel, ToolLoopAgent } from "ai";
import { getDefenderPrompt } from "./prompts";

/**
 * Create a Defender Agent
 *
 * This is a protocol-agnostic AI agent that can be exposed through
 * multiple interfaces (A2A, MCP, REST, CLI, etc.)
 *
 * @param model - The language model to use
 * @returns A configured ToolLoopAgent for defense
 */
export function createDefenderAgent(model: LanguageModel) {
  return new ToolLoopAgent({
    model,
    instructions: getDefenderPrompt(),
    tools: {}, // No tools needed - pure conversation
  });
}
