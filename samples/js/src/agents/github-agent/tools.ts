/**
 * GitHub Agent Tools
 *
 * External API integration using Octokit (official GitHub REST API client).
 * These tools demonstrate:
 * - API authentication patterns
 * - External service integration
 * - Error handling for network requests
 * - Rate limit awareness
 */

import { Octokit } from "@octokit/rest";

/**
 * GitHub API Client
 *
 * Singleton instance with optional authentication.
 * Uses GITHUB_TOKEN environment variable if available.
 */
let octokit: Octokit | null = null;

function getGitHubClient(): Octokit {
  if (!octokit) {
    const token = process.env.GITHUB_TOKEN;
    if (token) {
      octokit = new Octokit({ auth: token });
      console.log("✅ GitHub client initialized with authentication");
    } else {
      octokit = new Octokit();
      console.log("⚠️  GitHub client initialized without authentication (60 req/hour limit)");
    }
  }
  return octokit;
}

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
 * Get user repositories with recent updates
 *
 * @param username - GitHub username (optional, defaults to authenticated user)
 * @param days - Number of days to look for recent updates (default: 30)
 * @param limit - Maximum number of repositories to return (default: 10)
 * @returns Object with status and repository list
 */
export async function getUserRepositories(
  username?: string,
  days: number = 30,
  limit: number = 10
): Promise<{
  status: string;
  message: string;
  count: number;
  data?: GitHubRepository[];
  error?: string;
}> {
  try {
    const github = getGitHubClient();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Get repositories
    const repos: GitHubRepository[] = [];

    if (username) {
      // Get repositories for specific user
      const { data } = await github.repos.listForUser({
        username,
        sort: "updated",
        direction: "desc",
        per_page: limit * 2, // Get more to filter
      });

      for (const repo of data) {
        if (repos.length >= limit) break;
        const updatedAt = new Date(repo.updated_at);
        if (updatedAt >= cutoffDate) {
          repos.push({
            name: repo.name,
            fullName: repo.full_name,
            description: repo.description,
            url: repo.html_url,
            updatedAt: repo.updated_at,
            pushedAt: repo.pushed_at,
            language: repo.language,
            stars: repo.stargazers_count,
            forks: repo.forks_count,
          });
        }
      }
    } else {
      // Get repositories for authenticated user
      const { data } = await github.repos.listForAuthenticatedUser({
        sort: "updated",
        direction: "desc",
        per_page: limit * 2,
      });

      for (const repo of data) {
        if (repos.length >= limit) break;
        const updatedAt = new Date(repo.updated_at);
        if (updatedAt >= cutoffDate) {
          repos.push({
            name: repo.name,
            fullName: repo.full_name,
            description: repo.description,
            url: repo.html_url,
            updatedAt: repo.updated_at,
            pushedAt: repo.pushed_at || null,
            language: repo.language,
            stars: repo.stargazers_count,
            forks: repo.forks_count,
          });
        }
      }
    }

    return {
      status: "success",
      message: `Successfully retrieved ${repos.length} repositories updated in the last ${days} days`,
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

/**
 * Get recent commits for a repository
 *
 * @param repoName - Repository name in format "owner/repo"
 * @param days - Number of days to look for recent commits (default: 7)
 * @param limit - Maximum number of commits to return (default: 10)
 * @returns Object with status and commit list
 */
export async function getRecentCommits(
  repoName: string,
  days: number = 7,
  limit: number = 10
): Promise<{
  status: string;
  message: string;
  count: number;
  data?: GitHubCommit[];
  error?: string;
}> {
  try {
    const github = getGitHubClient();
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
      message: commit.commit.message.split("\n")[0], // First line only
      author: commit.commit.author?.name || "Unknown",
      date: commit.commit.author?.date || new Date().toISOString(),
      url: commit.html_url,
    }));

    return {
      status: "success",
      message: `Successfully retrieved ${commits.length} commits for ${repoName} in the last ${days} days`,
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

/**
 * Search for repositories with recent activity
 *
 * @param query - Search query string
 * @param sort - Sorting method: "updated", "stars", or "forks" (default: "updated")
 * @param limit - Maximum number of repositories to return (default: 10)
 * @returns Object with status and search results
 */
export async function searchRepositories(
  query: string,
  sort: "updated" | "stars" | "forks" = "updated",
  limit: number = 10
): Promise<{
  status: string;
  message: string;
  count: number;
  data?: GitHubRepository[];
  error?: string;
}> {
  try {
    const github = getGitHubClient();

    // Add recent activity filter to query (last 30 days)
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
      message: `Successfully searched for ${repos.length} repositories matching "${query}"`,
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
