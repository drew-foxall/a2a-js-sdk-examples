# Release Process

This document describes the automated release process for `@drew-foxall/a2a-ai-sdk-adapter`.

## Overview

Releases are automated via GitHub Actions and triggered by pushing a version tag. The CI/CD pipeline ensures all checks pass before publishing to npm.

## Prerequisites

1. **NPM Token**: Add `NPM_TOKEN` to GitHub repository secrets
   - Go to: Repository Settings → Secrets and variables → Actions → New repository secret
   - Name: `NPM_TOKEN`
   - Value: Your npm authentication token (create at https://www.npmjs.com/settings/YOUR_USERNAME/tokens)
   - Use **Automation** token type with **publish** permissions

2. **Permissions**: Repository must have the following GitHub Actions permissions:
   - Read repository contents
   - Write releases
   - Write packages (for provenance)

## Release Steps

### 1. Update Version

```bash
# Navigate to the adapter package
cd packages/a2a-ai-sdk-adapter

# Update version (choose one):
pnpm version patch  # 1.0.0 → 1.0.1
pnpm version minor  # 1.0.0 → 1.1.0
pnpm version major  # 1.0.0 → 2.0.0

# Or manually update package.json and run:
pnpm version --no-git-tag-version
```

### 2. Update CHANGELOG

Edit `packages/a2a-ai-sdk-adapter/CHANGELOG.md` and add release notes for the new version:

```markdown
## [1.0.2] - 2025-11-25

### Added
- New feature X
- Improved Y

### Fixed
- Bug Z

### Changed
- Refactored component A
```

### 3. Commit Changes

```bash
# From repository root
git add packages/a2a-ai-sdk-adapter/package.json
git add packages/a2a-ai-sdk-adapter/CHANGELOG.md
git commit -m "chore(adapter): bump version to 1.0.2"
```

### 4. Create and Push Tag

```bash
# Create tag matching the package version
git tag @drew-foxall/a2a-ai-sdk-adapter@1.0.2

# Or use the shorthand format:
git tag v1.0.2

# Push commits and tag
git push origin main
git push origin @drew-foxall/a2a-ai-sdk-adapter@1.0.2
```

### 5. Monitor Release

The GitHub Actions workflow will automatically:

1. ✅ **Run CI checks**:
   - Type checking (TypeScript)
   - Linting (Biome)
   - Testing (Vitest)
   - Building (tsc)

2. ✅ **Verify version match**:
   - Ensure `package.json` version matches the git tag

3. ✅ **Publish to npm**:
   - Build the package
   - Publish with provenance
   - Public access (scoped package)

4. ✅ **Create GitHub Release**:
   - Generate release notes
   - Link to npm package

### 6. Verify Publication

Check that the package is published:

```bash
# View published versions
npm info @drew-foxall/a2a-ai-sdk-adapter

# Or open in browser
open https://www.npmjs.com/package/@drew-foxall/a2a-ai-sdk-adapter
```

## Tag Formats

The release workflow supports two tag formats:

1. **Scoped format** (recommended):
   ```
   @drew-foxall/a2a-ai-sdk-adapter@1.0.2
   ```

2. **Simple format**:
   ```
   v1.0.2
   ```

Both formats work, but the scoped format is more explicit in a monorepo.

## CI/CD Pipeline

### Continuous Integration (`.github/workflows/ci.yml`)

Runs on every push and pull request to `main` or `develop`:

- ✅ Type checking
- ✅ Linting
- ✅ Testing
- ✅ Building
- ✅ Package verification

This protects the main branch from broken code.

### Release Pipeline (`.github/workflows/release.yml`)

Triggers on version tags:

1. **Checkout & Setup**: Clone repo, install pnpm, setup Node.js
2. **Install Dependencies**: `pnpm install --frozen-lockfile`
3. **Extract Version**: Parse version from git tag
4. **Verify Version**: Ensure tag matches `package.json`
5. **Run CI**: Type check, lint, test, build
6. **Publish**: `npm publish --access public --provenance`
7. **Create Release**: GitHub release with changelog

## Troubleshooting

### Version Mismatch Error

**Error**: `Version mismatch! Package version (1.0.1) does not match tag version (1.0.2)`

**Fix**: Ensure `package.json` version matches the git tag:
```bash
# Check package version
cat packages/a2a-ai-sdk-adapter/package.json | grep version

# Re-tag with correct version
git tag -d @drew-foxall/a2a-ai-sdk-adapter@1.0.2
git tag @drew-foxall/a2a-ai-sdk-adapter@1.0.1
git push origin :refs/tags/@drew-foxall/a2a-ai-sdk-adapter@1.0.2
git push origin @drew-foxall/a2a-ai-sdk-adapter@1.0.1
```

### NPM Publish Failed

**Error**: `npm ERR! code ENEEDAUTH`

**Fix**: Verify `NPM_TOKEN` secret is set correctly in GitHub repository settings.

### Tests Failed

**Error**: `Test suite failed`

**Fix**: Run tests locally before creating tag:
```bash
pnpm --filter @drew-foxall/a2a-ai-sdk-adapter test
```

### Build Failed

**Error**: `Build failed with errors`

**Fix**: Run full CI pipeline locally:
```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Rollback

If a release needs to be rolled back:

1. **Deprecate the broken version**:
   ```bash
   npm deprecate @drew-foxall/a2a-ai-sdk-adapter@1.0.2 "Broken release, use 1.0.1 instead"
   ```

2. **Publish a fixed version**:
   ```bash
   # Update version
   cd packages/a2a-ai-sdk-adapter
   pnpm version patch  # 1.0.2 → 1.0.3
   
   # Follow release steps above
   ```

3. **Delete the GitHub release** (optional):
   - Go to: Repository → Releases
   - Delete the broken release

**Note**: You cannot unpublish from npm after 72 hours. Use deprecation instead.

## Best Practices

1. ✅ **Always update CHANGELOG.md** before releasing
2. ✅ **Run tests locally** before creating a tag
3. ✅ **Use semantic versioning**: MAJOR.MINOR.PATCH
4. ✅ **Write clear commit messages**: `feat:`, `fix:`, `chore:`
5. ✅ **Test the published package** after release:
   ```bash
   npm install @drew-foxall/a2a-ai-sdk-adapter@latest
   ```
6. ✅ **Keep main branch stable**: Only merge tested PRs
7. ✅ **Document breaking changes**: In CHANGELOG and release notes

## Manual Publishing (Emergency Only)

If GitHub Actions is unavailable, publish manually:

```bash
cd packages/a2a-ai-sdk-adapter

# Ensure clean build
rm -rf dist
pnpm install
pnpm build

# Verify package contents
pnpm pack
tar -tzf drew-foxall-a2a-ai-sdk-adapter-*.tgz

# Publish
npm publish --access public
```

**Important**: Manual publishing won't include:
- Automated provenance
- GitHub release
- CI verification

Only use this in emergencies.

## Additional Resources

- [npm Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [Semantic Versioning](https://semver.org/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Turborepo Caching](https://turbo.build/repo/docs/core-concepts/caching)

