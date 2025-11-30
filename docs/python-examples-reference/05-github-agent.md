# GitHub Agent Reference

> **Source**: `samples/python/agents/github-agent/`
> **Our Implementation**: Not yet implemented ❌

## Overview

An agent for querying GitHub repositories and activity. Uses OpenAI function calling with PyGithub library. Good candidate for our next implementation.

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Client    │────►│  A2A Protocol   │────►│  OpenAI Agent   │
│             │◄────│  (JSON-RPC)     │◄────│                 │
└─────────────┘     └─────────────────┘     └────────┬────────┘
                                                     │
                                              ┌──────┴──────┐
                                              │GitHubToolset│
                                              ├─────────────┤
                                              │get_user_    │
                                              │ repositories│
                                              │get_recent_  │
                                              │ commits     │
                                              │search_      │
                                              │ repositories│
                                              └──────┬──────┘
                                                     │
                                              ┌──────▼──────┐
                                              │  GitHub API │
                                              └─────────────┘
```

## Agent Card

```json
{
  "name": "GitHub Agent",
  "description": "Query GitHub repositories and recent project updates",
  "version": "1.0.0",
  "default_input_modes": ["text"],
  "default_output_modes": ["text"],
  "capabilities": {
    "streaming": true
  },
  "skills": [
    {
      "id": "github_repos",
      "name": "Repository Query",
      "description": "Get information about GitHub repositories",
      "tags": ["github", "repositories"],
      "examples": [
        "Show my recent repositories",
        "What repos have I updated this week?"
      ]
    },
    {
      "id": "github_commits",
      "name": "Commit History",
      "description": "Get recent commits for a repository",
      "tags": ["github", "commits"],
      "examples": [
        "Show recent commits in owner/repo",
        "What changed in the last 7 days?"
      ]
    },
    {
      "id": "github_search",
      "name": "Repository Search",
      "description": "Search for repositories with recent activity",
      "tags": ["github", "search"],
      "examples": [
        "Find active Python machine learning repos",
        "Search for TypeScript projects updated recently"
      ]
    }
  ]
}
```

## System Prompt

```
You are a GitHub agent that can help users query information about GitHub repositories and recent project updates.

Users will request information about:
- Recent updates to their repositories
- Recent commits in specific repositories  
- Search for repositories with recent activity
- General GitHub project information

Use the provided tools for interacting with the GitHub API.

When displaying repository information, include relevant details like:
- Repository name and description
- Last updated time
- Programming language
- Stars and forks count
- Recent commit information when available

Always provide helpful and accurate information based on the GitHub API results.
Respond in Chinese unless the user specifically requests English.
```

## Structured Response Models

```python
class GitHubUser(BaseModel):
    """GitHub user information"""
    login: str
    name: str | None = None
    email: str | None = None

class GitHubRepository(BaseModel):
    """GitHub repository information"""
    name: str
    full_name: str
    description: str | None = None
    url: str
    updated_at: str
    pushed_at: str | None = None
    language: str | None = None
    stars: int
    forks: int

class GitHubCommit(BaseModel):
    """GitHub commit information"""
    sha: str
    message: str
    author: str
    date: str
    url: str

class GitHubResponse(BaseModel):
    """Base response model"""
    status: str
    message: str
    count: int | None = None
    error_message: str | None = None

class RepositoryResponse(GitHubResponse):
    data: list[GitHubRepository] | None = None

class CommitResponse(GitHubResponse):
    data: list[GitHubCommit] | None = None
```

## Tools

### GitHubToolset Class

```python
class GitHubToolset:
    """GitHub API toolset for querying repositories and recent updates"""

    def __init__(self):
        self._github_client = None

    def _get_github_client(self) -> Github:
        """Get GitHub client with authentication"""
        if self._github_client is None:
            github_token = os.getenv('GITHUB_TOKEN')
            if github_token:
                auth = Auth.Token(github_token)
                self._github_client = Github(auth=auth)
            else:
                # Unauthenticated (limited rate)
                self._github_client = Github()
        return self._github_client
```

### get_user_repositories

```python
def get_user_repositories(
    self,
    username: str | None = None,
    days: int | None = None,  # Default: 30
    limit: int | None = None,  # Default: 10
) -> RepositoryResponse:
    """Get user's repositories with recent updates
    
    Args:
        username: GitHub username (optional, defaults to authenticated user)
        days: Number of days to look for recent updates (default: 30 days)
        limit: Maximum number of repositories to return (default: 10)

    Returns:
        RepositoryResponse with status, repository list, and metadata
    """
    github = self._get_github_client()
    
    if username:
        user = github.get_user(username)
    else:
        user = github.get_user()  # Authenticated user

    repos = []
    cutoff_date = datetime.now() - timedelta(days=days)

    for repo in user.get_repos(sort='updated', direction='desc'):
        if len(repos) >= limit:
            break
        if repo.updated_at >= cutoff_date:
            repos.append(GitHubRepository(
                name=repo.name,
                full_name=repo.full_name,
                description=repo.description,
                url=repo.html_url,
                updated_at=repo.updated_at.isoformat(),
                pushed_at=repo.pushed_at.isoformat() if repo.pushed_at else None,
                language=repo.language,
                stars=repo.stargazers_count,
                forks=repo.forks_count,
            ))

    return RepositoryResponse(
        status='success',
        data=repos,
        count=len(repos),
        message=f'Retrieved {len(repos)} repositories updated in the last {days} days',
    )
