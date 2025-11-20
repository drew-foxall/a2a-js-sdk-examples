# GitHub Agent

An A2A agent that demonstrates external API integration using the GitHub REST API.

## Overview

This agent showcases **external API integration** with authentication patterns:
- 🐙 **GitHub API** - Query repositories, commits, and project activity
- 🔐 **Optional Authentication** - GitHub token for higher rate limits
- 🛡️ **Error Handling** - Graceful handling of network errors
- ⚡ **Rate Limit Awareness** - 60 req/hour (no auth) or 5000 req/hour (with token)

## What It Does

**Capabilities:**
- Get user repositories with recent updates
- Get recent commits for specific repositories
- Search for repositories with recent activity
- Provide detailed project information (stars, forks, language, etc.)

**Example Interactions:**
- "Show recent repository updates for facebook" → Lists Facebook's recently updated repos
- "What are the latest commits in facebook/react?" → Shows recent commits for React
- "Search for popular Python repositories" → Finds Python repos with recent activity

## Architecture

```
github-agent/
├── tools.ts    # Octokit integration (getUserRepositories, getRecentCommits, searchRepositories)
├── agent.ts    # AI SDK ToolLoopAgent with GitHub API tools
├── index.ts    # A2A integration via A2AAdapter
├── prompt.ts   # System prompt with tool usage instructions
└── README.md   # This file
```

## Why This Example?

The GitHub Agent is the **first real-world API integration** example because it demonstrates:

1. **External API Integration** - Connecting to GitHub REST API
2. **Authentication Patterns** - Optional token-based auth
3. **Error Handling** - Network errors, invalid inputs, rate limits
4. **Complex Tool Parameters** - Multiple optional parameters with defaults
5. **Structured Responses** - Parsing and formatting API results

This builds on previous examples by adding **external dependencies** and **real-world API patterns**.

## Quick Start

### 1. Install Dependencies

```bash
cd samples/js
pnpm install  # Installs @octokit/rest
```

### 2. Set Environment Variables

```bash
# Required: AI provider API key
export OPENAI_API_KEY=your_openai_api_key

# Optional but STRONGLY RECOMMENDED: GitHub token
export GITHUB_TOKEN=your_github_personal_access_token

# Optional: Change AI provider/model
export AI_PROVIDER=openai
export AI_MODEL=gpt-4o-mini
```

### 3. Create GitHub Token (Recommended)

Without a GitHub token, you're limited to **60 requests per hour**. With a token, you get **5000 requests per hour**.

