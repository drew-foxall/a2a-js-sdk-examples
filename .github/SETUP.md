# GitHub Actions Setup

This document explains how to configure the GitHub Actions workflows for CI/CD.

## Required Secrets

### NPM_TOKEN

The release workflow requires an npm authentication token to publish packages.

#### Steps to Create NPM Token:

1. **Login to npm**:
   ```bash
   npm login
   ```

2. **Generate an Automation Token**:
   - Go to https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   - Click "Generate New Token"
   - Select **"Automation"** token type
   - Give it a descriptive name (e.g., "GitHub Actions - a2a-js-sdk-examples")
   - Click "Generate Token"
   - **Copy the token** (you won't see it again!)

3. **Add Token to GitHub Repository**:
   - Go to your repository on GitHub
   - Navigate to: **Settings** → **Secrets and variables** → **Actions**
   - Click **"New repository secret"**
   - Name: `NPM_TOKEN`
   - Value: Paste the token from step 2
   - Click **"Add secret"**

### Vercel Deployment Secrets (Required for A2A Inspector)

The deploy-inspector workflow requires Vercel authentication to deploy the a2a-inspector.

#### Required Secrets:

| Secret | Description |
|--------|-------------|
| `VERCEL_TOKEN` | Vercel API token for deployments |
| `VERCEL_ORG_ID` | Your Vercel organization/team ID |
| `VERCEL_INSPECTOR_PROJECT_ID` | Project ID for a2a-inspector |

#### Steps to Configure:

1. **Get your Vercel Token**:
   - Go to https://vercel.com/account/tokens
   - Click "Create Token"
   - Name: "GitHub Actions - A2A Inspector Deploy"
   - Scope: Full Account (or specific team)
   - Click "Create"
   - **Copy the token**

2. **Get your Org ID and Project ID**:
   
   Option A - Link the project locally:
   ```bash
   cd a2a-inspector
   pnpm add -g vercel
   vercel link
   # This creates .vercel/project.json with orgId and projectId
   cat .vercel/project.json
   ```
   
   Option B - From Vercel Dashboard:
   - **Org ID**: Found in team settings URL `vercel.com/teams/TEAM_SLUG/settings` → General → "Team ID"
   - **Project ID**: Found in project settings → General → "Project ID"

3. **Add Secrets to GitHub**:
   - Go to: Repository **Settings** → **Secrets and variables** → **Actions**
   - Add these secrets:
     - `VERCEL_TOKEN`: Your Vercel token from step 1
     - `VERCEL_ORG_ID`: Your organization/team ID from step 2
     - `VERCEL_INSPECTOR_PROJECT_ID`: The project ID for a2a-inspector

### TURBO_TOKEN & TURBO_TEAM (Required for Remote Caching)

Turborepo remote caching dramatically speeds up CI by sharing build artifacts across runs.

#### Steps to Configure Turbo Remote Cache:

1. **Login to Turbo** (locally):
   ```bash
   pnpm turbo login
   pnpm turbo link
   ```

2. **Get your Vercel Token**:
   - Go to https://vercel.com/account/tokens
   - Click "Create Token"
   - Name: "GitHub Actions - Turbo Cache"
   - Scope: Full Account (or specific team)
   - Click "Create"
   - **Copy the token**

3. **Get your Team ID**:
   - Check your local `.turbo/config.json` after running `turbo link`
   - Or find it in your Vercel dashboard URL: `vercel.com/team_XXXXX`

4. **Add Secrets to GitHub**:
   - `TURBO_TOKEN`: Your Vercel token from step 2
   - `TURBO_TEAM`: Your team ID (e.g., `team_zLtiRvigKDHTbeVpusAxIUmN`)

## Workflows

### CI Workflow (`.github/workflows/ci.yml`)

**Triggers**: Push or Pull Request to `main` or `develop` branches

**Pipeline Architecture**:

```
┌─────────┐
│  Build  │  ← Stage 1: Build all packages
└────┬────┘
     │
     ├──────────────┬──────────────┐
     ▼              ▼              ▼
┌─────────┐   ┌─────────┐   ┌─────────┐
│Typecheck│   │  Lint   │   │  Test   │  ← Stage 2: Parallel validation
└────┬────┘   └────┬────┘   └────┬────┘
     │              │              │
     └──────────────┼──────────────┘
                    ▼
              ┌─────────┐
              │ Package │  ← Stage 3: Verify adapter package
              └─────────┘
```

**Jobs**:

1. **Build** - Builds all packages (required first for Turbo cache)
2. **Typecheck** - Type checks all packages (parallel)
3. **Lint** - Lints all packages (parallel)
4. **Test** - Runs all tests (parallel)
5. **Package** - Verifies adapter package can be packed and uploaded

**Benefits**:
- ✅ Parallel execution of typecheck, lint, and test
- ✅ Turbo remote cache for instant rebuilds
- ✅ Fast feedback on failures (parallel jobs fail fast)
- ✅ Clear pipeline visualization in GitHub Actions UI

### Deploy Inspector Workflow (`.github/workflows/deploy-inspector.yml`)

**Triggers**: 
- Push to `main` branch (changes to `a2a-inspector/**` or `packages/a2a-ai-provider-v3/**`)
- Pull Request to `main` branch (same paths)
- Manual dispatch (workflow_dispatch)

**Pipeline Architecture**:

```
┌─────────────────────────────────────────────────────┐
│                    Deploy Job                        │
├─────────────────────────────────────────────────────┤
│  1. Checkout repository                              │
│  2. Setup pnpm + Node.js + Bun                      │
│  3. Install dependencies                             │
│  4. Build workspace dependencies (Turbo)            │
│  5. Pull Vercel environment                          │
│  6. Build with Vercel CLI                           │
│  7. Deploy with --prebuilt flag                     │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼ (PR only)
┌─────────────────────────────────────────────────────┐
│                  Comment Job                         │
├─────────────────────────────────────────────────────┤
│  Post/update PR comment with deployment URL         │
└─────────────────────────────────────────────────────┘
```

**Environments**:
- **Preview**: Pull requests and manual triggers (default)
- **Production**: Push to `main` branch or manual trigger with `production`

**Key Features**:
- ✅ Uses Bun runtime for Next.js build
- ✅ Builds locally, uploads prebuilt to Vercel (faster, no source exposure)
- ✅ Automatic PR comments with deployment URL
- ✅ Path-filtered triggers (only runs when inspector changes)
- ✅ Supports manual production deploys

### Release Workflow (`.github/workflows/release.yml`)

**Triggers**: Push of version tags matching:
- `v*.*.*` (e.g., `v1.0.2`)
- `@drew-foxall/a2a-ai-sdk-adapter@*.*.*` (e.g., `@drew-foxall/a2a-ai-sdk-adapter@1.0.2`)

**Steps**:
1. Checkout repository
2. Setup pnpm and Node.js
3. Install dependencies
4. Extract version from git tag
5. Verify `package.json` version matches tag
6. Run full CI pipeline (type check, lint, test, build)
7. Publish to npm with provenance
8. Create GitHub Release

**Purpose**: Automates npm publishing and release notes.

## Permissions

The repository needs the following permissions for GitHub Actions:

### Required Permissions:
- ✅ **Read repository contents** - Enabled by default
- ✅ **Write releases** - For creating GitHub releases
- ✅ **Write packages** - For npm provenance (supply chain security)

### How to Check Permissions:

1. Go to: Repository **Settings** → **Actions** → **General**
2. Under "Workflow permissions":
   - Select: **"Read and write permissions"**
   - Check: ✅ **"Allow GitHub Actions to create and approve pull requests"** (optional)
3. Click **"Save"**

## Turborepo Remote Caching

The workflows leverage Turborepo for intelligent caching:

- ✅ **Remote caching**: Share cache across CI runs via Vercel
- ✅ **Dependency tracking**: Only rebuilds what changed
- ✅ **Parallel execution**: Runs independent tasks simultaneously
- ✅ **Content-addressable**: Cache keys based on file content, not timestamps

### Expected Performance Improvements:

| Scenario | Without Cache | With Cache |
|----------|---------------|------------|
| Full rebuild | ~8-10 min | ~8-10 min |
| No changes | ~8-10 min | **~2-3 min** |
| Minor change | ~8-10 min | **~3-4 min** |
| PR after main build | ~8-10 min | **~2-3 min** |

### Verifying Cache is Working:

In your GitHub Actions logs, look for:
```
cache hit, replaying logs...
```

Or cache miss (first run):
```
cache miss, executing...
```

## Testing Workflows Locally

### Option 1: Act (GitHub Actions Locally)

Install [act](https://github.com/nektos/act):

```bash
brew install act  # macOS
```

Run CI workflow:

```bash
# Run CI workflow
act push -W .github/workflows/ci.yml

# Run with secrets
act push -W .github/workflows/ci.yml \
  -s NPM_TOKEN=your-token \
  -s TURBO_TOKEN=your-turbo-token \
  -s TURBO_TEAM=your-team-id
```

### Option 2: Manual Testing

Run the same commands locally:

```bash
# Full CI pipeline
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm lint
pnpm test

# Adapter-specific verification
pnpm --filter @drew-foxall/a2a-ai-sdk-adapter build
pnpm --filter @drew-foxall/a2a-ai-sdk-adapter pack
```

## Monitoring Workflows

### View Workflow Runs:

1. Go to repository **Actions** tab
2. Select a workflow (CI or Release)
3. Click on a specific run to view logs

### Understanding the Pipeline View:

The CI workflow shows a visual pipeline:
- Jobs in the same column run in parallel
- Jobs connected by arrows have dependencies
- Green ✓ = passed, Red ✗ = failed, Yellow ○ = running

### Debugging Failed Workflows:

1. **Check the logs**: Click on the failed job → Expand failed step
2. **Re-run the workflow**: Click "Re-run jobs" → "Re-run all jobs"
3. **Run locally**: Use the same commands from the workflow
4. **Enable debug logging**: 
   - Go to: Repository **Settings** → **Secrets**
   - Add secret: `ACTIONS_STEP_DEBUG` = `true`

## Status Badges

Add these badges to your README:

```markdown
[![CI](https://github.com/drew-foxall/a2a-js-sdk-examples/actions/workflows/ci.yml/badge.svg)](https://github.com/drew-foxall/a2a-js-sdk-examples/actions/workflows/ci.yml)

[![Deploy Inspector](https://github.com/drew-foxall/a2a-js-sdk-examples/actions/workflows/deploy-inspector.yml/badge.svg)](https://github.com/drew-foxall/a2a-js-sdk-examples/actions/workflows/deploy-inspector.yml)

[![Release](https://github.com/drew-foxall/a2a-js-sdk-examples/actions/workflows/release.yml/badge.svg)](https://github.com/drew-foxall/a2a-js-sdk-examples/actions/workflows/release.yml)

[![npm version](https://badge.fury.io/js/@drew-foxall%2Fa2a-ai-sdk-adapter.svg)](https://www.npmjs.com/package/@drew-foxall/a2a-ai-sdk-adapter)
```

## Security Best Practices

1. ✅ **Use Automation tokens** (not Classic or Publish tokens)
2. ✅ **Limit token scope** to only publishing
3. ✅ **Rotate tokens regularly** (every 6-12 months)
4. ✅ **Enable 2FA** on your npm account
5. ✅ **Review published packages** after each release
6. ✅ **Use provenance** for supply chain security (already enabled)
7. ✅ **Keep secrets secret** (never commit them!)

## Troubleshooting

### Workflow Not Triggering

**Problem**: Release workflow doesn't run when pushing a tag.

**Solution**: Check that:
- Tag format matches `v*.*.*` or `@drew-foxall/a2a-ai-sdk-adapter@*.*.*`
- Tag was pushed: `git push origin TAG_NAME`
- Workflow file is on the default branch

### NPM Publish Failed

**Problem**: `npm ERR! code ENEEDAUTH`

**Solution**:
- Verify `NPM_TOKEN` secret is set correctly
- Regenerate the token if it expired
- Ensure token has **publish** permissions

### Version Mismatch Error

**Problem**: "Version mismatch! Package version (1.0.1) does not match tag version (1.0.2)"

**Solution**:
- Update `package.json` version to match the tag
- Or re-tag with the correct version from `package.json`

### Tests Failed in CI but Pass Locally

**Problem**: Tests pass locally but fail in GitHub Actions.

**Solution**:
- Check environment variables (CI doesn't have your `.env`)
- Verify Node.js version matches (workflow uses Node LTS)
- Ensure pnpm lockfile is committed
- Check for timing-dependent tests

### Turbo Cache Not Working

**Problem**: Seeing "cache miss" on every run.

**Solution**:
- Verify `TURBO_TOKEN` and `TURBO_TEAM` secrets are set
- Check token hasn't expired
- Ensure `.turbo/config.json` has correct team ID locally
- Run `pnpm turbo login --force` to refresh credentials

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [npm Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [Turborepo Remote Caching](https://turbo.build/repo/docs/core-concepts/remote-caching)
- [pnpm CI Guide](https://pnpm.io/continuous-integration)
