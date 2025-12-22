# A2A Inspector Deployment Guide

## Architecture Overview

The A2A Inspector uses a **hybrid CI/CD architecture** that separates quality gates (GitHub Actions) from deployment (Vercel).

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Pull Request / Push                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    GitHub Actions CI (ci.yml)                            │
│  ┌─────────┐    ┌───────────┐    ┌──────┐    ┌──────┐                   │
│  │  Build  │───▶│ TypeCheck │───▶│ Lint │───▶│ Test │                   │
│  └─────────┘    └───────────┘    └──────┘    └──────┘                   │
│       │                                           │                      │
│       │              Turborepo Cache              │                      │
│       └───────────────────────────────────────────┘                      │
│                           │                                              │
│                           ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  verify-inspector: Ensures inspector CAN build (no deploy)      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                          (All checks must pass)
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     Merge to main branch                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  Vercel GitHub Integration                               │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │  Uses vercel.json configuration:                                │     │
│  │  - installCommand: pnpm install (scoped to inspector deps)      │     │
│  │  - buildCommand: build inspector + deps (runs from repo root)   │     │
│  │  - Skips TS build errors (CI is the source of truth)            │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                               │                                          │
│                               ▼                                          │
│                      Production Deploy                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Configuration Files

### 1. GitHub Actions CI (`.github/workflows/ci.yml`)

**Purpose:** Quality gates that must pass before merge

**Jobs:**
| Job | Purpose | Depends On |
|-----|---------|------------|
| `build` | Build all packages with Turborepo | - |
| `typecheck` | TypeScript validation | build |
| `lint` | Biome linting | build |
| `test` | Vitest unit tests | build |
| `package` | Verify adapter package | typecheck, lint, test |
| `verify-inspector` | Verify inspector builds | typecheck, lint, test |

**Caching:**
- pnpm store cached via `actions/setup-node`
- Turborepo cache via `TURBO_TOKEN` and `TURBO_TEAM`
- Build artifacts cached between jobs

### 2. Vercel Configuration (`vercel.json` at repo root)

```json
{
  "framework": "nextjs",
  "installCommand": "pnpm install --frozen-lockfile --filter a2a-inspector...",
  "buildCommand": "pnpm -r --filter a2a-inspector... run build",
  "outputDirectory": "a2a-inspector/.next",
  "functions": {
    "a2a-inspector/app/api/**/*.ts": {
      "maxDuration": 300
    }
  }
}
```

**Key Points:**
- **File location**: `vercel.json` lives at the **monorepo root** (next to `.vercel/project.json`)
- **Install scope**: `--filter a2a-inspector...` installs only the inspector and its workspace dependency closure
- **Build**: `pnpm -r ... run build` builds the inspector **and** its workspace deps in the correct order
- **Timeouts**: `maxDuration: 300` (5 min) for API routes (Hobby max; Pro/Enterprise + Fluid Compute can go higher)

### 3. Next.js Configuration (`a2a-inspector/next.config.ts`)

```typescript
const nextConfig: NextConfig = {
  turbopack: { root: ".." },
  typescript: { ignoreBuildErrors: true },  // CI handles this
};
```

**Why skip type checking in Vercel?**
- CI already validates types before merge
- Reduces Vercel build time by ~30-60 seconds
- No way to bypass CI checks (branch protection)

### 4. Manual Deploy Workflow (`.github/workflows/deploy-inspector.yml`)

**Purpose:** Manual preview deployments and emergency rollbacks

**When to use:**
- Testing deployment config changes
- Preview deployments from feature branches
- Emergency production rollbacks

## Branch Protection Rules

Configure these in GitHub repository settings for `main` branch:

### Required Settings

- [x] **Require a pull request before merging**
  - [x] Require approvals (recommended: 1)
  - [x] Dismiss stale reviews when new commits are pushed

- [x] **Require status checks to pass before merging**
  - [x] Require branches to be up to date
  - Required checks:
    - `Build`
    - `Type Check`
    - `Lint`
    - `Test`
    - `Verify Inspector Build`

