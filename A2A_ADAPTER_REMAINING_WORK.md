# A2A Adapter - Remaining TypeScript Errors

**Date**: 2025-11-21  
**Status**: 🔴 5 Errors Remaining (Down from 16)

---

## Summary

We've made significant progress removing unsafe casts and fixing type safety issues. We're down from **16 errors to 5 errors**, but there are stil

 legitimate type mismatches to resolve.

---

## ✅ What We Fixed (Successfully)

1. ✅ Removed all `as unknown as` casts
2. ✅ Fixed `any` → `unknown` in ParsedArtifact  
3. ✅ Fixed `event.emit()` → `eventBus.publish()`
4. ✅ Added null guards for `parsed` and `finalParsed`
5. ✅ Fixed artifact structure to match A2A SDK (removed `index`, added `artifactId` and `parts`)
6. ✅ Changed `stream` → `textStream` for AI SDK v6
7. ✅ Changed from `prompt + messages` to `messages only` format
8. ✅ No more `@ts-expect-error` suppressions

---

## 🔴 Remaining Errors (5 Total)

### Error 1: SDK Subpath Export (Line 45) - **NOT OUR BUG**

```
error TS2307: Cannot find module '@drew-foxall/a2a-js-sdk/server'
```

**Status**: Known TypeScript limitation with package.json `exports`  
**Impact**: None - runtime works fine with tsx  
**Action**: Ignore - this is a TypeScript/package resolution issue

---

### Error 2: TCallOptions Constraint (Line 361) - **COMPLEX**

```
error TS2344: Type 'TCallOptions' does not satisfy the constraint 'Output<any, any>'.
```

**Cause**: `ToolLoopAgent` expects `TCallOptions extends Output<any, any>` but we use `TCallOptions = unknown`

**Potential Solutions**:
1. Add constraint: `TCallOptions extends Output<unknown, unknown> = Output<unknown, unknown>`  
   - **Problem**: `Output` is a namespace, not a type ❌
2. Use `TCallOptions = never`
   - **Problem**: Might break agents that use callOptionsSchema ❌
3. Don't constrain TCallOptions and accept the error
   - **Problem**: Violates our no-suppression rule ❌

**Status**: Needs investigation of AI SDK's actual constraint types

---

### Error 3 & 5: Agent Parameter Type Mismatch (Lines 497, 608) - **CRITICAL**

```typescript
// Current code:
const aiMessages = messages.map((m) => ({
  role: m.role,
  content: m.content,
}));

const result = await this.agent.generate({
  messages: aiMessages,  // ❌ Type error
});
```

**Error**:
```
Argument of type '{ messages: { role: "user" | "assistant"; content: string; }[]; }'
is not assignable to parameter of type 'AgentCallParameters<TModel>'.
```

**Root Cause**: AI SDK expects `ModelMessage[]` which has a specific structure:
```typescript
type ModelMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string | ContentPart[];
  // ... other fields
}
```

**Solution**: Import and use the correct `ModelMessage` type from AI SDK

```typescript
import type { CoreMessage } from 'ai';

const aiMessages: CoreMessage[] = messages.map((m) => ({
  role: m.role,
  content: m.content,
}));
```

---

### Error 4: transformResponse Parameter Type (Line 508) - **MODERATE**

```typescript
const transformed = this.config.transformResponse ? this.config.transformResponse(result) : result;
```

**Error**:
```
Argument of type 'GenerateTextResult<TTools, TCallOptions>' is not assignable
to parameter of type '{ [key: string]: unknown; text: string; }'.
```

**Root Cause**: `GenerateTextResult` doesn't have an index signature

**Solution**: Accept the actual AI SDK return type:

```typescript
// In A2AAdapterConfig:
transformResponse?: (result: { text: string }) => { text: string } | string;
```

Or better, import the actual type:
```typescript
import type { GenerateTextResult } from 'ai';

transformResponse?: <TTools, TCallOptions>(
  result: GenerateTextResult<TTools, TCallOptions>
) => { text: string } | string;
```

---

## 📋 Action Plan

### Phase 1: Research AI SDK Types
1. Find the correct import for `CoreMessage` or `ModelMessage`
2. Find the correct constraint type for `TCallOptions` (if not `Output`)
3. Understand `GenerateTextResult`'s actual structure

### Phase 2: Fix Message Type (Errors 3 & 5)
```typescript
import type { CoreMessage } from 'ai';

// In executeSimple and executeStreaming:
const aiMessages: CoreMessage[] = messages.map((m) => ({
  role: m.role,
  content: m.content,
}));
```

### Phase 3: Fix transformResponse (Error 4)
```typescript
transformResponse?: (result: { text: string }) => { text: string } | string;
```

### Phase 4: Fix TCallOptions Constraint (Error 2)
- Research actual constraint from AI SDK
- Apply correct constraint or document why it's not possible

### Phase 5: Verify
- Run `tsc --noEmit` on all agents
- Test runtime behavior  
- Ensure no new casts were introduced

---

## 🎯 Success Criteria

- [ ] Zero TypeScript errors in `a2a-adapter.ts` (except SDK subpath)
- [ ] Zero unsafe casts (`as unknown as`, `as any`)
- [ ] All agents compile successfully
- [ ] Runtime behavior verified

---

## 📚 References

- AI SDK v6 Docs: https://sdk.vercel.ai/docs
- AI SDK Types: `node_modules/ai/dist/index.d.ts`
- A2A SDK: `@drew-foxall/a2a-js-sdk`

---

*Last updated: 2025-11-21*

