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
 * The streaming function can be used directly or via A2AStreamingAdapter.
 */

import { ToolLoopAgent, streamText } from 'ai';
import { getModel } from '../../shared/utils.js';
import { CODER_SYSTEM_PROMPT } from './code-format.js';

/**
 * Coder Agent - AI SDK v6 ToolLoopAgent
 * 
 * This agent is protocol-agnostic and can be used in:
 * - A2A protocol (via A2AStreamingAdapter in index.ts)
 * - CLI tools (direct streaming)
 * - REST APIs (future)
 * - MCP servers (future)
 * - Automated tests (no mocking)
 * 
 * No tools are needed for this agent - it's pure code generation.
 */
export const coderAgent = new ToolLoopAgent({
  model: getModel(),
  instructions: CODER_SYSTEM_PROMPT,
  tools: {}, // No tools - pure code generation
});

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

