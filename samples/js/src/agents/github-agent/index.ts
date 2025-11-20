/**
 * GitHub Agent - A2A Server
 *
 * Exposes the GitHub agent via the A2A protocol using Hono.
 * Demonstrates external API integration with authentication.
 *
 * Port: 41246 (by default)
 *
 * Usage:
 *   pnpm agents:github-agent
 *   # or
 *   cd samples/js
 *   pnpm tsx src/agents/github-agent/index.ts
 */

import { serve } from "@hono/node-server";
import { A2AHonoApp } from "@drew-foxall/a2a-js-sdk/hono";
import {
  AgentCard,
  AgentSkill,
  AgentCapabilities,
} from "@drew-foxall/a2a-js-sdk";
import { A2AAdapter } from "../../shared/a2a-adapter.js";
import { createGitHubAgent } from "./agent.js";
import { getModel } from "../../shared/utils.js";

// ============================================================================
// Configuration
// ============================================================================

const PORT = 41246;
const HOST = "0.0.0.0";
const BASE_URL = `http://localhost:${PORT}`;

// ============================================================================
// Agent Card Configuration
// ============================================================================

const githubSkill: AgentSkill = {
  id: "github_repositories",
  name: "GitHub Repositories",
  description:
    "Query GitHub repositories, recent updates, commits, and project activity",
  tags: ["github", "repositories", "commits", "api"],
  examples: [
    "Show recent repository updates for facebook",
    "What are the latest commits in facebook/react?",
    "Search for popular Python repositories with recent activity",
    "Get my recent repository updates",
  ],
};

const agentCard: AgentCard = {
  name: "GitHub Agent",
  description:
    "An agent that can query GitHub repositories and recent project updates using the GitHub API",
  url: `${BASE_URL}/.well-known/agent-card.json`,
  version: "1.0.0",
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
  capabilities: new AgentCapabilities({
    streaming: true,
    statefulness: "stateless",
  }),
  skills: [githubSkill],
};

// ============================================================================
// Agent Initialization
// ============================================================================

const model = getModel();
const agent = createGitHubAgent(model);

// ============================================================================
// A2A Protocol Integration
// ============================================================================

const adapter = new A2AAdapter({
  agent,
  agentCard,
  logger: console,
});

// ============================================================================
// HTTP Server (Hono + A2A)
// ============================================================================

const app = new A2AHonoApp({
  agentCard,
  agentExecutor: adapter.createAgentExecutor(),
});

// ============================================================================
// Start Server
// ============================================================================

const hasGitHubToken = !!process.env.GITHUB_TOKEN;
const authStatus = hasGitHubToken
  ? "✅ Authenticated (5000 req/hour)"
  : "⚠️  Unauthenticated (60 req/hour)";

console.log(`
🐙 GitHub Agent - A2A Server Starting...

📍 Port: ${PORT}
🌐 URL: ${BASE_URL}
📋 Agent Card: ${BASE_URL}/.well-known/agent-card.json

🤖 Agent: GitHub Agent (External API Integration)
🔧 Framework: AI SDK v6 + Hono + A2A Protocol
🧠 Model: ${process.env.AI_PROVIDER || "openai"} / ${process.env.AI_MODEL || "default"}
🔐 GitHub API: ${authStatus}

✨ This agent demonstrates:
   - External API integration (GitHub via Octokit)
   - Optional authentication patterns (GitHub token)
   - Error handling for network requests
   - Rate limit awareness

🎯 Available Tools:
   1. getUserRepositories(username?, days?, limit?) - Get user repos
   2. getRecentCommits(repoName, days?, limit?) - Get repo commits
   3. searchRepositories(query, sort?, limit?) - Search repos

📝 Try it:
   curl -X POST ${BASE_URL}/message/send \\
     -H "Content-Type: application/json" \\
     -d '{"message": {"role": "user", "parts": [{"kind": "text", "text": "Show recent commits for facebook/react"}]}}'

${!hasGitHubToken ? "\n💡 Tip: Set GITHUB_TOKEN environment variable for higher rate limits!\n" : ""}
🚀 Ready to query GitHub...
`);

serve({
  fetch: app.fetch,
  port: PORT,
  hostname: HOST,
});
