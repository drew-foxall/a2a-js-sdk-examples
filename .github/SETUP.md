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

## Workflows

### CI Workflow (`.github/workflows/ci.yml`)

**Triggers**: Push or Pull Request to `main` or `develop` branches

**Jobs**:
1. **CI** - Runs on all packages:
   - Type checking (`pnpm typecheck`)
   - Linting (`pnpm lint`)
   - Building (`pnpm build`)
   - Testing (`pnpm test`)

2. **Adapter Package** - Focused verification of the adapter package:
   - Build adapter
   - Type check adapter
   - Lint adapter
   - Test adapter
   - Pack adapter and verify contents
   - Upload package artifact

**Purpose**: Protects main branch from broken code.

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
7. Build adapter package
8. Publish to npm with provenance
9. Create GitHub Release with changelog

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
act push -W .github/workflows/ci.yml -s NPM_TOKEN=your-token-here
```

### Option 2: Manual Testing

Run the same commands locally:

```bash
# Full CI pipeline
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm build
pnpm test

# Adapter-specific verification
pnpm --filter @drew-foxall/a2a-ai-sdk-adapter build
pnpm --filter @drew-foxall/a2a-ai-sdk-adapter typecheck
pnpm --filter @drew-foxall/a2a-ai-sdk-adapter lint
pnpm --filter @drew-foxall/a2a-ai-sdk-adapter test
pnpm --filter @drew-foxall/a2a-ai-sdk-adapter pack
```

## Turborepo Caching

The workflows leverage Turborepo for intelligent caching:

- ✅ **Local caching**: Speeds up repeated builds
- ✅ **Remote caching**: Share cache across CI runs (optional, requires Vercel account)
- ✅ **Dependency tracking**: Only rebuilds what changed
- ✅ **Parallel execution**: Runs independent tasks simultaneously

### Enable Remote Caching (Optional):

1. Sign up at https://vercel.com/
2. Get your team token: https://vercel.com/account/tokens
3. Add to GitHub Secrets:
   - Name: `TURBO_TOKEN`
   - Value: Your Vercel token
4. Add your team ID:
   - Name: `TURBO_TEAM`
   - Value: Your team ID (find in Vercel dashboard)

Then update workflows to include:
```yaml
env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ secrets.TURBO_TEAM }}
```

## Monitoring Workflows

### View Workflow Runs:

1. Go to repository **Actions** tab
2. Select a workflow (CI or Release)
3. Click on a specific run to view logs

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
- Verify Node.js version matches (workflow uses Node LTS - currently v24.x Krypton)
- Ensure pnpm lockfile is committed
- Check for timing-dependent tests

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [npm Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [Turborepo Documentation](https://turbo.build/repo/docs)
- [pnpm CI Guide](https://pnpm.io/continuous-integration)

