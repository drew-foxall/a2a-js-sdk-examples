# AI SDK v6 Upgrade Guide

## Current Status

- **Current Version**: AI SDK v4.0.30
- **Target Version**: AI SDK v6.x (Beta)
- **Reason**: To use `ToolLoopAgent` class for agent/protocol separation

## Why Upgrade?

The AI SDK v6 introduces the [`ToolLoopAgent` class](https://v6.ai-sdk.dev/docs/agents/overview) which enables:

1. **Separation of concerns**: Agent logic separate from protocol
2. **Reusability**: Same agent works with A2A, MCP, REST, CLI
3. **Call Options**: Dynamic agent configuration with `prepareCall`
4. **Loop Control**: Better control with `stopWhen` conditions

## Upgrade Steps

### 1. Update package.json

```bash
cd samples/js
pnpm add ai@beta
```

Or manually update `package.json`:

```json
{
  "dependencies": {
    "ai": "^6.0.0-beta.x"
  }
}
```

### 2. Update Imports

**Before (v4):**
```typescript
import { generateText, streamText } from 'ai';
```

**After (v6):**
```typescript
import { generateText, streamText, ToolLoopAgent, tool } from 'ai';
```

### 3. Check Breaking Changes

Review the [AI SDK v6 migration guide](https://sdk.vercel.ai/docs/migration) for any breaking changes that might affect our usage.

## Testing After Upgrade

Test all agents still work:

```bash
# Test Content Editor
pnpm agents:content-editor

# Test Movie Agent
pnpm agents:movie-agent

# Test Coder Agent
pnpm agents:coder
```

## Compatibility

The `A2AAgentAdapter` is designed to work with AI SDK v6's `ToolLoopAgent`. It includes a `ToolLoopAgentLike` interface for compatibility until we upgrade.

## Next Steps

1. Upgrade to v6
2. Test existing agents still work
3. Migrate Content Editor Agent to ToolLoopAgent (Phase 2)
4. Migrate Movie Agent with Call Options (Phase 3)
5. Evaluate Coder Agent streaming (Phase 4)

## Rollback Plan

If issues arise:

```bash
pnpm add ai@^4.0.30
```

Revert adapter changes and continue with current implementation.

