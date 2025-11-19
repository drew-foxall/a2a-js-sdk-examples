# A2A Adapter Code Review

## Issues Found

### 1. ❌ Weak Typing (Multiple `any` usages)

#### Issue 1.1: ToolLoopAgent Generic Parameters
**Location:** Line 179
```typescript
private agent: ToolLoopAgent<any, any, any>
```
**Problem:** Using `any` for all generic parameters loses type safety
**Impact:** No type checking for model, tools, or call options

#### Issue 1.2: Transform Response Function
**Location:** Lines 131, 320-322
```typescript
transformResponse?: (result: any) => any;
```
**Problem:** Both input and output are `any`
**Impact:** No type safety for transformation logic

#### Issue 1.3: Error Handling
**Location:** Lines 268, 389
```typescript
catch (error: any) {
  this.log(`Error in task ${taskId}: ${error.message}`, true);
}
```
**Problem:** Error typed as `any`
**Impact:** No guarantee `error.message` exists

#### Issue 1.4: Result Type Assumptions
**Location:** Lines 324, 370, 446
```typescript
const responseText = transformedResult.text || transformedResult;
const { stream, text: responsePromise } = await this.agent.stream({...});
const fullResponse = await responsePromise;
```
**Problem:** Assuming structure without typing
**Impact:** Runtime errors if structure differs

---

### 2. ❌ Inflexible Logging (Hardcoded console)

#### Issue 2.1: Direct Console Usage
**Location:** Lines 683-692
```typescript
private log(message: string, isError: boolean = false): void {
  if (!this.config.debug) return;
  
  const prefix = '[A2AAdapter]';
  if (isError) {
    console.error(`${prefix} ${message}`);
  } else {
    console.log(`${prefix} ${message}`);
  }
}
```
**Problems:**
- Hardcoded to `console.log/error`
- No way for consumers to inject custom logger
- Can't integrate with structured logging systems
- Can't disable/redirect logs

**Impact:**
- Cannot use Winston, Pino, or other loggers
- Cannot route to log aggregation services
- Cannot customize log format
- Cannot capture logs for testing

---

### 3. ⚠️ Import Analysis

**Current imports look correct:**
```typescript
import { ToolLoopAgent } from 'ai';  // ✅ AI SDK v6
import { v4 as uuidv4 } from 'uuid';  // ✅ Used for IDs
import {
  AgentExecutor,
  RequestContext,
  ExecutionEventBus,
  Task,
  TaskStatusUpdateEvent,
  TaskArtifactUpdateEvent,
  Message,
  TextPart,
  TaskState,
} from '@drew-foxall/a2a-js-sdk/server';  // ✅ A2A SDK
```

**Potential improvement:** Could add type imports if needed for generics

---

### 4. ⚠️ Missing Type Exports

**Issue:** Some useful types are not exported
- `AgentGenerateResult` (for `transformResponse`)
- `AgentStreamResult` (for streaming)
- Custom logger interface

---

## Recommended Fixes

### Fix 1: Strong Typing for ToolLoopAgent

```typescript
// Define types for AI SDK results (if not exported by 'ai' package)
export interface AIGenerateResult {
  text: string;
  steps?: Array<{
    stepType: string;
    toolCalls?: any[];
    [key: string]: any;
  }>;
  [key: string]: any;
}

export interface AIStreamResult {
  stream: AsyncIterable<{ text: string; [key: string]: any }>;
  text: Promise<string>;
  [key: string]: any;
}

// Update generic constraint
export class A2AAdapter<
  TModel = any,
  TTools = any,
  TCallOptions = any
> implements AgentExecutor {
  constructor(
    private agent: ToolLoopAgent<TModel, TTools, TCallOptions>,
    config?: A2AAdapterConfig
  ) {
    // ...
  }
}
```

**Benefit:** Type safety for agent configuration

---

### Fix 2: Strong Typing for transformResponse

