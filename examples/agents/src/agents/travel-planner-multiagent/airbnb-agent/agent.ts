/**
 * Airbnb Agent
 *
 * A specialist agent for Airbnb accommodation search using MCP tools.
 * Part of the Travel Planner Multi-Agent System.
 */

import { type LanguageModel, ToolLoopAgent } from "ai";
import type { getAirbnbMCPTools } from "./mcp-client.js";
import { getAirbnbAgentPrompt } from "./prompt.js";

/**
 * Create an Airbnb Agent with MCP Tools
 *
 * This specialist agent searches for Airbnb accommodations using REAL MCP tools.
 * It can be:
 * 1. Used standalone as an A2A agent
 * 2. Consumed by an orchestrator agent via a2a-ai-provider
 *
 * @param model - The language model to use
 * @param mcpTools - Tools from the MCP server (@openbnb/mcp-server-airbnb)
 * @returns A configured ToolLoopAgent
 */
export function createAirbnbAgent(
  model: LanguageModel,
  mcpTools: Awaited<ReturnType<typeof getAirbnbMCPTools>>
) {
  return new ToolLoopAgent({
    model,
    instructions: getAirbnbAgentPrompt(),
    tools: mcpTools, // Use real MCP tools instead of mock
  });
}
