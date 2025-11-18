/**
 * Movie Agent Export (No Server)
 * 
 * This file exports just the agent for use in tests, CLI, etc.
 * Import this instead of index.ts to avoid starting the server.
 * 
 * PHASE 3 MIGRATION: Demonstrates AI SDK v6 advanced features
 * -----------------------------------------------------------
 * This agent showcases:
 * - callOptionsSchema: Dynamic configuration per request (contextId, goal)
 * - prepareCall: Custom prompt generation based on goal metadata
 * - Tools: TMDB API integration (searchMovies, searchPeople)
 * - Tool loop: maxSteps for multi-turn tool calling
 */

import { ToolLoopAgent, tool } from "ai";
import { z } from "zod";
import { getModel } from "../../shared/utils.js";
import { searchMovies, searchPeople } from "./tmdb.js";
import { getMovieAgentPrompt } from "./prompt.js";

/**
 * TMDB Tools - Using AI SDK v6 tool() helper
 */
const searchMoviesTool = tool({
  description: "search TMDB for movies by title",
  parameters: z.object({
    query: z.string().describe("The movie title to search for"),
  }),
  execute: async ({ query }) => {
    return await searchMovies(query);
  },
});

const searchPeopleTool = tool({
  description: "search TMDB for people by name",
  parameters: z.object({
    query: z.string().describe("The person name to search for"),
  }),
  execute: async ({ query }) => {
    return await searchPeople(query);
  },
});

/**
 * Movie Agent - AI SDK v6 ToolLoopAgent with Call Options
 * 
 * This agent demonstrates advanced AI SDK v6 features:
 * 
 * 1. **callOptionsSchema**: Accepts dynamic options per request
 *    - contextId: For conversation history tracking
 *    - goal: Optional task goal for prompt customization
 * 
 * 2. **prepareCall**: Dynamically generates system prompt
 *    - Includes goal in prompt if provided
 *    - Can be customized per request
 * 
 * 3. **Tools**: TMDB API integration
 *    - searchMovies: Find movies by title
 *    - searchPeople: Find people by name
 * 
 * 4. **Tool Loop**: maxSteps for multi-turn tool calls
 * 
 * Usage:
 * ```typescript
 * // With goal
 * const result = await movieAgent.generate({
 *   messages: [{ role: 'user', content: 'Tell me about Inception' }],
 *   contextId: 'conv-123',
 *   goal: 'Help user find sci-fi movies',
 * });
 * 
 * // Without goal
 * const result = await movieAgent.generate({
 *   messages: [{ role: 'user', content: 'Who directed The Matrix?' }],
 *   contextId: 'conv-456',
 * });
 * ```
 * 
 * This agent can be used in:
 * - A2A protocol (via A2AAgentAdapter in index.ts)
 * - CLI tools (direct usage)
 * - REST APIs (future)
 * - MCP servers (future)
 * - Automated tests (no mocking)
 */
export const movieAgent = new ToolLoopAgent({
  model: getModel(),
  
  // Default instructions (overridden by prepareCall)
  instructions: getMovieAgentPrompt(),
  
  // Tools for TMDB integration
  tools: {
    searchMovies: searchMoviesTool,
    searchPeople: searchPeopleTool,
  },
  
  // Allow multiple tool calls
  maxSteps: 10,
  
  // ============================================================================
  // AI SDK v6 Advanced Feature: Call Options
  // ============================================================================
  
  /**
   * callOptionsSchema: Define what options can be passed per request
   * 
   * This allows callers to pass dynamic configuration:
   * - contextId: For conversation history (used by adapter)
   * - goal: Optional task goal for prompt customization
   */
  callOptionsSchema: z.object({
    contextId: z.string().describe("Conversation context ID for history tracking"),
    goal: z.string().optional().describe("Optional task goal for prompt customization"),
  }),
  
  /**
   * prepareCall: Customize the agent for each request
   * 
   * This is called before each agent.generate() and allows:
   * - Dynamic system prompt based on goal
   * - Per-request configuration
   * - Custom preprocessing
   * 
   * The adapter will pass { contextId, goal } as options.
   */
  prepareCall: async ({ options, ...settings }) => {
    // Customize system prompt with goal if provided
    const instructions = getMovieAgentPrompt(options?.goal);
    
    // Return settings with custom prompt
    return {
      ...settings,
      instructions,
    };
  },
});

