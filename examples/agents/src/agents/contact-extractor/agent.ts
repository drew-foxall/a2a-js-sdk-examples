/**
 * Contact Extractor Agent
 *
 * A protocol-agnostic AI agent that extracts structured contact information.
 *
 * Features:
 * - Structured data extraction
 * - Multi-turn conversation for missing fields
 * - Phone number standardization
 * - Email validation
 *
 * This agent can:
 * - Extract name, email, phone from text
 * - Ask clarifying questions for missing info
 * - Standardize phone numbers
 * - Handle optional fields (org, role)
 */

import { type LanguageModel, ToolLoopAgent } from "ai";
import { getContactExtractorPrompt } from "./prompt";

/**
 * Create a Contact Extractor Agent
 *
 * This is a protocol-agnostic AI agent that can be exposed through
 * multiple interfaces (A2A, MCP, REST, CLI, etc.)
 *
 * @param model - The language model to use (from getModel() utility)
 * @returns A configured ToolLoopAgent for contact extraction
 */
export function createContactExtractorAgent(model: LanguageModel) {
  return new ToolLoopAgent({
    model,
    instructions: getContactExtractorPrompt(),
    // No tools - pure text extraction using LLM capabilities
    tools: {},
  });
}
