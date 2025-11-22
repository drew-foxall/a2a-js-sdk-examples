/**
 * Content Editor Agent Export (No Server)
 *
 * This file exports just the agent for use in tests, CLI, etc.
 * Import this instead of index.ts to avoid starting the server.
 */

import { type LanguageModel, ToolLoopAgent } from "ai";
import { getModel } from "../../shared/utils";
import { CONTENT_EDITOR_PROMPT } from "./prompt";

/**
 * Create Content Editor Agent with custom model
 *
 * Use this factory function when you need:
 * - Providers not supported by getModel() (Together AI, Replicate, etc.)
 * - Custom model configurations (temperature, top_p, etc.)
 * - Azure OpenAI with specific settings
 * - Local or self-hosted models
 * - Runtime model selection
 *
 * This agent can be used anywhere:
 * - Via A2A protocol (using A2AAdapter)
 * - Via CLI tools
 * - Via REST API
 * - Via MCP protocol
 * - In automated tests
 *
 * @param model - Any AI SDK LanguageModelV1 instance
 * @returns Configured ToolLoopAgent
 *
 * @example
 * // Use Groq
 * import { createOpenAI } from '@ai-sdk/openai';
 * const groq = createOpenAI({
 *   baseURL: 'https://api.groq.com/openai/v1',
 *   apiKey: process.env.GROQ_API_KEY,
 * });
 * const agent = createContentEditorAgent(groq('llama-3.1-70b-versatile'));
 *
 * @example
 * // Use Ollama (local)
 * import { createOpenAI } from '@ai-sdk/openai';
 * const ollama = createOpenAI({
 *   baseURL: 'http://localhost:11434/v1',
 *   apiKey: 'ollama',
 * });
 * const agent = createContentEditorAgent(ollama('llama3.2'));
 *
 * @example
 * // Use Azure with custom config
 * import { createAzure } from '@ai-sdk/azure';
 * const azure = createAzure({
 *   apiKey: process.env.AZURE_OPENAI_API_KEY,
 *   resourceName: 'my-resource',
 * });
 * const agent = createContentEditorAgent(azure('gpt-4'));
 */
export function createContentEditorAgent(model: LanguageModel) {
  return new ToolLoopAgent({
    model,
    instructions: CONTENT_EDITOR_PROMPT,
    tools: {}, // No tools needed - this is a simple editing agent
  });
}

/**
 * Default Content Editor Agent
 *
 * Uses model from environment variables:
 * - AI_PROVIDER: openai|anthropic|google|azure|cohere|mistral|groq|ollama
 * - AI_MODEL: Specific model name (optional, uses defaults)
 *
 * For custom providers or configurations, use createContentEditorAgent()
 *
 * No A2A-specific code here - pure AI SDK!
 */
export const contentEditorAgent = createContentEditorAgent(getModel());
