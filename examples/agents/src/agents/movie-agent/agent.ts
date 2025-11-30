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

import { type LanguageModel, ToolLoopAgent } from "ai";
import { z } from "zod";
import { getModel } from "../../shared/utils";
import { getMovieAgentPrompt } from "./prompt";
import { searchMovies, searchPeople } from "./tmdb";

/**
 * TMDB Tool Schemas
 *
 * Define tools inline to avoid AI SDK v6 beta type complexities with tool() helper
 */
const movieQuerySchema = z.object({
  query: z.string().describe("The movie title to search for"),
});

const personQuerySchema = z.object({
  query: z.string().describe("The person name to search for"),
});

/**
 * Create Movie Agent with custom model
 *
 * Use this factory function when you need:
 * - Providers not supported by getModel() (Together AI, Replicate, etc.)
 * - Custom model configurations
 * - Azure OpenAI with specific settings
 * - Local or self-hosted models
 * - Runtime model selection
 *
 * @param model - Any AI SDK LanguageModelV1 instance
 * @returns Configured ToolLoopAgent with TMDB tools
 *
 * @example
 * // Use Groq for fast inference
 * import { createOpenAI } from '@ai-sdk/openai';
 * const groq = createOpenAI({
 *   baseURL: 'https://api.groq.com/openai/v1',
 *   apiKey: process.env.GROQ_API_KEY,
 * });
 * const agent = createMovieAgent(groq('llama-3.1-70b-versatile'));
 */
export function createMovieAgent(model: LanguageModel) {
  return new ToolLoopAgent({
    model,

    // Default instructions (overridden by prepareCall)
    instructions: getMovieAgentPrompt(),

    // Tools for TMDB integration - using inputSchema for ToolLoopAgent compatibility
    tools: {
      searchMovies: {
        description: "search TMDB for movies by title",
        inputSchema: movieQuerySchema,
        execute: async (params: z.infer<typeof movieQuerySchema>) => searchMovies(params.query),
      },
      searchPeople: {
        description: "search TMDB for people by name",
        inputSchema: personQuerySchema,
        execute: async (params: z.infer<typeof personQuerySchema>) => searchPeople(params.query),
      },
    },

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
}

/**
 * Default Movie Agent
 *
 * Uses model from environment variables:
 * - AI_PROVIDER: openai|anthropic|google|azure|cohere|mistral|groq|ollama
 * - AI_MODEL: Specific model name (optional, uses defaults)
 *
 * For custom providers or configurations, use createMovieAgent()
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
 * - A2A protocol (via A2AAdapter in index.ts)
 * - CLI tools (direct usage)
 * - REST APIs (future)
 * - MCP servers (future)
 * - Automated tests (no mocking)
 *
 * NOTE: This is a function (not a singleton) to avoid calling getModel()
 * at module load time, which would break edge runtimes like Cloudflare Workers.
 */
export function getMovieAgent() {
  return createMovieAgent(getModel());
}
