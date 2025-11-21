# Deprecated Shell Scripts

## ⚠️ These scripts will be removed in Phase 3 (Turborepo)

### Why These Are Being Removed

These shell scripts were created before we had proper monorepo tooling. They served their purpose but are now redundant and inferior to modern solutions.

---

## Scripts to Delete

### 1. `start-all-agents.sh` ❌
**Current**: Manually starts agents in background, saves PIDs to temp file  
**Replacement**: `pnpm dev` (Turborepo)  
**Why Better**:
- ✅ Hot reload (auto-restart on file changes)
- ✅ Proper process management (no orphaned processes)
- ✅ Parallel execution with caching
- ✅ Color-coded output per agent
- ✅ Single Ctrl+C to stop everything

### 2. `stop-all-agents.sh` ❌
**Current**: Reads PIDs from temp file, kills processes  
**Replacement**: Ctrl+C when running `pnpm dev`  
**Why Better**:
- ✅ No temp files to manage
- ✅ No stale PIDs
- ✅ Graceful shutdown

### 3. `test-all-agents.sh` ❌
**Current**: Curl-based smoke tests  
**Replacement**: Vitest unit tests + a2a-inspector  
**Why Better**:
- ✅ Real assertions (not just "did it respond?")
- ✅ Type-safe tests
- ✅ Watch mode for TDD
- ✅ Coverage reports
- ✅ Visual UI testing via a2a-inspector

### 4. `test-coder-agent.sh` ❌
### 5. `test-movie-agent.sh` ❌
### 6. `test-content-editor.sh` ❌
**Current**: Individual curl tests per agent  
**Replacement**: Vitest test files per agent  
**Example**:
```typescript
// examples/agents/src/agents/coder/__tests__/index.test.ts
import { describe, it, expect } from 'vitest';
import { createCoderAgent } from '../agent';

describe('Coder Agent', () => {
  it('generates code artifacts', async () => {
    const agent = createCoderAgent();
    // Proper typed assertions
  });
});
```

---

## Migration Path (Phase 3)

1. **Install Turborepo**: `pnpm add -D turbo`
2. **Create `turbo.json`**: Configure tasks
3. **Test `pnpm dev`**: Verify all agents start
4. **Add Vitest**: Unit test infrastructure
5. **Add a2a-inspector**: Integration testing UI
6. **Delete these 6 scripts**: No longer needed

---

## Comparison Table

| Feature | Shell Scripts | Turborepo + Vitest |
|---------|--------------|-------------------|
| **Parallel Start** | ⚠️ Manual | ✅ Automatic |
| **Hot Reload** | ❌ No | ✅ Yes |
| **Process Management** | ⚠️ Manual PIDs | ✅ Built-in |
| **Testing** | ⚠️ Curl only | ✅ Unit + Integration |
| **Type Safety** | ❌ None | ✅ Full |
| **Watch Mode** | ❌ No | ✅ Yes |
| **Coverage** | ❌ No | ✅ Yes |
| **CI/CD Ready** | ⚠️ Brittle | ✅ Stable |

---

## Timeline

- **Now (Phase 2)**: Scripts marked deprecated ⚠️
- **Phase 3**: Turborepo installed, scripts deleted 🗑️
- **Phase 4**: Vitest + a2a-inspector replace testing

---

**Status**: Marked for deletion  
**Will be removed**: Phase 3 (next)  
**See**: `REPO_REFOCUS_PLAN.md` for full refactor plan

