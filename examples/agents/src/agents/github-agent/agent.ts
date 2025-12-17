/**
 * GitHub Agent
 *
 * A composable GitHub agent that accepts a GitHub client.
 * This enables use in both Node.js and Cloudflare Workers environments.
 *
 * Usage:
 * ```typescript
 * // Node.js (uses process.env.GITHUB_TOKEN)
 * const agent = createGitHubAgent(model);
 *
 * // Cloudflare Workers (explicit token)
 * const octokit = new Octokit({ auth: env.GITHUB_TOKEN });
 * const agent = createGitHubAgent(model, { client: octokit });
 * ```
 */

import { type LanguageModel, ToolLoopAgent } from "ai";
import { z } from "zod";
import { getGitHubAgentPrompt } from "./prompt.js";
import { createGitHubTools, type GitHubClient, type GitHubTools } from "./tools.js";

/**
 * Tool Schemas
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
  repoName: z.string().describe('Repository name in format "owner/repo"'),
  days: z.number().int().positive().default(7).describe("Number of days to look back (default: 7)"),
  limit: z
    .number()
    .int()
    .positive()
    .default(10)
    .describe("Maximum commits to return (default: 10)"),
});

const searchRepositoriesSchema = z.object({
  query: z.string().describe("Search query"),
  sort: z
    .enum(["updated", "stars", "forks"])
    .default("updated")
    .describe('Sort by "updated", "stars", or "forks"'),
  limit: z.number().int().positive().default(10).describe("Maximum results to return (default: 10)"),
});

type GetUserRepositoriesParams = z.infer<typeof getUserRepositoriesSchema>;
type GetRecentCommitsParams = z.infer<typeof getRecentCommitsSchema>;
type SearchRepositoriesParams = z.infer<typeof searchRepositoriesSchema>;

/**
 * Configuration for creating a GitHub agent
 */
export interface GitHubAgentConfig {
  /** Optional GitHub client (Octokit or compatible). If not provided, creates one using process.env.GITHUB_TOKEN */
  client?: GitHubClient;
  /** Optional pre-created tools (for testing) */
  tools?: GitHubTools;
}

/**
 * Create a GitHub Agent
 *
 * @param model - The language model to use
 * @param config - Optional configuration including GitHub client
 * @returns A configured ToolLoopAgent with GitHub API tools
 *
 * @example
 * ```typescript
 * // Node.js
 * const agent = createGitHubAgent(model);
 *
 * // Cloudflare Workers
 * const octokit = new Octokit({ auth: env.GITHUB_TOKEN });
 * const agent = createGitHubAgent(model, { client: octokit });
 * ```
 */
export function createGitHubAgent(model: LanguageModel, config?: GitHubAgentConfig) {
  const tools = config?.tools ?? createGitHubTools(config?.client);

  return new ToolLoopAgent({
    model,
    instructions: getGitHubAgentPrompt(),
    tools: {
      getUserRepositories: {
        description: "Get user repositories with recent updates",
        inputSchema: getUserRepositoriesSchema,
        execute: async (params: GetUserRepositoriesParams) => {
          return tools.getUserRepositories(params.username, params.days ?? 30, params.limit ?? 10);
        },
      },

      getRecentCommits: {
        description: "Get recent commits for a specific repository",
        inputSchema: getRecentCommitsSchema,
        execute: async (params: GetRecentCommitsParams) => {
          return tools.getRecentCommits(params.repoName, params.days ?? 7, params.limit ?? 10);
        },
      },

      searchRepositories: {
        description: "Search for repositories with recent activity",
        inputSchema: searchRepositoriesSchema,
        execute: async (params: SearchRepositoriesParams) => {
          return tools.searchRepositories(
            params.query,
            params.sort ?? "updated",
            params.limit ?? 10
          );
        },
      },
    },
  });
}

