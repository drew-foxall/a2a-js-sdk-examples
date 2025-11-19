/**
 * Hello World Agent
 *
 * The simplest possible A2A agent implementation.
 * Demonstrates:
 * - Basic AI SDK ToolLoopAgent usage
 * - Protocol-agnostic agent design
 * - No tools (pure text generation)
 * - Foundation pattern for all agents
 *
 * This agent responds to greetings with friendly hello messages.
 * It serves as the baseline example for the AI SDK + A2A architecture.
 */

import { ToolLoopAgent, type LanguageModel } from "ai";
import { getHelloWorldPrompt } from "./prompt.js";

/**
 * Create a Hello World Agent
 *
 * This is a protocol-agnostic AI agent that can be exposed through
 * multiple interfaces (A2A, MCP, REST, CLI, etc.)
 *
 * @param model - The language model to use (from getModel() utility)
 * @returns A configured ToolLoopAgent with no tools
 */
export function createHelloWorldAgent(model: LanguageModel) {
  return new ToolLoopAgent({
    model,
    instructions: getHelloWorldPrompt(),
    // No tools - this is the simplest possible agent
    tools: {},
  });
}

