# TypeScript Configuration

**Base**: [@total-typescript/tsconfig](https://github.com/total-typescript/tsconfig)  
**Configuration**: `bundler/no-dom.json`  
**Setup Date**: 2025-11-21

---

## Why @total-typescript/tsconfig?

We use the [@total-typescript/tsconfig](https://github.com/total-typescript/tsconfig) package as our base TypeScript configuration because it:

1. ✅ **Simplifies tsconfig.json** - Reduces complexity by providing well-tested base configurations
2. ✅ **Best practices** - Maintained by TypeScript expert Matt Pocock (Total TypeScript)
3. ✅ **Sensible defaults** - Includes modern TypeScript strictness flags
4. ✅ **Clear decision tree** - Simple questions lead to the right config

---

## Our Configuration Choice

### Selected: `@total-typescript/tsconfig/bundler/no-dom.json`

**Why this config?**

| Question | Answer | Reasoning |
|----------|--------|-----------|
| Using `tsc` to transpile? | **No** | We use `tsx` to run TypeScript directly |
| Code runs in DOM? | **No** | Our agents are Node.js servers |
| Building an app? | **Yes** | Each agent is a runnable application |

### What It Includes

From `bundler/no-dom.json`:

```json
{
  "compilerOptions": {
    /* Base Options */
    "esModuleInterop": true,
    "skipLibCheck": true,
    "target": "es2022",
    "allowJs": true,
    "resolveJsonModule": true,
    "moduleDetection": "force",
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    
    /* Strictness */
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    
    /* For bundlers (not tsc transpilation) */
    "module": "preserve",
    "noEmit": true,
    
    /* No DOM APIs */
    "lib": ["es2022"]
  }
}
```

### Our Overrides

We override specific settings for Node.js ESM support:

```json
{
  "extends": "@total-typescript/tsconfig/bundler/no-dom.json",
  "compilerOptions": {
    // Node.js ESM requires NodeNext
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    
    // For tsc type checking with --noEmit false
    "outDir": "dist",
    
    // Additional strictness
    "forceConsistentCasingInFileNames": true
  }
}
```

---

## Benefits We Get

### 1. ✅ Enhanced Type Safety

**New strictness flags from base config:**

- **`noUncheckedIndexedAccess`** - Makes array/object access safer
  ```typescript
  const arr = [1, 2, 3];
  const item = arr[10]; // Type: number | undefined (not just number)
  ```

- **`noImplicitOverride`** - Requires explicit `override` keyword
  ```typescript
  class Base { method() {} }
  class Derived extends Base {
    override method() {} // ✅ Explicit
  }
  ```

- **`verbatimModuleSyntax`** - Clearer import/export intentions
  ```typescript
  import type { Type } from 'module'; // ✅ Type-only import
  import { value } from 'module'; // ✅ Value import
  ```

### 2. ✅ Modern TypeScript Features

- **`isolatedModules: true`** - Ensures code works with bundlers (Vite, esbuild, tsx)
- **`moduleDetection: "force"`** - All files treated as modules
- **`target: "es2022"`** - Modern JavaScript features

### 3. ✅ Better Developer Experience

- **IntelliSense improvements** - More accurate type hints
- **Fewer runtime errors** - Catches more issues at compile time
- **Clearer error messages** - Better TypeScript diagnostics

---

## Migration Notes

### What Changed

**Before** (custom config):
```json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "NodeNext",
    "strict": true,
    // ... other options
  }
}
```

**After** (based on @total-typescript/tsconfig):
```json
{
  "extends": "@total-typescript/tsconfig/bundler/no-dom.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "forceConsistentCasingInFileNames": true
  }
}
```

### Compatibility

✅ **All existing code works** - No breaking changes required  
✅ **Runtime behavior unchanged** - Uses same `tsx` execution  
✅ **Type checking enhanced** - Catches more potential issues

---

## Type Checking Commands

```bash
# Type check all files (with new strictness)
pnpm exec tsc --noEmit

# Type check specific agent
pnpm exec tsc --noEmit src/agents/hello-world/index.ts

# Run with tsx (same as before)
pnpm tsx src/agents/hello-world/index.ts
```

---

## Known Issues

### TypeScript Compiler Errors (Non-Critical)

You may see errors like:
```
error TS2322: Type 'A2AAdapter<...>' is not assignable to type 'AgentExecutor'
```

**Status**: ⚠️ Known TypeScript limitation with SDK subpath exports  
**Impact**: None - agents run perfectly at runtime  
**Action**: No fix needed

See `TYPE_SAFETY_REVIEW_MCP_UPGRADE.md` for details.

---

## For New Agents

When creating a new agent, you automatically benefit from:

1. ✅ **Enhanced type safety** from `noUncheckedIndexedAccess`
2. ✅ **Better import clarity** from `verbatimModuleSyntax`
3. ✅ **Stricter overrides** from `noImplicitOverride`
4. ✅ **Modern TypeScript** best practices

No additional setup needed - just follow existing agent patterns!

---

## Resources

- **Base Config**: [@total-typescript/tsconfig](https://github.com/total-typescript/tsconfig)
- **TSConfig Cheat Sheet**: [Total TypeScript Guide](https://www.totaltypescript.com/tsconfig-cheat-sheet)
- **TypeScript Handbook**: [TypeScript Documentation](https://www.typescriptlang.org/docs/handbook/tsconfig-json.html)

---

## Maintenance

This configuration is maintained by:
- **Upstream**: Matt Pocock (Total TypeScript)
- **Our overrides**: Documented in `tsconfig.json` with comments

When updating TypeScript or `@total-typescript/tsconfig`:
1. Check `pnpm exec tsc --noEmit` for new errors
2. Update agent code if new strictness flags require changes
3. Document any new patterns in `A2A_INTEGRATION_PATTERN.md`

---

*Last updated: 2025-11-21*

