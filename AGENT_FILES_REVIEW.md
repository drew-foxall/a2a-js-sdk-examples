# Agent Files Review - Type Safety & Import Errors

## Summary

Found **15 linter errors** across **3 agent files** that need to be fixed.

### Critical Issues:
1. ❌ **Incorrect import**: `LanguageModelV1` should be `LanguageModel` (3 files)
2. ❌ **Missing zod dependency** in package.json
3. ❌ **Implicit `any` types** in tool parameters (2 instances)
4. ❌ **Type errors** in movie agent configuration (2 instances)
5. ❌ **Provider version conflicts** in coder agent
6. ❌ **Explicit `any` usage** in coder agent (3 instances)

---

## File-by-File Analysis

### 1. `/samples/js/src/agents/movie-agent/agent.ts` - 8 ERRORS

#### Error 1: Incorrect Import (Line 16)
```typescript
// ❌ WRONG
import { ToolLoopAgent, tool, type LanguageModelV1 } from "ai";

// ✅ CORRECT
import { ToolLoopAgent, tool, type LanguageModel } from "ai";
```
**Issue**: AI SDK v6 exports `LanguageModel`, not `LanguageModelV1`

---

#### Error 2: Missing zod Dependency (Line 17)
```typescript
import { z } from "zod";
```
**Issue**: Cannot find module 'zod' - need to add to package.json

---

#### Error 3 & 4: Implicit `any` in Tool Parameters (Lines 30, 40)
```typescript
// ❌ WRONG - implicit any
execute: async ({ query }) => {
  return await searchMovies(query);
},

// ✅ CORRECT - explicit typing
execute: async ({ query }: { query: string }) => {
  return await searchMovies(query);
},
```
**Issue**: Tool execute functions need explicit parameter types

---

#### Error 5: Missing `maxSteps` in Type (Line 81)
```typescript
// Current
maxSteps: 10,
```
**Issue**: TypeScript can't infer correct ToolLoopAgent overload due to other type errors. Will be fixed when other errors are resolved.

---

#### Error 6: `goal` Property Type Error (Line 111)
```typescript
// Current
const instructions = getMovieAgentPrompt(options?.goal);
```
**Issue**: `options` is typed as `never` due to incorrect generic constraints. Need to fix ToolLoopAgent generic parameters.

---

### 2. `/samples/js/src/agents/content-editor/agent.ts` - 1 ERROR

#### Error 1: Incorrect Import (Line 8)
```typescript
// ❌ WRONG
import { ToolLoopAgent, type LanguageModelV1 } from "ai";

// ✅ CORRECT
import { ToolLoopAgent, type LanguageModel } from "ai";
```
**Issue**: Same as movie agent - AI SDK v6 exports `LanguageModel`

---

### 3. `/samples/js/src/agents/coder/agent.ts` - 2 ERRORS

#### Error 1: Incorrect Import (Line 17)
```typescript
// ❌ WRONG
import { ToolLoopAgent, streamText, type LanguageModelV1 } from 'ai';

// ✅ CORRECT
import { ToolLoopAgent, streamText, type LanguageModel } from 'ai';
```
**Issue**: Same import issue

---

#### Error 2: Provider Version Conflict (Line 127)
```typescript
// Current
const { textStream } = streamText({
  model: getModel(),  // ← Type mismatch
  system: CODER_SYSTEM_PROMPT,
  messages,
});
```
**Issue**: Multiple `@ai-sdk/provider` versions installed (3.0.0-beta.8 and 3.0.0-beta.16) causing type conflicts. Need to dedupe dependencies.

---

#### Error 3-5: Explicit `any` Usage (Lines 104, 105, 150)
```typescript
// ❌ WRONG - uses any
export async function* streamCoderGeneration(
  agent: ToolLoopAgent<any, any, any>,  // ← Line 104
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): AsyncGenerator<string> {
  if ('stream' in agent && typeof (agent as any).stream === 'function') {  // ← Line 105
    // ...
  }
}

export async function generateCode(
  agent: ToolLoopAgent<any, any, any>,  // ← Line 150
  // ...
): Promise<string> {
  // ...
}

// ✅ CORRECT - use proper generics
export async function* streamCoderGeneration<
  TModel extends LanguageModel,
  TTools extends Record<string, unknown>,
  TCallOptions extends Record<string, unknown>
>(
  agent: ToolLoopAgent<TModel, TTools, TCallOptions>,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): AsyncGenerator<string> {
  if ('stream' in agent && typeof agent.stream === 'function') {
    // ...
  }
}
```
**Issue**: Using `any` instead of proper generics violates type safety requirements

---

## Supporting Files (No Errors)

### ✅ `/samples/js/src/agents/movie-agent/tmdb.ts` - OK
- No type errors
- Proper error handling
- Good typing

### ✅ `/samples/js/src/agents/movie-agent/prompt.ts` - OK
- No type errors
- Proper function signature

### ✅ `/samples/js/src/agents/content-editor/prompt.ts` - OK
- No type errors
- Simple string export

### ✅ `/samples/js/src/agents/coder/code-format.ts` - OK
- No type errors
- Good parsing logic

---

## Fixes Required

### Priority 1: Critical Type Errors

1. **Fix incorrect import** (3 files)
   - Change `LanguageModelV1` → `LanguageModel`

2. **Add missing zod dependency**
   ```bash
   pnpm add zod -w
   ```

3. **Fix tool parameter types** (movie-agent/agent.ts)
   - Add explicit types to `execute` functions

4. **Fix coder agent generics** (coder/agent.ts)
   - Replace `any` with proper generic parameters

### Priority 2: Dependency Issues

5. **Dedupe provider dependencies**
   ```bash
   pnpm dedupe
   ```

### Priority 3: Index Files

All index.ts files are clean - no type errors! ✅
- `content-editor/index.ts` - OK
- `movie-agent/index.ts` - OK
- `coder/index.ts` - OK

---

## Impact

### Current State:
- ❌ 15 linter errors
- ❌ 6 instances of `any` usage (implicit + explicit)
- ❌ Type safety compromised

### After Fixes:
- ✅ 0 linter errors
- ✅ 0 `any` usage
- ✅ Full type safety maintained
- ✅ Consistent with AI SDK v6 types

---

## Next Steps

1. Fix `LanguageModelV1` → `LanguageModel` in all 3 agent.ts files
2. Add `zod` to package.json
3. Add explicit types to tool execute functions
4. Replace `any` with proper generics in coder agent
5. Run `pnpm dedupe` to fix provider version conflicts
6. Verify all linter errors are resolved
7. Test all 3 agents still start correctly

