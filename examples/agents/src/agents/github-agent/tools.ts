/**
 * GitHub Agent Tools
 *
 * Composable GitHub tools that accept a GitHub client.
 * This enables use in both Node.js and Cloudflare Workers environments.
 *
 * Usage:
 * ```typescript
 * // Node.js (uses process.env)
 * const tools = createGitHubTools();
 *
 * // Cloudflare Workers (explicit token)
 * const octokit = new Octokit({ auth: env.GITHUB_TOKEN });
 * const tools = createGitHubTools(octokit);
 * ```
 */

import { Octokit } from "@octokit/rest";

// ============================================================================
// GitHub API Response Types (internal)
// ============================================================================

/** Raw repository response from GitHub API */
interface GitHubRepoResponse {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  updated_at: string | null;
  pushed_at: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
}

/** Raw commit response from GitHub API */
interface GitHubCommitResponse {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: {
      name?: string;
      date?: string;
    } | null;
  };
}

/** Raw search repository response from GitHub API */
interface GitHubSearchRepoResponse {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  updated_at: string;
  pushed_at: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
}

// ============================================================================
// GitHub Client Interface (for dependency injection)
// ============================================================================

/**
 * Minimal interface for GitHub API client.
 * This allows any Octokit-compatible client to be injected.
 *
 * Note: Parameter types use specific literals to match Octokit's expected types.
 */
export interface GitHubClient {
  repos: {
    listForUser(params: {
      username: string;
      sort?: "created" | "updated" | "pushed" | "full_name";
      direction?: "asc" | "desc";
      per_page?: number;
    }): Promise<{ data: GitHubRepoResponse[] }>;
    listForAuthenticatedUser(params: {
      sort?: "created" | "updated" | "pushed" | "full_name";
      direction?: "asc" | "desc";
      per_page?: number;
    }): Promise<{ data: GitHubRepoResponse[] }>;
    listCommits(params: {
      owner: string;
      repo: string;
      since?: string;
      per_page?: number;
    }): Promise<{ data: GitHubCommitResponse[] }>;
  };
  search: {
    repos(params: {
      q: string;
      sort?: "stars" | "forks" | "help-wanted-issues" | "updated";
      order?: "asc" | "desc";
      per_page?: number;
    }): Promise<{ data: { items: GitHubSearchRepoResponse[] } }>;
  };
}

// ============================================================================
// Public Types
// ============================================================================

/**
 * Repository Information
 */
export interface GitHubRepository {
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

/**
 * Commit Information
 */
export interface GitHubCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

/**
 * API Result type
 */
export interface GitHubApiResult<T> {
  status: string;
  message: string;
  count: number;
  data?: T[];
  error?: string;
}

/**
 * GitHub Tools interface
 */
export interface GitHubTools {
  getUserRepositories: (
    username?: string,
    days?: number,
    limit?: number
  ) => Promise<GitHubApiResult<GitHubRepository>>;
  getRecentCommits: (
    repoName: string,
    days?: number,
    limit?: number
  ) => Promise<GitHubApiResult<GitHubCommit>>;
  searchRepositories: (
    query: string,
    sort?: "updated" | "stars" | "forks",
    limit?: number
  ) => Promise<GitHubApiResult<GitHubRepository>>;
}

/** Repository data shape from Octokit responses */
interface OctokitRepoData {
  name: string;
  full_name: string;
  description?: string | null;
  html_url: string;
  updated_at?: string | null;
  pushed_at?: string | null;
  language?: string | null;
  stargazers_count?: number;
  forks_count?: number;
}

/** Commit data shape from Octokit responses */
interface OctokitCommitData {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author?: { name?: string; date?: string } | null;
  };
}

/**
 * Interface for Octokit-like objects.
 * This allows any version of Octokit to be used.
 * Parameters use specific literals to match Octokit's expected types (contravariance).
 */
export interface OctokitLike {
  repos: {
    listForUser: (params: {
      username: string;
      sort?: "created" | "updated" | "pushed" | "full_name";
      direction?: "asc" | "desc";
      per_page?: number;
    }) => Promise<{ data: OctokitRepoData[] }>;
    listForAuthenticatedUser: (params: {
      sort?: "created" | "updated" | "pushed" | "full_name";
      direction?: "asc" | "desc";
      per_page?: number;
    }) => Promise<{ data: OctokitRepoData[] }>;
    listCommits: (params: {
      owner: string;
      repo: string;
      since?: string;
      per_page?: number;
    }) => Promise<{ data: OctokitCommitData[] }>;
  };
  search: {
    repos: (params: {
      q: string;
      sort?: "stars" | "forks" | "help-wanted-issues" | "updated";
      order?: "asc" | "desc";
      per_page?: number;
    }) => Promise<{ data: { items: OctokitRepoData[] } }>;
  };
}