**Create a token:**
1. Go to [GitHub Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Give it a name (e.g., "A2A GitHub Agent")
4. No scopes needed for public repo access (leave all unchecked)
5. Click "Generate token"
6. Copy the token and set it as `GITHUB_TOKEN` environment variable

### 4. Start the Agent

```bash
# From project root
pnpm agents:github-agent

# Or from samples/js
pnpm tsx src/agents/github-agent/index.ts
```

The agent will start on **port 41246** by default.

## Usage Examples

### Get User Repositories

```bash
curl -X POST http://localhost:41246/message/send \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "role": "user",
      "parts": [{"kind": "text", "text": "Show recent repository updates for facebook"}]
    }
  }'
```

### Get Recent Commits

```bash
curl -X POST http://localhost:41246/message/send \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "role": "user",
      "parts": [{"kind": "text", "text": "What are the latest commits in facebook/react?"}]
    }
  }'
```

### Search Repositories

```bash
curl -X POST http://localhost:41246/message/send \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "role": "user",
      "parts": [{"kind": "text", "text": "Search for popular Python web frameworks"}]
    }
  }'
```

### Agent Card

```bash
curl http://localhost:41246/.well-known/agent-card.json
```

## Technical Details

### GitHub API Integration

The agent uses **Octokit** (official GitHub REST API client):

```typescript
import { Octokit } from "@octokit/rest";

// Initialize with optional authentication
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN, // Optional
});
```

### Three GitHub Tools

#### 1. getUserRepositories
```typescript
getUserRepositories(username?, days?, limit?)
```
- Get repositories for a user with recent updates
- **username**: GitHub username (optional, uses authenticated user if not provided)
- **days**: Number of days to look back (default: 30)
- **limit**: Max repositories to return (default: 10)

#### 2. getRecentCommits
```typescript
getRecentCommits(repoName, days?, limit?)
```
- Get recent commits for a specific repository
- **repoName**: Repository in format "owner/repo" (e.g., "facebook/react")
- **days**: Number of days to look back (default: 7)
- **limit**: Max commits to return (default: 10)

#### 3. searchRepositories
```typescript
searchRepositories(query, sort?, limit?)
```
- Search for repositories with recent activity
- **query**: Search query string (e.g., "machine learning")
- **sort**: Sort by "updated", "stars", or "forks" (default: "updated")
- **limit**: Max results to return (default: 10)

### Error Handling

The agent gracefully handles:
- **Network Errors** - Connection timeouts, DNS failures
- **Authentication Errors** - Invalid or expired tokens
- **Rate Limit Errors** - Exceeded API quota
- **Invalid Inputs** - Malformed repository names
- **Not Found Errors** - Non-existent users or repositories

Example error response:
```json
{
  "status": "error",
  "message": "Failed to get commits: Not Found",
  "count": 0,
  "error": "Not Found"
}
```

### Authentication

**Without Token (Unauthenticated):**
- ✅ Can access all public repositories
- ⚠️  Limited to **60 requests per hour**
- ⚠️  Cannot access private repositories

**With Token (Authenticated):**
- ✅ Can access all public repositories
- ✅ **5000 requests per hour** (83x more!)
- ✅ Can access your private repositories (if token has appropriate scopes)

The agent automatically detects if a token is present and logs the authentication status.

### Rate Limiting

GitHub API has rate limits:
- **Unauthenticated**: 60 requests/hour per IP
- **Authenticated**: 5000 requests/hour per token

The agent includes the rate limit status in error messages when limits are exceeded.

### Zod Schema Validation

Each tool uses Zod schemas for parameter validation:

```typescript
const getUserRepositoriesSchema = z.object({
  username: z.string().optional(),
  days: z.number().int().positive().default(30),
  limit: z.number().int().positive().default(10),
});
```

This ensures:
- ✅ **Type Safety** - Parameters are strongly typed
- ✅ **Runtime Validation** - Invalid inputs are caught
- ✅ **Default Values** - Optional parameters have sensible defaults
- ✅ **Documentation** - Schemas describe expected inputs

### Repository Information

The agent returns structured repository data:
```typescript
interface GitHubRepository {
  name: string;              // "react"
  fullName: string;          // "facebook/react"
  description: string | null; // "A declarative..."
  url: string;               // "https://github.com/facebook/react"
  updatedAt: string;         // ISO 8601 timestamp
  pushedAt: string | null;   // ISO 8601 timestamp
  language: string | null;   // "JavaScript"
  stars: number;             // 234567
  forks: number;             // 45678
}
```

### Commit Information

```typescript
interface GitHubCommit {
  sha: string;       // "a1b2c3d4" (short SHA)
  message: string;   // "Fix bug in..."
  author: string;    // "Jane Doe"
  date: string;      // ISO 8601 timestamp
  url: string;       // URL to view commit
}
```

## Comparison to Previous Examples

| Feature | Hello World | Dice Agent | GitHub Agent |
|---------|-------------|------------|--------------|
| Tools | ❌ None | ✅ Two tools | ✅ Three tools |
| External API | ❌ No | ❌ No | ✅ GitHub API |
| Authentication | ❌ N/A | ❌ N/A | ✅ Optional token |
| Error Handling | ✅ Basic | ✅ Basic | ✅ Advanced |
| Network I/O | ❌ No | ❌ No | ✅ Yes |
| Complexity | ⭐ Very Simple | ⭐⭐ Simple | ⭐⭐⭐ Moderate |
| Purpose | Foundation | Tool usage | API integration |

## Port

- **Default**: 41246
- **Configurable**: Edit `PORT` constant in `index.ts`

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | ✅ (or other provider) | - | API key for LLM provider |
| `GITHUB_TOKEN` | ❌ (recommended) | - | GitHub personal access token |
| `AI_PROVIDER` | ❌ | `openai` | Provider: openai, anthropic, google, etc. |
| `AI_MODEL` | ❌ | `gpt-4o-mini` | Model to use |

## Learning Path

This agent teaches:

### 1. External API Integration
- Use existing npm packages (@octokit/rest)
- Handle authentication tokens
- Manage API credentials securely

### 2. Error Handling Patterns
```typescript
try {
  const result = await github.repos.listForUser({...});
  return { status: "success", data: result };
} catch (error) {
  return { status: "error", error: error.message };
}
```

### 3. Structured API Responses
- Parse API responses into clean structures
- Filter and transform data
- Return consistent response formats

### 4. Optional Parameters
- Provide sensible defaults
- Allow customization via parameters
- Document parameter purposes

## Troubleshooting

### Rate Limit Exceeded
```
Error: API rate limit exceeded
```
**Solution**: Add `GITHUB_TOKEN` environment variable for 5000 req/hour limit.

### Repository Not Found
```
Error: Failed to get commits: Not Found
```
**Solutions**:
- Verify repository name format is "owner/repo"
- Check if repository exists and is public
- For private repos, ensure token has appropriate access

### Network Timeout
```
Error: Failed to get repositories: Connection timeout
```
**Solution**: Check internet connection and GitHub API status.

## Next Steps

After understanding the GitHub Agent:
1. **Analytics Agent** - Adds image generation and streaming artifacts
2. **Multi-Agent Systems** - Agent orchestration patterns

## Learn More

- [GitHub REST API Documentation](https://docs.github.com/en/rest)
- [Octokit Documentation](https://octokit.github.io/rest.js/)
- [A2A Protocol Documentation](https://google.github.io/A2A/)
- [AI SDK Documentation](https://sdk.vercel.ai/docs)
- [Conversion Plan](../../../../../../../PYTHON_TO_JS_CONVERSION_PLAN.md)
