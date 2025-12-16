/**
 * GitHub Agent - Cloudflare Worker
 *
 * Exposes the GitHub agent via the A2A protocol on Cloudflare Workers.
 * Demonstrates external API integration with authentication.
 *
 * KEY ARCHITECTURE:
 * - Uses Octokit for GitHub API calls
 * - Supports GITHUB_TOKEN for authenticated access
 * - Worker handles environment-specific configuration
 *
 * Deployment:
 *   wrangler deploy
 *
 * Local Development:
 *   wrangler dev
 */

import { A2AAdapter } from "@drew-foxall/a2a-ai-sdk-adapter";
import type { AgentCard, AgentSkill } from "@drew-foxall/a2a-js-sdk";
import {
  type AgentExecutor,
  DefaultRequestHandler,
  InMemoryTaskStore,
  type TaskStore,
} from "@drew-foxall/a2a-js-sdk/server";
import { A2AHonoApp, ConsoleLogger } from "@drew-foxall/a2a-js-sdk/server/hono";
import { Octokit } from "@octokit/rest";
import { type LanguageModel, ToolLoopAgent } from "ai";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import type { HonoEnv } from "../../shared/types.js";
import { getModel, getModelInfo } from "../../shared/utils.js";

// ============================================================================
// Worker-specific Types
// ============================================================================

interface GitHubEnv extends HonoEnv {
  Bindings: HonoEnv["Bindings"] & {
    GITHUB_TOKEN?: string;
  };
}

// ============================================================================
// Agent Card Configuration
// ============================================================================

const githubReposSkill: AgentSkill = {
  id: "github_repositories",
  name: "Repository Query",
  description: "Get information about GitHub repositories with recent updates",
  tags: ["github", "repositories"],
  examples: ["Show my recent repositories", "What repos has facebook updated this week?"],
};

const githubCommitsSkill: AgentSkill = {
  id: "github_commits",
  name: "Commit History",
  description: "Get recent commits for a repository",
  tags: ["github", "commits"],
  examples: ["Show recent commits in facebook/react", "What changed in vercel/ai last 7 days?"],
};

const githubSearchSkill: AgentSkill = {
  id: "github_search",
  name: "Repository Search",
  description: "Search for repositories with recent activity",
  tags: ["github", "search"],
  examples: [
    "Find active TypeScript projects",
    "Search for machine learning repos updated recently",
  ],
};

function createAgentCard(baseUrl: string): AgentCard {
  return {
    name: "GitHub Agent",
    description:
      "An agent that can query GitHub repositories and recent project updates using the GitHub API",
    url: baseUrl,
    version: "1.0.0",
    protocolVersion: "0.3.0",
    preferredTransport: "JSONRPC",
    defaultInputModes: ["text"],
    defaultOutputModes: ["text"],
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    skills: [githubReposSkill, githubCommitsSkill, githubSearchSkill],
  };
}

// ============================================================================
// GitHub Tools (Worker-compatible)
// ============================================================================

interface GitHubRepository {
  name: string;
  fullName: string;
  description: string | null;
  url: string;
  updatedAt: string;
  pushedAt: string | null;
  language: string | null;
  stars: number;
  forks: number;
}

interface GitHubCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

async function getUserRepositories(
  octokit: Octokit,
  username: string | undefined,
  days: number,
  limit: number
): Promise<{
  status: string;
  message: string;
  count: number;
  data?: GitHubRepository[];
  error?: string;
}> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const repos: GitHubRepository[] = [];

    if (username) {
      const { data } = await octokit.repos.listForUser({
        username,
        sort: "updated",
        direction: "desc",
        per_page: limit * 2,
      });

      for (const repo of data) {
        if (repos.length >= limit) break;
        if (!repo.updated_at) continue;
        const updatedAt = new Date(repo.updated_at);
        if (updatedAt >= cutoffDate) {
          repos.push({
            name: repo.name,
            fullName: repo.full_name,
            description: repo.description ?? null,
            url: repo.html_url,
            updatedAt: repo.updated_at,
            pushedAt: repo.pushed_at ?? null,
            language: repo.language ?? null,
            stars: repo.stargazers_count ?? 0,
            forks: repo.forks_count ?? 0,
          });
        }
      }
    } else {
      const { data } = await octokit.repos.listForAuthenticatedUser({
        sort: "updated",
        direction: "desc",
        per_page: limit * 2,
      });

      for (const repo of data) {
        if (repos.length >= limit) break;
        if (!repo.updated_at) continue;
        const updatedAt = new Date(repo.updated_at);
        if (updatedAt >= cutoffDate) {
          repos.push({
            name: repo.name,
            fullName: repo.full_name,
            description: repo.description ?? null,
            url: repo.html_url,
            updatedAt: repo.updated_at,
            pushedAt: repo.pushed_at ?? null,
            language: repo.language ?? null,
            stars: repo.stargazers_count ?? 0,
            forks: repo.forks_count ?? 0,
          });
        }
      }
    }

    return {
      status: "success",
      message: `Retrieved ${repos.length} repositories updated in the last ${days} days`,
      count: repos.length,
      data: repos,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      status: "error",
      message: `Failed to get repositories: ${errorMessage}`,
      count: 0,
      error: errorMessage,
    };
  }
}

