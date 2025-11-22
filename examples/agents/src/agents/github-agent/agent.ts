/**
 * GitHub Agent
 *
 * A protocol-agnostic AI agent demonstrating external API integration.
 *
 * Features:
 * - GitHub API integration via Octokit
 * - Three tools for repository queries
 * - Authentication support (optional GitHub token)
 * - Error handling for network requests
 * - Rate limit awareness
 *
 * This agent can:
 * - Get user repositories with recent updates
 * - Get recent commits for specific repositories
 * - Search for repositories with recent activity
 */

import { type LanguageModel, ToolLoopAgent } from "ai";
import { z } from "zod";
import { getGitHubAgentPrompt } from "./prompt";
import { getRecentCommits, getUserRepositories, searchRepositories } from "./tools";

/**
 * Tool Schemas
 *
 * Define input validation using Zod schemas for each GitHub API tool
 */
const getUserRepositoriesSchema = z.object({
  username: z.string().optional().describe("GitHub username (optional)"),
  days: z
    .number()
    .int()
    .positive()
    .default(30)
    .describe("Number of days to look back (default: 30)"),
  limit: z
    .number()
    .int()
    .positive()
    .default(10)
    .describe("Maximum repositories to return (default: 10)"),
});

const getRecentCommitsSchema = z.object({
  repoName: z.string().describe('Repository name in format "owner/repo" (e.g., "facebook/react")'),
  days: z.number().int().positive().default(7).describe("Number of days to look back (default: 7)"),
  limit: z
    .number()
    .int()
    .positive()
    .default(10)
    .describe("Maximum commits to return (default: 10)"),
});

const searchRepositoriesSchema = z.object({
  query: z.string().describe('Search query (e.g., "machine learning", "python web framework")'),
  sort: z
    .enum(["updated", "stars", "forks"])
    .default("updated")
    .describe('Sort by "updated", "stars", or "forks" (default: "updated")'),
  limit: z
    .number()
    .int()
    .positive()
    .default(10)
    .describe("Maximum results to return (default: 10)"),
});

/**
 * Type-safe parameter types
 */
type GetUserRepositoriesParams = z.infer<typeof getUserRepositoriesSchema>;
type GetRecentCommitsParams = z.infer<typeof getRecentCommitsSchema>;
type SearchRepositoriesParams = z.infer<typeof searchRepositoriesSchema>;

/**
 * Create a GitHub Agent
 *
 * This is a protocol-agnostic AI agent that can be exposed through
 * multiple interfaces (A2A, MCP, REST, CLI, etc.)
 *
 * @param model - The language model to use (from getModel() utility)
 * @returns A configured ToolLoopAgent with GitHub API tools
 */
export function createGitHubAgent(model: LanguageModel) {
  return new ToolLoopAgent({
    model,
    instructions: getGitHubAgentPrompt(),

    // GitHub API tools using inputSchema for AI SDK v6 compatibility
    tools: {
      getUserRepositories: {
        description:
          "Get user repositories with recent updates. Optionally filter by username, days, and limit.",
        inputSchema: getUserRepositoriesSchema,
        execute: async (params: GetUserRepositoriesParams) => {
          const result = await getUserRepositories(params.username, params.days, params.limit);
          return result;
        },
      },

      getRecentCommits: {
        description:
          "Get recent commits for a specific repository. Requires repository name in format 'owner/repo'.",
        inputSchema: getRecentCommitsSchema,
        execute: async (params: GetRecentCommitsParams) => {
          const result = await getRecentCommits(params.repoName, params.days, params.limit);
          return result;
        },
      },

      searchRepositories: {
        description:
          "Search for repositories with recent activity. Returns repositories matching the query.",
        inputSchema: searchRepositoriesSchema,
        execute: async (params: SearchRepositoriesParams) => {
          const result = await searchRepositories(params.query, params.sort, params.limit);
          return result;
        },
      },
    },
  });
}