```typescript
export interface A2AAdapterConfig {
  /**
   * Transform agent response before creating A2A message (simple mode)
   * 
   * @param result - The raw agent generation result
   * @returns The transformed result with cleaned text
   */
  transformResponse?: (result: AIGenerateResult) => AIGenerateResult | string;
  
  // ... other options
}
```

**Usage:**
```typescript
transformResponse: (result) => {
  // TypeScript knows result has .text property
  const lines = result.text.split('\n');
  return { ...result, text: lines.slice(0, -1).join('\n') };
}
```

**Benefit:** IDE autocomplete and type checking

---

### Fix 3: Proper Error Typing

```typescript
// Option A: Use unknown and type guard
catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  this.log(`Error in task ${taskId}: ${message}`, true);
  this.publishFailure(taskId, contextId, message, eventBus);
}

// Option B: Create error helper
private getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error occurred';
}

// Then use:
catch (error: unknown) {
  const message = this.getErrorMessage(error);
  this.log(`Error in task ${taskId}: ${message}`, true);
  this.publishFailure(taskId, contextId, message, eventBus);
}
```

**Benefit:** Type-safe error handling

---

### Fix 4: Flexible Logging Interface

```typescript
/**
 * Logger interface for A2AAdapter
 */
export interface A2ALogger {
  debug(message: string, meta?: Record<string, any>): void;
  info(message: string, meta?: Record<string, any>): void;
  warn(message: string, meta?: Record<string, any>): void;
  error(message: string, meta?: Record<string, any>): void;
}

/**
 * Default console logger implementation
 */
export class ConsoleLogger implements A2ALogger {
  constructor(private prefix: string = '[A2AAdapter]') {}
  
  debug(message: string, meta?: Record<string, any>): void {
    console.log(`${this.prefix} [DEBUG] ${message}`, meta || '');
  }
  
  info(message: string, meta?: Record<string, any>): void {
    console.log(`${this.prefix} [INFO] ${message}`, meta || '');
  }
  
  warn(message: string, meta?: Record<string, any>): void {
    console.warn(`${this.prefix} [WARN] ${message}`, meta || '');
  }
  
  error(message: string, meta?: Record<string, any>): void {
    console.error(`${this.prefix} [ERROR] ${message}`, meta || '');
  }
}

/**
 * No-op logger for production (when debug: false)
 */
export class NoOpLogger implements A2ALogger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(message: string): void {
    // Always log errors even in production
    console.error(`[A2AAdapter] ERROR: ${message}`);
  }
}

export interface A2AAdapterConfig {
  // ... other options
  
  /**
   * Whether to enable debug logging
   * @default false
   */
  debug?: boolean;
  
  /**
   * Custom logger implementation
   * If not provided, uses ConsoleLogger (when debug: true) or NoOpLogger
   */
  logger?: A2ALogger;
}
```

**Updated constructor:**
```typescript
constructor(
  private agent: ToolLoopAgent<any, any, any>,
  config?: A2AAdapterConfig
) {
  // Set defaults
  this.config = {
    includeHistory: config?.includeHistory ?? false,
    workingMessage: config?.workingMessage || 'Processing your request...',
    debug: config?.debug ?? false,
    logger: config?.logger,
    // ... other configs
  };
  
  // Initialize logger
  this.logger = this.config.logger || 
    (this.config.debug ? new ConsoleLogger() : new NoOpLogger());
}
```

**Updated log method:**
```typescript
private log(message: string, level: 'debug' | 'info' | 'warn' | 'error' = 'debug'): void {
  this.logger[level](message);
}
```

**Usage examples:**

