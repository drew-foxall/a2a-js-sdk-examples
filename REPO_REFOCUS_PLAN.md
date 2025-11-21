# Repository Refocus Plan

## Executive Summary

Transform `a2a-js-sdk-examples` into a dual-purpose repository:
1. **Primary**: Publish `@drew-foxall/a2a-adapter` NPM package
2. **Secondary**: Demonstrate the adapter through working agent examples

This plan ensures the repository complements [a2a-samples](https://github.com/a2aproject/a2a-samples) as a JavaScript-first alternative with enterprise-grade TypeScript tooling.

---

## Current State Analysis

### Repository Structure (Current)
```
a2a-js-sdk-examples/
├── samples/js/
│   ├── src/
│   │   ├── agents/        # 9 agent examples
│   │   └── shared/
│   │       └── a2a-adapter.ts  # ⚠️ Not publishable (buried in examples)
│   └── package.json
├── demo/                  # Empty
├── extensions/            # Empty
├── notebooks/             # Empty
└── package.json           # Root workspace
```

### Key Findings

#### ✅ No Python Dependency Required
- **Discovery**: a2a-samples uses Python only for the demo UI (Mesop web app)
- **Agent Testing**: Can be done with:
  - `curl` (agent card + A2A endpoints)
  - [a2a-inspector](https://github.com/a2aproject/a2a-inspector) (UI tool)
  - Any A2A client
- **Recommendation**: Python is NOT required for testing A2A agents

#### ⚠️ Adapter Not Publishable
- `a2a-adapter.ts` is currently in `samples/js/src/shared/`
- Buried 4 levels deep in examples
- No independent package.json
- Cannot be published to NPM as-is

#### ✅ Strong Type Safety Foundation
- Using `@total-typescript/tsconfig` (strict rules)
- Biome for linting/formatting
- Zero `any` types in adapter (1,089 lines, all typed)
- Ready for publication

#### 📦 Build System Clarification
- User mentioned "Turbopack" but likely meant **Turborepo**:
  - **Turbopack**: Next.js's bundler (not applicable here)
  - **Turborepo**: Monorepo build orchestrator (what we need)
  - **Alternative**: pnpm workspaces (already using this)

---

## Goals & Requirements

### Primary Goal: NPM Package
- [x] Extract `a2a-adapter.ts` to standalone package
- [x] Add comprehensive documentation
- [x] Set up build pipeline (TSC)
- [x] Publish to NPM as `@drew-foxall/a2a-adapter`
- [x] Version semantically (start at 1.0.0)

### Secondary Goal: Examples
- [x] All 9 agents import from `@drew-foxall/a2a-adapter` (not local path)
- [x] Each agent can be started independently
- [x] Agent cards accessible at `/.well-known/agent-card.json`
- [x] Documentation mirrors a2a-samples approach

### Testing Goals
- [x] Test agents WITHOUT Python dependency
- [x] Use curl for smoke tests (agent card validation)
- [x] Document a2a-inspector usage
- [x] Provide test scripts for all agents

### Build System Goals
- [x] Use Turborepo for monorepo orchestration
- [x] Parallel agent startup
- [x] Watch mode for development
- [x] Single command to test all agents

---

## Proposed Structure

### Final Repository Layout
```
a2a-js-sdk-examples/
├── packages/
│   └── a2a-ai-sdk-adapter/       # 🆕 Publishable package
│       ├── src/
│       │   ├── index.ts          # Main export
│       │   ├── adapter.ts        # A2AAdapter class
│       │   ├── logger.ts         # Logger interfaces
│       │   └── types.ts          # Shared types
│       ├── dist/                 # Build output
│       ├── package.json          # Independent package
│       ├── tsconfig.json
│       └── README.md             # Package documentation
├── examples/
│   └── agents/                   # 🔄 Renamed from samples/js
│       ├── hello-world/
│       ├── dice-agent/
│       ├── github-agent/
│       ├── analytics-agent/
│       ├── currency-agent/
│       ├── movie-agent/
│       ├── coder/
│       ├── content-editor/
│       └── travel-planner-multiagent/
│           ├── weather-agent/
│           ├── airbnb-agent/
│           └── planner/
├── tools/
│   ├── test-agent.sh             # Generic agent tester
│   └── start-all.sh              # Parallel agent startup
├── turbo.json                    # 🆕 Turborepo config
├── package.json                  # Root workspace
└── README.md                     # Updated documentation
```

### Package Exports (`packages/a2a-ai-sdk-adapter/package.json`)
```json
{
  "name": "@drew-foxall/a2a-ai-sdk-adapter",
  "version": "1.0.0",
  "description": "Unified adapter bridging AI SDK ToolLoopAgent with A2A protocol",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "tsc",
    "watch": "tsc --watch",
    "prepublishOnly": "pnpm build"
  },
  "keywords": [
    "a2a",
    "agent",
    "ai-sdk",
    "adapter",
    "vercel-ai-sdk",
    "hono",
    "typescript"
  ],
  "peerDependencies": {
    "@drew-foxall/a2a-js-sdk": "^0.3.5",
    "ai": "^6.0.0",
    "uuid": "^11.0.0"
  },
  "devDependencies": {
    "@drew-foxall/a2a-js-sdk": "^0.3.5",
    "@total-typescript/tsconfig": "1.0.4",
    "ai": "6.0.0-beta.99",
    "typescript": "^5.8.0",
    "uuid": "^11.1.0"
  }
}
```

---

## Implementation Phases

### Phase 1: Extract & Publish Adapter ⏱️ 2-3 hours

#### 1.1 Create Package Structure
```bash
mkdir -p packages/a2a-ai-sdk-adapter/src
```

#### 1.2 Extract Core Files
Move from `samples/js/src/shared/`:
- `a2a-adapter.ts` → `packages/a2a-ai-sdk-adapter/src/adapter.ts`
- Extract logger interfaces → `packages/a2a-ai-sdk-adapter/src/logger.ts`
- Extract types → `packages/a2a-ai-sdk-adapter/src/types.ts`
- Create `packages/a2a-ai-sdk-adapter/src/index.ts` (main export)

#### 1.3 Create Package Files
- `packages/a2a-ai-sdk-adapter/package.json` (see template above)
- `packages/a2a-ai-sdk-adapter/tsconfig.json` (extend @total-typescript/tsconfig)
- `packages/a2a-ai-sdk-adapter/README.md` (comprehensive package docs)
- `packages/a2a-ai-sdk-adapter/.npmignore`

#### 1.4 Build & Test Locally
```bash
cd packages/a2a-ai-sdk-adapter
pnpm build
pnpm pack  # Create tarball for local testing
```

#### 1.5 Update Examples
Replace all imports in examples:
```typescript
// Before
import { A2AAdapter } from '../../shared/a2a-adapter.js';

// After
import { A2AAdapter } from '@drew-foxall/a2a-ai-sdk-adapter';
```

Update each example's `package.json`:
```json
{
  "dependencies": {
    "@drew-foxall/a2a-ai-sdk-adapter": "workspace:*"
  }
}
```

#### 1.6 Verify Build
```bash
pnpm install  # Link workspace package
cd examples/agents/hello-world
pnpm agents:hello-world  # Test import works
```

#### 1.7 Publish to NPM
```bash
cd packages/a2a-ai-sdk-adapter
npm publish --access public
```

#### 1.8 Update Examples to Use Published Package
```json
{
  "dependencies": {
    "@drew-foxall/a2a-ai-sdk-adapter": "^1.0.0"
  }
}
```

**Deliverables**:
- ✅ `@drew-foxall/a2a-ai-sdk-adapter` published on NPM
- ✅ All examples use published package
- ✅ Build passes with no errors

---

### Phase 2: Restructure Examples ⏱️ 1-2 hours

#### 2.1 Rename Directory
```bash
git mv samples/js examples/agents
```

#### 2.2 Update Import Paths
- All agent imports now reference new location
- Update root `package.json` workspace config:
  ```json
  {
    "workspaces": [
      "packages/*",
      "examples/agents"
    ]
  }
  ```

#### 2.3 Update Scripts
Root `package.json`:
```json
{
  "scripts": {
    "agents:hello-world": "cd examples/agents && pnpm agents:hello-world",
    "agents:dice": "cd examples/agents && pnpm agents:dice-agent",
    // ... all agent scripts
  }
}
```

**Deliverables**:
- ✅ Clear separation: packages vs examples
- ✅ All agents still functional
- ✅ Scripts still work from root

---

### Phase 3: Add Turborepo ⏱️ 2-3 hours

#### 3.1 Install Turborepo
```bash
pnpm add -D turbo
```

#### 3.2 Create `turbo.json`
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": []
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
```

#### 3.3 Add Turborepo Scripts
Root `package.json`:
```json
{
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev --parallel",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck"
  }
}
```

#### 3.4 Add `dev` Script to Each Agent
```json
{
  "scripts": {
    "dev": "tsx src/index.ts"
  }
}
```

#### 3.5 Test Parallel Startup
```bash
pnpm dev  # Should start all agents in parallel
```

**Deliverables**:
- ✅ Turborepo configured
- ✅ Parallel build support
- ✅ All agents can start simultaneously

---

### Phase 4: Testing Infrastructure ⏱️ 3-4 hours

#### 4.1 Create Generic Test Script
`tools/test-agent.sh`:
```bash
#!/bin/bash
# Usage: ./tools/test-agent.sh <port> <expected-name>

PORT=$1
EXPECTED_NAME=$2

echo "Testing agent on port $PORT..."

# Test 1: Agent card accessible
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/.well-known/agent-card.json)
if [ "$RESPONSE" != "200" ]; then
  echo "❌ Agent card not accessible (HTTP $RESPONSE)"
  exit 1