```

### get_recent_commits

```python
def get_recent_commits(
    self,
    repo_name: str,  # Format: 'owner/repo'
    days: int | None = None,  # Default: 7
    limit: int | None = None,  # Default: 10
) -> CommitResponse:
    """Get recent commits for a repository

    Args:
        repo_name: Repository name in format 'owner/repo'
        days: Number of days to look for recent commits (default: 7 days)
        limit: Maximum number of commits to return (default: 10)

    Returns:
        CommitResponse with status, commit list, and metadata
    """
    github = self._get_github_client()
    repo = github.get_repo(repo_name)
    
    commits = []
    cutoff_date = datetime.now() - timedelta(days=days)

    for commit in repo.get_commits(since=cutoff_date):
        if len(commits) >= limit:
            break
        commits.append(GitHubCommit(
            sha=commit.sha[:8],
            message=commit.commit.message.split('\n')[0],  # First line only
            author=commit.commit.author.name,
            date=commit.commit.author.date.isoformat(),
            url=commit.html_url,
        ))

    return CommitResponse(
        status='success',
        data=commits,
        count=len(commits),
        message=f'Retrieved {len(commits)} commits for {repo_name} in the last {days} days',
    )
```

### search_repositories

```python
def search_repositories(
    self,
    query: str,
    sort: str | None = None,  # 'updated', 'stars', 'forks' (default: 'updated')
    limit: int | None = None,  # Default: 10
) -> RepositoryResponse:
    """Search for repositories with recent activity

    Args:
        query: Search query string
        sort: Sorting method ('updated', 'stars', 'forks')
        limit: Maximum number of repositories to return (default: 10)

    Returns:
        RepositoryResponse with status, search results, and metadata
    """
    github = self._get_github_client()
    
    # Add recent activity filter
    search_query = f'{query} pushed:>={datetime.now() - timedelta(days=30):%Y-%m-%d}'
    
    repos = []
    results = github.search_repositories(query=search_query, sort=sort, order='desc')

    for repo in results[:limit]:
        repos.append(GitHubRepository(
            name=repo.name,
            full_name=repo.full_name,
            description=repo.description,
            url=repo.html_url,
            updated_at=repo.updated_at.isoformat(),
            pushed_at=repo.pushed_at.isoformat() if repo.pushed_at else None,
            language=repo.language,
            stars=repo.stargazers_count,
            forks=repo.forks_count,
        ))

    return RepositoryResponse(
        status='success',
        data=repos,
        count=len(repos),
        message=f'Found {len(repos)} repositories matching "{query}"',
    )
```

## Agent Creation

```python
def create_agent():
    """Create OpenAI agent and its tools"""
    toolset = GitHubToolset()
    tools = toolset.get_tools()

    return {
        'tools': tools,
        'system_prompt': """...""",  # System prompt above
    }
```

---

## TypeScript Implementation Plan

### Dependencies

```json
{
  "dependencies": {
    "@octokit/rest": "^20.0.0",
    "ai": "6.0.0-beta.99",
    "zod": "^4.1.13"
  }
}
```

### Agent Structure

```typescript
// examples/agents/github-agent/agent.ts

import { ToolLoopAgent, tool } from "ai";
import { Octokit } from "@octokit/rest";
import { z } from "zod";

export function createGitHubAgent(model: LanguageModel) {
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });

  return new ToolLoopAgent({
    model,
    instructions: getGitHubAgentPrompt(),
    tools: {
      get_user_repositories: tool({
        description: "Get user's repositories with recent updates",
        parameters: z.object({
          username: z.string().optional().describe("GitHub username"),
          days: z.number().default(30).describe("Days to look back"),
          limit: z.number().default(10).describe("Max repos to return"),
        }),
        execute: async ({ username, days, limit }) => {
          // Use Octokit to fetch repos...
        },
      }),
      
      get_recent_commits: tool({
        description: "Get recent commits for a repository",
        parameters: z.object({
          repo: z.string().describe("Repository in 'owner/repo' format"),
          days: z.number().default(7).describe("Days to look back"),
          limit: z.number().default(10).describe("Max commits to return"),
        }),
        execute: async ({ repo, days, limit }) => {
          // Use Octokit to fetch commits...
        },
      }),
      
      search_repositories: tool({
        description: "Search for repositories with recent activity",
        parameters: z.object({
          query: z.string().describe("Search query"),
          sort: z.enum(["updated", "stars", "forks"]).default("updated"),
          limit: z.number().default(10).describe("Max results"),
        }),
        execute: async ({ query, sort, limit }) => {
          // Use Octokit to search...
        },
      }),
    },
  });
}
```

### Prompt

```typescript
// examples/agents/github-agent/prompt.ts

export function getGitHubAgentPrompt(): string {
  return `You are a GitHub agent that helps users query information about repositories and project activity.

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
Never make up repository names or statistics.`;
}
```

---

## Environment Variables

```bash
# Required for authenticated access (higher rate limits)
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx

# Optional
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx
```

---

## Testing Examples

```bash
# Get user's recent repos
"Show my repositories updated in the last week"

# Get commits for a specific repo
"What are the recent commits in facebook/react?"

# Search for repos
"Find popular TypeScript projects for building APIs"

# Combined query
"Show me the most starred Python machine learning repos and their recent activity"
```

---

## Checklist for Implementation

- [ ] Create `examples/agents/github-agent/` directory
- [ ] Implement agent with Octokit
- [ ] `get_user_repositories` tool
- [ ] `get_recent_commits` tool
- [ ] `search_repositories` tool
- [ ] Structured response types (Zod schemas)
- [ ] System prompt
- [ ] Agent Card
- [ ] Local server entry point
- [ ] Worker deployment
- [ ] Tests
- [ ] Documentation

