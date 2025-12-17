/**
 * GitHub Agent
 *
 * An agent that queries GitHub repositories and project activity.
 * This module exports ONLY the agent logic - no HTTP framework dependencies.
 */

export { createGitHubAgent, type GitHubAgentConfig } from "./agent.js";
export { getGitHubAgentPrompt } from "./prompt.js";
export {
  createGitHubClientFromOctokit,
  createGitHubTools,
  type GitHubApiResult,
  type GitHubClient,
  type GitHubCommit,
  type GitHubRepository,
  type GitHubTools,
  getRecentCommits,
  getUserRepositories,
  type OctokitLike,
  searchRepositories,
} from "./tools.js";
