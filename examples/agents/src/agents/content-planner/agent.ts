/**
 * Content Planner Agent
 *
 * A protocol-agnostic AI agent that creates detailed content outlines.
 *
 * Features:
 * - Structured outline generation
 * - Audience-aware planning
 * - SEO considerations
 * - Section-by-section breakdown
 *
 * This agent can:
 * - Create blog post outlines
 * - Plan article structures
 * - Design tutorial frameworks
 * - Outline documentation
 */

import { type LanguageModel, ToolLoopAgent } from "ai";
import { getContentPlannerPrompt } from "./prompt";

/**
 * Create a Content Planner Agent
 *
 * This is a protocol-agnostic AI agent that can be exposed through
 * multiple interfaces (A2A, MCP, REST, CLI, etc.)
 *
 * @param model - The language model to use (from getModel() utility)
 * @returns A configured ToolLoopAgent for content planning
 */
export function createContentPlannerAgent(model: LanguageModel) {
  return new ToolLoopAgent({
    model,
    instructions: getContentPlannerPrompt(),
    // No tools - pure text generation for outlines
    tools: {},
  });
}
