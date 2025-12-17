/**
 * GitHub Agent - Cloudflare Worker
 *
 * Exposes the GitHub agent via the A2A protocol on Cloudflare Workers.
 * Demonstrates external API integration with authentication.
 *
 * KEY ARCHITECTURE:
 * - Agent logic is imported from the shared `a2a-agents` package
 * - Worker injects Octokit client via createAgent callback
 * - Custom health check shows auth status
 *
 * Deployment:
 *   wrangler deploy
 *
 * Local Development:
 *   wrangler dev
 */

import type { AgentSkill } from "@drew-foxall/a2a-js-sdk";
import { Octokit } from "@octokit/rest";
import { createGitHubAgent, createGitHubClientFromOctokit } from "a2a-agents";
import {
  buildAgentCard,
  createA2AHonoWorker,
  defineWorkerConfig,
  type BaseWorkerEnv,
} from "a2a-workers-shared";

// ============================================================================
// Environment Extension
// ============================================================================

interface GitHubEnv extends BaseWorkerEnv {
  GITHUB_TOKEN?: string;
}

// ============================================================================
// Skill Definitions
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

// ============================================================================
// Worker Configuration
// ============================================================================

const config = defineWorkerConfig<GitHubEnv>({
  agentName: "GitHub Agent",

  createAgent: (model, env) => {
    const octokit = new Octokit(env.GITHUB_TOKEN ? { auth: env.GITHUB_TOKEN } : undefined);
    const githubClient = createGitHubClientFromOctokit(octokit);
    return createGitHubAgent(model, { client: githubClient });
  },

  createAgentCard: (baseUrl) =>
    buildAgentCard(baseUrl, {
      name: "GitHub Agent",
      description:
        "An agent that can query GitHub repositories and recent project updates using the GitHub API",
      skills: [githubReposSkill, githubCommitsSkill, githubSearchSkill],
    }),

  adapterOptions: {
    mode: "stream",
    workingMessage: "Querying GitHub...",
  },

  healthCheckExtras: (env) => ({
    githubAuth: env.GITHUB_TOKEN ? "authenticated" : "unauthenticated",
  }),
});

// ============================================================================
// Export Hono Application
// ============================================================================

export default createA2AHonoWorker(config);
