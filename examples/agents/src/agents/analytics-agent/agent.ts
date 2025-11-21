/**
 * Analytics Agent
 *
 * A protocol-agnostic AI agent demonstrating chart generation and image artifacts.
 *
 * Features:
 * - Chart generation from natural language
 * - Data parsing (multiple formats)
 * - Image artifact creation (PNG)
 * - Streaming artifact emission
 *
 * This agent can:
 * - Parse data from natural language prompts
 * - Generate bar charts
 * - Return charts as image artifacts
 */

import { type LanguageModel, ToolLoopAgent } from "ai";
import { getAnalyticsAgentPrompt } from "./prompt.js";

/**
 * Create an Analytics Agent
 *
 * This is a protocol-agnostic AI agent that can be exposed through
 * multiple interfaces (A2A, MCP, REST, CLI, etc.)
 *
 * Note: This agent has no tools. It generates text responses that
 * describe the chart to be created. The actual chart generation
 * happens in the adapter layer via parseArtifacts.
 *
 * @param model - The language model to use (from getModel() utility)
 * @returns A configured ToolLoopAgent
 */
export function createAnalyticsAgent(model: LanguageModel) {
  return new ToolLoopAgent({
    model,
    instructions: getAnalyticsAgentPrompt(),
    // No tools - chart generation happens in adapter layer
    tools: {},
  });
}
