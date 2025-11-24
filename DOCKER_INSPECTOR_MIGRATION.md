# Migration to Docker-Based Inspector

## Overview

We've migrated from a local clone-based approach to a **Docker-based approach** for running the A2A Inspector. This makes the setup more portable, reproducible, and eliminates external dependencies.

## What Changed

### Before (Local Clone)
```bash
# Setup (manual, outside project)
cd ~/Development
git clone https://github.com/a2aproject/a2a-inspector.git
cd a2a-inspector
uv sync  # Python dependencies
cd frontend && npm install  # Node dependencies

# Run (from project)
pnpm inspector
```

**Issues:**
- ❌ Required Python 3.10+ and uv
- ❌ Required Node.js and npm
- ❌ Files outside project directory
- ❌ Not reproducible across machines
- ❌ Version management complexity

### After (Docker)
```bash
# Setup (automatic, self-contained)
pnpm inspector  # Builds Docker image on first run

# Run (always)
pnpm inspector
```

**Benefits:**
- ✅ No Python/Node.js dependencies
- ✅ Self-contained in Docker image
- ✅ Works identically everywhere
- ✅ Easy cleanup
- ✅ Version controlled via Docker image

## Technical Details

### Image Building

On first run, `pnpm inspector` automatically:
1. Checks if Docker is available
2. Builds the `a2a-inspector` image from GitHub
3. Starts a container named `a2a-inspector`
4. Maps port 5001 (host) → 8080 (container)

```typescript
// scripts/start-inspector.ts
docker build -t a2a-inspector https://github.com/a2aproject/a2a-inspector.git
docker run -d --name a2a-inspector -p 5001:8080 a2a-inspector
```

### Container Management

- **Start**: `pnpm inspector` or `pnpm dev:inspector`
- **Stop**: `pnpm inspector:stop`
- **Logs**: `pnpm inspector:logs` or `pnpm inspector:logs --follow`
- **Access**: http://127.0.0.1:5001

### Integration with `pnpm start-testing`

The `dev-test.ts` script now:
1. Checks for Docker availability (not local directory)
2. Starts the inspector container (via `pnpm dev:inspector`)
3. Waits for port 5001 to be responsive
4. Starts agent(s)
5. Opens browser with agent URL to copy/paste

## Files Modified

### New Scripts (Docker-based)
- `scripts/start-inspector.ts` - Start inspector container
- `scripts/stop-inspector.ts` - Stop inspector container
- `scripts/inspector-logs.ts` - View container logs

### Updated Scripts
- `scripts/dev-test.ts` - Now checks for Docker instead of local directory

### Updated Documentation
- `INSPECTOR_SETUP.md` - Complete Docker setup guide
- `DEV_TESTING.md` - Updated testing workflow
- `package.json` - Updated help text for Docker

### New Documentation
- `DOCKER_INSPECTOR_MIGRATION.md` - This file

## Migration Path for Existing Users

If you have an existing local clone at `~/Development/a2a-inspector`:

```bash
# Old clone is no longer needed
rm -rf ~/Development/a2a-inspector  # Optional cleanup

# Just use the new Docker approach
pnpm inspector
```

The Docker image will be built automatically on first run (~2-3 minutes).

## Troubleshooting

### "Docker is not available"
Install Docker Desktop or Docker Engine first:
- macOS: https://docs.docker.com/desktop/install/mac-install/
- Linux: https://docs.docker.com/engine/install/
- Windows: https://docs.docker.com/desktop/install/windows-install/

### "Port 5001 already in use"
```bash
# Find what's using the port
lsof -i :5001

# Or stop our inspector
pnpm inspector:stop
```

### Image build fails
```bash
# Check Docker space
docker system df

# Clean up if needed
docker system prune

# Rebuild
docker rmi a2a-inspector
pnpm inspector
```

### Want to rebuild with latest inspector code
```bash
# Remove old image
docker rmi a2a-inspector

# Next start will rebuild
pnpm inspector
```

## Backward Compatibility

**None required!** The old local clone approach is completely replaced. If users have the old setup, it's simply ignored and the Docker approach is used instead.

## Future Enhancements

### Possible Additions
1. **URL Parameter Support**: Modify the inspector frontend to accept `?agent=<url>` query parameter for auto-loading agents
2. **Custom Ports**: Allow `INSPECTOR_PORT` env var for custom port mapping
3. **Volume Mounts**: Mount agent directories for direct file access
4. **Docker Compose**: Orchestrate inspector + agents together

### Image Optimization
- Use multi-stage builds to reduce image size
- Cache layers for faster rebuilds
- Pre-built images on Docker Hub

## Commit

This change is part of the orchestrator refactoring commit:

```bash
git commit -m "refactor: migrate to Docker-based inspector

- Replace local clone approach with Docker containers
- Auto-build image from GitHub on first run
- Eliminate Python/Node.js dependencies for users
- Improve portability and reproducibility
- Update all scripts and documentation

Benefits:
- Self-contained inspector in Docker
- Works identically on all machines
- Easy cleanup (no external files)
- Simpler onboarding for contributors
"
```

## Conclusion

The Docker migration makes the A2A Inspector:
- **Easier to use**: No manual setup steps
- **More portable**: Works everywhere Docker runs
- **Self-contained**: No external dependencies
- **Maintainable**: Simple version management
- **Professional**: Industry-standard approach

This aligns with modern development practices and significantly improves the developer experience for anyone working with A2A agents.