fi

# Test 2: Agent name matches
ACTUAL_NAME=$(curl -s http://localhost:$PORT/.well-known/agent-card.json | jq -r '.name')
if [ "$ACTUAL_NAME" != "$EXPECTED_NAME" ]; then
  echo "❌ Agent name mismatch: expected '$EXPECTED_NAME', got '$ACTUAL_NAME'"
  exit 1
fi

echo "✅ Agent $EXPECTED_NAME (port $PORT) is healthy"
```

#### 4.2 Create Test Suite
`tools/test-all-agents.sh`:
```bash
#!/bin/bash
set -e

source .env

# Start all agents in background
pnpm dev &
TURBO_PID=$!

# Wait for initialization
echo "Waiting 10 seconds for agents to start..."
sleep 10

# Test each agent
./tools/test-agent.sh 41244 "Hello World Agent"
./tools/test-agent.sh 41245 "Dice Agent"
./tools/test-agent.sh 41246 "GitHub Agent"
./tools/test-agent.sh 41247 "Analytics Agent"
./tools/test-agent.sh 41248 "Currency Agent"
./tools/test-agent.sh 41249 "Movie Agent"
./tools/test-agent.sh 41250 "Coder Agent"
./tools/test-agent.sh 41251 "Content Editor Agent"
./tools/test-agent.sh 41252 "Weather Agent"
./tools/test-agent.sh 41253 "Airbnb Agent"
./tools/test-agent.sh 41254 "Travel Planner Agent"

# Cleanup
kill $TURBO_PID

echo ""
echo "🎉 All agents passed!"
```

#### 4.3 Add CI Integration
`.github/workflows/test.yml`:
```yaml
name: Test Agents

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm build
      - run: pnpm typecheck
      - run: pnpm lint
      - name: Test all agents
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: ./tools/test-all-agents.sh
```

**Deliverables**:
- ✅ Automated testing for all agents
- ✅ CI/CD pipeline
- ✅ No manual verification needed

---

### Phase 5: Documentation ⏱️ 2-3 hours

#### 5.1 Update Root README
- Add "Publishing Your Own Adapter" section
- Link to adapter package README
- Clarify relationship with a2a-samples
- Remove outdated "Architecture" section (move to adapter README)

#### 5.2 Create Adapter Package README
`packages/a2a-ai-sdk-adapter/README.md`:
- Architecture overview
- API documentation
- Configuration options
- Usage examples
- Migration guide from embedded version

#### 5.3 Create Testing Guide
`docs/TESTING.md`:
- How to test agents locally (curl)
- Using a2a-inspector
- Using the Python demo UI (optional)
- CI/CD setup

#### 5.4 Create Development Guide
`docs/DEVELOPMENT.md`:
- Setting up the monorepo
- Building the adapter
- Adding new agents
- Publishing workflow

#### 5.5 Cross-Reference Documentation
Create `docs/COMPARISON_WITH_A2A_SAMPLES.md`:
- Feature parity matrix
- When to use JS vs Python
- Architecture differences
- Testing approach differences

**Deliverables**:
- ✅ Comprehensive documentation
- ✅ Clear onboarding path
- ✅ Complements a2a-samples docs

---

## Validation Criteria

### Package Publication ✅
- [ ] `@drew-foxall/a2a-ai-sdk-adapter` available on NPM
- [ ] Version 1.0.0 published
- [ ] Package has comprehensive README
- [ ] TypeScript declarations included

### Agent Testing ✅
- [ ] All 9 agents start successfully
- [ ] Agent cards accessible via curl
- [ ] No Python required for testing
- [ ] Test script passes for all agents

### Build System ✅
- [ ] `pnpm build` builds adapter + examples
- [ ] `pnpm dev` starts all agents in parallel
- [ ] `pnpm test` runs full test suite
- [ ] `pnpm typecheck` passes with no errors

### Documentation ✅
- [ ] Root README explains dual purpose
- [ ] Adapter README is comprehensive
- [ ] Testing guide exists
- [ ] Development guide exists
- [ ] Comparison with a2a-samples documented

---

## Risk Assessment

### Low Risk ✅
- **Package extraction**: Straightforward file move
- **Turborepo setup**: Well-documented, stable tool
- **Testing scripts**: Simple bash + curl

### Medium Risk ⚠️
- **Import path updates**: Many files to update (automated via sed)
- **Workspace dependencies**: Need careful pnpm workspace config
- **Port conflicts**: Need clean shutdown between test runs

### Mitigation Strategies
1. **Create feature branch**: Don't work on main
2. **Test incrementally**: Validate each phase before proceeding
3. **Keep old structure**: Don't delete until new structure works
4. **Backup current state**: Tag current version before refactor

---

## Timeline Estimate

| Phase | Duration | Complexity |
|-------|----------|-----------|
| Phase 1: Extract & Publish | 2-3 hours | Medium |
| Phase 2: Restructure | 1-2 hours | Low |
| Phase 3: Turborepo | 2-3 hours | Medium |
| Phase 4: Testing | 3-4 hours | Medium |
| Phase 5: Documentation | 2-3 hours | Low |
| **Total** | **10-15 hours** | **Medium** |

---

## ✅ Confirmed Decisions

### 1. NPM Package Naming
**Decision**: `@drew-foxall/a2a-ai-sdk-adapter`
- Maintains consistency with `@drew-foxall/a2a-js-sdk` scope
- Clearer name indicating AI SDK integration
- More discoverable for AI SDK users

### 2. Build System
**Decision**: Turborepo
- Better caching for faster builds
- Parallel task execution
- Future-proof for additional packages
- Well-documented and stable

### 3. Demo & Testing UI
**Decision**: Integrate and demonstrate a2a-inspector
- Not just documentation - actual working demo
- Show best practices for testing A2A agents
- Provide scripts for easy setup
- Visual validation of agent behavior

### 4. Testing Strategy
**Decision**: Vitest unit tests + a2a-inspector integration
- **Unit Tests**: Vitest for adapter logic (fast, CI-friendly)
- **Integration**: a2a-inspector for end-to-end validation
- **Smoke Tests**: Curl for quick health checks
- Comprehensive coverage at all levels

---

## Next Steps

1. **User Review**: Review this plan, answer open questions
2. **Create Feature Branch**: `git checkout -b refactor/npm-package`
3. **Execute Phase 1**: Extract and publish adapter package
4. **Validate**: Test published package with one agent
5. **Proceed Incrementally**: Complete remaining phases

---

## Success Metrics

### NPM Package
- Downloads: Track via npm stats
- GitHub stars: Community interest
- Issues/PRs: Community contributions

### Repository
- Agent startup time: < 30 seconds for all agents
- Test suite time: < 2 minutes
- Documentation completeness: 100% (all sections filled)

### Developer Experience
- Time to first agent running: < 5 minutes (clone → run)
- Time to publish adapter change: < 10 minutes (edit → publish)
- Onboarding satisfaction: Measured via issue feedback

---

**Document Version**: 1.0  
**Last Updated**: 2025-11-21  
**Author**: Drew Foxall (with AI assistance)  
**Status**: 🟡 Awaiting User Approval

