/**
 * Coder Agent Export (No Server)
 * 
 * This file exports the agent for use in tests, CLI, etc.
 * Import this instead of index.ts to avoid starting the server.
 * 
 * PHASE 4 MIGRATION: Demonstrates AI SDK v6 + Streaming
 * -------------------------------------------------------
 * This agent showcases:
 * - ToolLoopAgent for consistency with other agents
 * - Streaming code generation with real-time output
 * - Protocol-agnostic design (works in CLI, tests, REST, MCP, A2A)
 * 
 * The streaming function can be used directly or via A2AAdapter.
 */

import { ToolLoopAgent, streamText, type LanguageModelV1 } from 'ai';
import { getModel } from '../../shared/utils.js';
import { CODER_SYSTEM_PROMPT } from './code-format.js';

/**
 * Create Coder Agent with custom model
 * 
 * Use this factory function when you need:
 * - Providers not supported by getModel() (Together AI, Replicate, etc.)
 * - Custom model configurations
 * - Models optimized for code generation (CodeLlama, Phind, etc.)
 * - Local or self-hosted models
 * - Runtime model selection
 * 
 * @param model - Any AI SDK LanguageModelV1 instance
 * @returns Configured ToolLoopAgent for code generation
 * 
 * @example
 * // Use Claude for excellent code quality
 * import { anthropic } from '@ai-sdk/anthropic';
 * const agent = createCoderAgent(anthropic('claude-3-5-sonnet-20241022'));
 * 
 * @example
 * // Use Groq for fast code generation
 * import { createOpenAI } from '@ai-sdk/openai';
 * const groq = createOpenAI({
 *   baseURL: 'https://api.groq.com/openai/v1',
 *   apiKey: process.env.GROQ_API_KEY,
 * });
 * const agent = createCoderAgent(groq('llama-3.1-70b-versatile'));
 * 
 * @example
 * // Use local CodeLlama via Ollama
 * import { createOpenAI } from '@ai-sdk/openai';
 * const ollama = createOpenAI({
 *   baseURL: 'http://localhost:11434/v1',
 *   apiKey: 'ollama',
 * });
 * const agent = createCoderAgent(ollama('codellama'));
 */
export function createCoderAgent(model: LanguageModelV1) {
  return new ToolLoopAgent({
    model,
    instructions: CODER_SYSTEM_PROMPT,
    tools: {}, // No tools - pure code generation
  });
}

/**
 * Default Coder Agent
 * 
 * Uses model from environment variables:
 * - AI_PROVIDER: openai|anthropic|google|azure|cohere|mistral|groq|ollama
 * - AI_MODEL: Specific model name (optional, uses defaults)
 * 
 * For custom providers or configurations, use createCoderAgent()
 * 
 * This agent is protocol-agnostic and can be used in:
 * - A2A protocol (via A2AAdapter in index.ts)
 * - CLI tools (direct streaming)
 * - REST APIs (future)
 * - MCP servers (future)
 * - Automated tests (no mocking)
 * 
 * No tools are needed for this agent - it's pure code generation.
 */
export const coderAgent = createCoderAgent(getModel());

/**
 * Stream code generation from the agent
 * 
 * This function provides a simple async generator interface for streaming.
 * It handles the difference between ToolLoopAgent's potential streaming
 * API and the fallback to streamText().
 * 
 * Usage:
 * ```typescript
 * for await (const chunk of streamCoderGeneration(coderAgent, messages)) {
 *   console.log(chunk);
 * }
 * ```
 * 
 * @param agent The ToolLoopAgent instance
 * @param messages Array of messages (user/assistant)
 * @returns AsyncGenerator yielding text chunks
 */
export async function* streamCoderGeneration(
  agent: ToolLoopAgent<any, any, any>,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): AsyncGenerator<string> {
  // Try ToolLoopAgent.stream() if available (AI SDK v6 may have this)
  if ('stream' in agent && typeof (agent as any).stream === 'function') {
    try {
      const result = await (agent as any).stream({ messages });
      
      // Check if result has textStream
      if (result && 'textStream' in result) {
        for await (const chunk of result.textStream) {
          yield chunk;
        }
        return;
      }
    } catch (error) {
      console.warn('[streamCoderGeneration] ToolLoopAgent.stream() failed, falling back to streamText()', error);
    }
  }

  // Fallback: Use streamText() directly
  // This is the proven approach from the current implementation
  const { textStream } = streamText({
    model: getModel(),
    system: CODER_SYSTEM_PROMPT,
    messages,
  });

  for await (const chunk of textStream) {
    yield chunk;
  }
}

/**
 * Generate code non-streaming (for testing/CLI)
 * 
 * Convenience function that collects all chunks into a single string.
 * Useful for tests or CLI tools that don't need streaming.
 * 
 * Usage:
 * ```typescript
 * const code = await generateCode(coderAgent, messages);
 * console.log(code);
 * ```
 */
export async function generateCode(
  agent: ToolLoopAgent<any, any, any>,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  let result = '';
  for await (const chunk of streamCoderGeneration(agent, messages)) {
    result += chunk;
  }
  return result;
}