/**
 * Create a GitHubClient from an Octokit instance.
 * This adapts the Octokit API to our simpler interface.
 * Accepts any Octokit-compatible object regardless of version.
 */
export function createGitHubClientFromOctokit(octokit: OctokitLike): GitHubClient {
  return {
    repos: {
      listForUser: async (params) => {
        const response = await octokit.repos.listForUser(params);
        return {
          data: response.data.map((repo) => ({
            name: repo.name,
            full_name: repo.full_name,
            description: repo.description ?? null,
            html_url: repo.html_url,
            updated_at: repo.updated_at ?? null,
            pushed_at: repo.pushed_at ?? null,
            language: repo.language ?? null,
            stargazers_count: repo.stargazers_count ?? 0,
            forks_count: repo.forks_count ?? 0,
          })),
        };
      },
      listForAuthenticatedUser: async (params) => {
        const response = await octokit.repos.listForAuthenticatedUser(params);
        return {
          data: response.data.map((repo) => ({
            name: repo.name,
            full_name: repo.full_name,
            description: repo.description ?? null,
            html_url: repo.html_url,
            updated_at: repo.updated_at ?? null,
            pushed_at: repo.pushed_at ?? null,
            language: repo.language ?? null,
            stargazers_count: repo.stargazers_count ?? 0,
            forks_count: repo.forks_count ?? 0,
          })),
        };
      },
      listCommits: async (params) => {
        const response = await octokit.repos.listCommits(params);
        return {
          data: response.data.map((commit) => ({
            sha: commit.sha,
            html_url: commit.html_url,
            commit: {
              message: commit.commit.message,
              author: commit.commit.author ?? null,
            },
          })),
        };
      },
    },
    search: {
      repos: async (params) => {
        const response = await octokit.search.repos(params);
        return {
          data: {
            items: response.data.items.map((repo) => ({
              name: repo.name,
              full_name: repo.full_name,
              description: repo.description ?? null,
              html_url: repo.html_url,
              updated_at: repo.updated_at ?? "",
              pushed_at: repo.pushed_at ?? null,
              language: repo.language ?? null,
              stargazers_count: repo.stargazers_count ?? 0,
              forks_count: repo.forks_count ?? 0,
            })),
          },
        };
      },
    },
  };
}

/**
 * Create GitHub tools with an optional GitHub client
 *
 * @param client - Optional GitHub client (Octokit or compatible). If not provided, creates one using process.env.GITHUB_TOKEN
 * @returns GitHub tools object
 */
export function createGitHubTools(client?: GitHubClient): GitHubTools {
  // Create Octokit if not provided (for Node.js environments)
  const github: GitHubClient =
    client ??
    createGitHubClientFromOctokit(
      new Octokit(
        typeof process !== "undefined" && process.env?.GITHUB_TOKEN
          ? { auth: process.env.GITHUB_TOKEN }
          : undefined
      )
    );

  return {
    getUserRepositories: async (
      username?: string,
      days: number = 30,
      limit: number = 10
    ): Promise<GitHubApiResult<GitHubRepository>> => {
      try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const repos: GitHubRepository[] = [];

        if (username) {
          const { data } = await github.repos.listForUser({
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
          const { data } = await github.repos.listForAuthenticatedUser({
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
    },

    getRecentCommits: async (
      repoName: string,
      days: number = 7,
      limit: number = 10
    ): Promise<GitHubApiResult<GitHubCommit>> => {
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

        const { data } = await github.repos.listCommits({
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
    },

    searchRepositories: async (
      query: string,
      sort: "updated" | "stars" | "forks" = "updated",
      limit: number = 10
    ): Promise<GitHubApiResult<GitHubRepository>> => {
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const dateFilter = thirtyDaysAgo.toISOString().split("T")[0];
        const searchQuery = `${query} pushed:>=${dateFilter}`;

        const { data } = await github.search.repos({
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
    },
  };
}

/**
 * Convenience function to get commits (for backwards compatibility with tests)
 */
export async function getRecentCommits(
  repoName: string,
  days: number = 7,
  limit: number = 10
): Promise<GitHubApiResult<GitHubCommit>> {
  const tools = createGitHubTools();
  return tools.getRecentCommits(repoName, days, limit);
}

/**
 * Convenience function to get repositories (for backwards compatibility with tests)
 */
export async function getUserRepositories(
  username?: string,
  days: number = 30,
  limit: number = 10
): Promise<GitHubApiResult<GitHubRepository>> {
  const tools = createGitHubTools();
  return tools.getUserRepositories(username, days, limit);
}

/**
 * Convenience function to search repositories (for backwards compatibility with tests)
 */
export async function searchRepositories(
  query: string,
  sort: "updated" | "stars" | "forks" = "updated",
  limit: number = 10
): Promise<GitHubApiResult<GitHubRepository>> {
  const tools = createGitHubTools();
  return tools.searchRepositories(query, sort, limit);
}
