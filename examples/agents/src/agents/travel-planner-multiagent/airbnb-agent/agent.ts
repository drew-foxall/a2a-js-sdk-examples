/**
 * Airbnb Agent
 *
 * A specialist agent for Airbnb accommodation search using MCP tools.
 * Part of the Travel Planner Multi-Agent System.
 */

import { type LanguageModel, ToolLoopAgent, type ToolSet } from "ai";
import type { getAirbnbMCPTools } from "./mcp-client";
import { getAirbnbAgentPrompt } from "./prompt";

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
  // NOTE: Type assertion required at AI SDK boundary.
  // MCP client tools are structurally compatible with ToolSet but TypeScript
  // cannot verify this due to AI SDK's complex generic constraints.
  // This is a documented limitation when combining MCP tools with ToolLoopAgent.
  // See: https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling
  const tools = mcpTools as ToolSet;

  return new ToolLoopAgent({
    model,
    instructions: getAirbnbAgentPrompt(),
    tools,
  });
}