- [x] **Require conversation resolution before merging**

- [x] **Do not allow bypassing the above settings**

### Recommended Settings

- [x] **Restrict who can push to matching branches**
- [x] **Require signed commits** (optional)
- [ ] **Require linear history** (optional, depends on workflow)

## SSE Streaming Configuration

### API Route Configuration

Both API routes use Node.js runtime for full streaming support:

```typescript
// app/api/[[...slugs]]/route.ts
export const runtime = "nodejs";
export const maxDuration = 300;

// /api/ai-sdk-chat is handled by Elysia (server/routes/ai-sdk-chat.ts)
```

### Headers for Streaming

We intentionally **do not** hardcode streaming headers in `next.config.ts`:

- The AI SDK streaming helpers set the correct response headers for streaming.
- Vercel’s edge network supports streaming without nginx-style buffering controls.

### Fluid Compute

API routes are configured for Vercel Fluid Compute:

- **maxDuration:** 300 seconds (5 minutes) - configured in both `vercel.json` and route exports
  - Hobby plan max: 300 seconds
  - Pro/Enterprise with Fluid Compute: up to 800 seconds
- **Runtime:** Node.js (required for Elysia's dynamic code generation)
- **Streaming:** Full SSE support (AI SDK streaming + Node.js runtime)

To enable longer timeouts on Pro/Enterprise:
1. Enable Fluid Compute in Vercel dashboard (Settings → Functions → Fluid Compute)
2. Update `maxDuration` in route files and vercel.json to desired value (up to 800)

## Troubleshooting

### Build Fails on Vercel but Passes CI

1. Check that `vercel.json` exists at the monorepo root and the build runs from repo root
2. Verify Turborepo cache is working (`TURBO_TOKEN` configured)
3. Check for monorepo path issues in error messages

### Type Errors in Vercel Build

This shouldn't happen since `ignoreBuildErrors: true` is set. If it does:

1. Verify `next.config.ts` has `typescript.ignoreBuildErrors: true`
2. Check that CI is actually running type checks
3. Ensure branch protection is enforced

### SSE Streaming Not Working

1. Verify `runtime = "nodejs"` in API routes
2. Check headers in browser DevTools
3. Ensure `maxDuration` is sufficient for your use case
4. Check for proxy/CDN buffering issues

### Manual Deploy Workflow Fails

1. Verify Vercel secrets are configured:
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`
   - `VERCEL_INSPECTOR_PROJECT_ID`
2. Check Turborepo remote cache secrets:
   - `TURBO_TOKEN`
   - `TURBO_TEAM`

## Environment Variables

### GitHub Actions Secrets

| Secret | Purpose |
|--------|---------|
| `TURBO_TOKEN` | Turborepo remote cache authentication |
| `TURBO_TEAM` | Turborepo team identifier |
| `VERCEL_TOKEN` | Vercel API authentication |
| `VERCEL_ORG_ID` | Vercel organization ID |
| `VERCEL_INSPECTOR_PROJECT_ID` | Vercel project ID for inspector |

### Vercel Environment Variables

Configure in Vercel dashboard for the a2a-inspector project:

| Variable | Environment | Purpose |
|----------|-------------|---------|
| `NEXT_PUBLIC_*` | All | Client-side configuration |
| API keys | Production/Preview | Backend integrations |

## Local Development

```bash
# Start inspector in development mode
pnpm inspector

# Build inspector locally
pnpm inspector:build

# Run type checking
pnpm inspector:typecheck

# Run linting
pnpm inspector:lint

# Run tests
pnpm inspector:test
```

## Deployment Checklist

Before deploying to production:

- [ ] All CI checks pass on the PR
- [ ] PR has been reviewed and approved
- [ ] No merge conflicts with main
- [ ] Environment variables are configured in Vercel
- [ ] Branch protection rules are enforced

After deployment:

- [ ] Verify deployment URL is accessible
- [ ] Test SSE streaming functionality
- [ ] Check for console errors
- [ ] Verify API routes respond correctly

