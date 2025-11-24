# A2A Inspector Setup (Docker)

This project uses **Docker** to run the A2A Inspector, making it portable and easy to set up without managing Python/Node.js dependencies.

## Prerequisites

- **Docker Desktop** (macOS/Windows) or **Docker Engine** (Linux)
  - macOS: https://docs.docker.com/desktop/install/mac-install/
  - Linux: https://docs.docker.com/engine/install/
  - Windows: https://docs.docker.com/desktop/install/windows-install/

## Quick Start

```bash
# Start the inspector (auto-builds on first run)
pnpm inspector

# Stop the inspector
pnpm inspector:stop

# View logs
pnpm inspector:logs

# View live logs
pnpm inspector:logs --follow
```

## How It Works

1. **Image Building** (first run only, ~2-3 minutes):
   - Automatically builds the `a2a-inspector` Docker image from GitHub
   - Includes all dependencies (Python, Node.js, etc.)
   - Stored locally for future use

2. **Container Running**:
   - Runs the inspector in a Docker container named `a2a-inspector`
   - Maps container port `8080` to host port `5001`
   - Access at: `http://127.0.0.1:5001`

3. **Process Management**:
   - Container runs in detached mode (background)
   - Persists until explicitly stopped
   - Easy cleanup with `pnpm inspector:stop`

## Benefits of Docker Approach

✅ **No Local Dependencies**
- No need for Python 3.10+, uv, or Node.js
- Everything is self-contained in the image

✅ **Reproducible**
- Works identically on all machines
- No "works on my machine" issues

✅ **Clean Environment**
- No files outside the project directory
- Easy cleanup: just remove the container

✅ **Version Control**
- Image built from specific GitHub commit
- Rebuild anytime with: `docker rmi a2a-inspector && pnpm inspector`

## Commands

### Start Inspector
```bash
pnpm inspector
# or
pnpm dev:inspector
```

Starts the inspector container. On first run, builds the image (~2-3 minutes).

### Stop Inspector
```bash
pnpm inspector:stop
```

Stops and removes the running container.

### View Logs
```bash
# Last 100 lines
pnpm inspector:logs

# Follow live logs
pnpm inspector:logs --follow
```

### Rebuild Image
```bash
# Remove existing image
docker rmi a2a-inspector

# Next pnpm inspector will rebuild
pnpm inspector
```

## Integrated Testing

The `pnpm start-testing` command automatically:
1. Checks if Docker is available
2. Starts the inspector container
3. Waits for it to be healthy
4. Starts your selected agent(s)
5. Opens the browser to the inspector
6. Displays the agent URL to copy/paste

See [DEV_TESTING.md](./DEV_TESTING.md) for details.

## Troubleshooting

### Docker not found
```bash
# Install Docker first, then verify
docker --version
```

### Port 5001 already in use
```bash
# Find what's using the port
lsof -i :5001

# Or stop our inspector first
pnpm inspector:stop
```

### Container won't start
```bash
# View detailed logs
docker logs a2a-inspector

# Remove and rebuild
docker rm -f a2a-inspector
docker rmi a2a-inspector
pnpm inspector
```

### Image build fails
```bash
# Check Docker disk space
docker system df

# Clean up old images/containers
docker system prune
```

## Manual Docker Commands

If you prefer using Docker directly:

```bash
# Build image
docker build -t a2a-inspector https://github.com/a2aproject/a2a-inspector.git

# Run container
docker run -d --name a2a-inspector -p 5001:8080 a2a-inspector

# Stop container
docker stop a2a-inspector

# Remove container
docker rm a2a-inspector

# View logs
docker logs a2a-inspector

# Access shell inside container
docker exec -it a2a-inspector /bin/bash
```

## Previous Approach (Deprecated)

Previously, the inspector was run from a local clone at `~/Development/a2a-inspector` with Python/Node.js dependencies. This approach had issues:
- ❌ Required external directory setup
- ❌ Python and Node.js version management
- ❌ Not portable across machines
- ❌ Difficult for new contributors

The Docker approach solves all of these issues.
