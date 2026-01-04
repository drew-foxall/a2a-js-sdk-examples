/**
 * Movie Agent Export (No Server)
 *
 * This file exports just the agent for use in tests, CLI, etc.
 * Import this instead of index.ts to avoid starting the server.
 *
 * Features:
 * - Tools: TMDB API integration (searchMovies, searchPeople)
 * - Uses AI SDK v6 with explicit tool typing (avoids TS2589 type recursion)
 */

import { type LanguageModel, ToolLoopAgent } from "ai";
import { z } from "zod";
import { getModel } from "../../shared/utils";
import { getMovieAgentPrompt } from "./prompt";
import { searchMovies, searchPeople } from "./tmdb";

/**
 * Tool Schemas
 *
 * Define input validation using Zod schemas
 */
const searchMoviesSchema = z.object({
  query: z.string().describe("Movie title to search for"),
});

const searchPeopleSchema = z.object({
  query: z.string().describe("Person name to search for"),
});

/**
 * Type-safe parameter types
 */
type SearchMoviesParams = z.infer<typeof searchMoviesSchema>;
type SearchPeopleParams = z.infer<typeof searchPeopleSchema>;

/**
 * Movie Agent Tools
 *
 * Defined with explicit parameter types for type safety.
 * Note: If you see TS2589 "Type instantiation is excessively deep" errors,
 * ensure all packages use the same Zod version (check pnpm overrides).
 *
 * @see https://github.com/vercel/ai/issues/7160
 */
const movieAgentTools = {
  searchMovies: {
    description: "Search TMDB for movies by title",
    inputSchema: searchMoviesSchema,
    execute: async (params: SearchMoviesParams) => {
      return searchMovies(params.query);
    },
  },
  searchPeople: {
    description: "Search TMDB for people by name",
    inputSchema: searchPeopleSchema,
    execute: async (params: SearchPeopleParams) => {
      return searchPeople(params.query);
    },
  },
};

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
    instructions: getMovieAgentPrompt(),
    tools: movieAgentTools,
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
 */
export function getMovieAgent() {
  return createMovieAgent(getModel());
}