async function getRecentCommits(
  octokit: Octokit,
  repoName: string,
  days: number,
  limit: number
): Promise<{
  status: string;
  message: string;
  count: number;
  data?: GitHubCommit[];
  error?: string;
}> {
  try {
    const [owner, repo] = repoName.split("/");

    if (!owner || !repo) {
      return {
        status: "error",
        message: 'Repository name must be in format "owner/repo"',
        count: 0,
        error: "Invalid repository format",
      };
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data } = await octokit.repos.listCommits({
      owner,
      repo,
      since: cutoffDate.toISOString(),
      per_page: limit,
    });

    const commits: GitHubCommit[] = data.map((commit) => ({
      sha: commit.sha.substring(0, 8),
      message: commit.commit.message.split("\n")[0] ?? "No message",
      author: commit.commit.author?.name ?? "Unknown",
      date: commit.commit.author?.date ?? new Date().toISOString(),
      url: commit.html_url,
    }));

    return {
      status: "success",
      message: `Retrieved ${commits.length} commits for ${repoName} in the last ${days} days`,
      count: commits.length,
      data: commits,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      status: "error",
      message: `Failed to get commits: ${errorMessage}`,
      count: 0,
      error: errorMessage,
    };
  }
}

async function searchRepositories(
  octokit: Octokit,
  query: string,
  sort: "updated" | "stars" | "forks",
  limit: number
): Promise<{
  status: string;
  message: string;
  count: number;
  data?: GitHubRepository[];
  error?: string;
}> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateFilter = thirtyDaysAgo.toISOString().split("T")[0];
    const searchQuery = `${query} pushed:>=${dateFilter}`;

    const { data } = await octokit.search.repos({
      q: searchQuery,
      sort,
      order: "desc",
      per_page: limit,
    });

    const repos: GitHubRepository[] = data.items.map((repo) => ({
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      url: repo.html_url,
      updatedAt: repo.updated_at,
      pushedAt: repo.pushed_at || null,
      language: repo.language,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
    }));

    return {
      status: "success",
      message: `Found ${repos.length} repositories matching "${query}"`,
      count: repos.length,
      data: repos,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      status: "error",
      message: `Failed to search repositories: ${errorMessage}`,
      count: 0,
      error: errorMessage,
    };
  }
}

// ============================================================================
// Worker-specific Agent Factory
// ============================================================================

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

function createWorkerGitHubAgent(model: LanguageModel, githubToken?: string) {
  const octokit = new Octokit(githubToken ? { auth: githubToken } : undefined);

  return new ToolLoopAgent({
    model,
    instructions: `You are a GitHub agent that helps users query information about repositories and project activity.

You can help with:
- Finding recently updated repositories
- Viewing commit history
- Searching for repositories by topic or language

When displaying repository information, include:
- Repository name and description
- Last updated time
- Programming language
- Stars and forks count
- Recent commits when relevant

Use the provided tools to fetch accurate data from the GitHub API.
Never make up repository names or statistics.`,

    tools: {
      getUserRepositories: {
        description: "Get user repositories with recent updates",
        inputSchema: getUserRepositoriesSchema,
        execute: async (params: GetUserRepositoriesParams) => {
          return getUserRepositories(octokit, params.username, params.days ?? 30, params.limit ?? 10);
        },
      },

      getRecentCommits: {
        description: "Get recent commits for a specific repository",
        inputSchema: getRecentCommitsSchema,
        execute: async (params: GetRecentCommitsParams) => {
          return getRecentCommits(octokit, params.repoName, params.days ?? 7, params.limit ?? 10);
        },
      },

      searchRepositories: {
        description: "Search for repositories with recent activity",
        inputSchema: searchRepositoriesSchema,
        execute: async (params: SearchRepositoriesParams) => {
          return searchRepositories(octokit, params.query, params.sort ?? "updated", params.limit ?? 10);
        },
      },
    },
  });
}

// ============================================================================
// Hono App Setup
// ============================================================================

const app = new Hono<GitHubEnv>();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

app.get("/health", (c) => {
  const modelInfo = getModelInfo(c.env);
  const hasToken = !!c.env.GITHUB_TOKEN;
  return c.json({
    status: "healthy",
    agent: "GitHub Agent",
    provider: modelInfo.provider,
    model: modelInfo.model,
    runtime: "Cloudflare Workers",
    githubAuth: hasToken ? "authenticated" : "unauthenticated",
  });
});

// ============================================================================
// A2A Protocol Routes
// ============================================================================

app.all("/*", async (c, next) => {
  const url = new URL(c.req.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  const agentCard = createAgentCard(baseUrl);

  // Create agent with environment-specific GitHub token
  const model = getModel(c.env);
  const agent = createWorkerGitHubAgent(model, c.env.GITHUB_TOKEN);

  const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
    mode: "stream",
    workingMessage: "Querying GitHub...",
  });

  const taskStore: TaskStore = new InMemoryTaskStore();
  const requestHandler = new DefaultRequestHandler(agentCard, taskStore, agentExecutor);

  const a2aRouter = new Hono();
  const logger = ConsoleLogger.create();
  const appBuilder = new A2AHonoApp(requestHandler, { logger });
  appBuilder.setupRoutes(a2aRouter);

  const a2aResponse = await a2aRouter.fetch(c.req.raw, c.env);
  if (a2aResponse.status !== 404) {
    return a2aResponse;
  }

  return next();
});

app.notFound((c) => {
  return c.json(
    {
      error: "Not Found",
      message: "Use /.well-known/agent-card.json to discover this agent",
      endpoints: {
        agentCard: "/.well-known/agent-card.json",
        sendMessage: "/message/send",
        health: "/health",
      },
    },
    404
  );
});

// ============================================================================
// Export for Cloudflare Workers
// ============================================================================

export default app;