```typescript
// Example 1: Default (console in debug mode)
new A2AAdapter(agent, {
  debug: true,  // Uses ConsoleLogger
});

// Example 2: Custom logger (Winston)
import winston from 'winston';

class WinstonLogger implements A2ALogger {
  constructor(private logger: winston.Logger) {}
  
  debug(msg: string, meta?: any) { this.logger.debug(msg, meta); }
  info(msg: string, meta?: any) { this.logger.info(msg, meta); }
  warn(msg: string, meta?: any) { this.logger.warn(msg, meta); }
  error(msg: string, meta?: any) { this.logger.error(msg, meta); }
}

const winstonLogger = winston.createLogger({...});

new A2AAdapter(agent, {
  logger: new WinstonLogger(winstonLogger),
});

// Example 3: Custom logger (Pino)
import pino from 'pino';

class PinoLogger implements A2ALogger {
  constructor(private logger: pino.Logger) {}
  
  debug(msg: string, meta?: any) { this.logger.debug(meta, msg); }
  info(msg: string, meta?: any) { this.logger.info(meta, msg); }
  warn(msg: string, meta?: any) { this.logger.warn(meta, msg); }
  error(msg: string, meta?: any) { this.logger.error(meta, msg); }
}

const pinoLogger = pino();

new A2AAdapter(agent, {
  logger: new PinoLogger(pinoLogger),
});

// Example 4: Testing with mock logger
class MockLogger implements A2ALogger {
  logs: Array<{ level: string; message: string }> = [];
  
  debug(msg: string) { this.logs.push({ level: 'debug', message: msg }); }
  info(msg: string) { this.logs.push({ level: 'info', message: msg }); }
  warn(msg: string) { this.logs.push({ level: 'warn', message: msg }); }
  error(msg: string) { this.logs.push({ level: 'error', message: msg }); }
}

const mockLogger = new MockLogger();
const adapter = new A2AAdapter(agent, { logger: mockLogger });
// Test...
expect(mockLogger.logs).toContainEqual({ level: 'debug', message: '...' });
```

**Benefits:**
- ✅ Works with any logging framework (Winston, Pino, Bunyan, etc.)
- ✅ Can route to log aggregation services (Datadog, Splunk, etc.)
- ✅ Easy to test (mock logger captures logs)
- ✅ Backward compatible (defaults to console)
- ✅ Flexible (can disable all logs, or customize format)

---

## Complete Fixed Version Preview

### Key Changes:

1. **Strong typing for generics:**
   ```typescript
   export class A2AAdapter<TModel = any, TTools = any, TCallOptions = any>
   ```

2. **Typed response transformation:**
   ```typescript
   transformResponse?: (result: AIGenerateResult) => AIGenerateResult | string;
   ```

3. **Proper error handling:**
   ```typescript
   catch (error: unknown) {
     const message = this.getErrorMessage(error);
     // ...
   }
   ```

4. **Flexible logging:**
   ```typescript
   export interface A2ALogger { ... }
   private logger: A2ALogger;
   ```

---

## Priority Ranking

### High Priority (Breaking Changes)

1. **Add flexible logging interface** ⭐⭐⭐⭐⭐
   - Impact: Enables production use with proper logging
   - Breaking: No (backward compatible with default)
   - Effort: 1-2 hours

### Medium Priority (Non-Breaking Improvements)

2. **Add strong typing for AI SDK results** ⭐⭐⭐⭐
   - Impact: Better IDE support and type safety
   - Breaking: No (generics default to `any`)
   - Effort: 1 hour

3. **Fix error handling** ⭐⭐⭐⭐
   - Impact: Safer error handling
   - Breaking: No
   - Effort: 30 minutes

### Low Priority (Nice to Have)

4. **Export helper types** ⭐⭐⭐
   - Impact: Better DX for consumers
   - Breaking: No
   - Effort: 15 minutes

---

## Recommendation

**Immediate Action:**
1. ✅ Implement flexible logging (High priority, enables production use)
2. ✅ Fix error handling (Quick win, safer code)

**Next Sprint:**
3. ✅ Add strong typing for AI SDK results
4. ✅ Export helper types

**Benefits:**
- Production-ready logging
- Safer error handling
- Better type safety
- Improved developer experience

Would you like me to implement these fixes?

