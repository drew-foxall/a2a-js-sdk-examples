# Streaming Conversion Plan

**Goal**: Convert all agents (except dice-agent) from `mode: 'generate'` to `mode: 'stream'`

**Date**: 2025-11-21  
**Status**: 📋 Planning Complete, Ready to Execute

---

## Executive Summary

| Category | Count | Agents |
|----------|-------|--------|
| **Already Streaming** ✅ | 1 | coder |
| **To Convert** 🔄 | 8 | content-editor, movie-agent, airbnb-agent, weather-agent, github-agent, analytics-agent, currency-agent, hello-world |
| **Keep as Generate** ⏹️ | 1 | dice-agent |
| **Total Agents** | 10 | - |

---

## Phase 1: Simple Text-Only Agents (No Artifacts)

### 1.1 Hello World Agent ⭐ Priority: HIGH (Educational baseline)

**File**: `samples/js/src/agents/hello-world/index.ts`

**Current**:
```typescript
const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
  mode: 'generate', // Simple awaited response
  workingMessage: "Processing your greeting...",
  includeHistory: true,
  debug: false,
});
```

**New**:
```typescript
const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
  mode: 'stream',      // ← CHANGE: Real-time streaming (text streams automatically)
  workingMessage: "Processing your greeting...",
  includeHistory: true,
  debug: false,
});
```

**Testing**:
- Send: "Hello!"
- Expect: Text streams word-by-word in real-time
- Verify: Final message is complete and correct

---

### 1.2 Content Editor Agent ⭐ Priority: HIGH (Long responses)

**File**: `samples/js/src/agents/content-editor/index.ts`

**Current**:
```typescript
const agentExecutor: AgentExecutor = new A2AAdapter(contentEditorAgent, {
  mode: 'generate', // Simple awaited response
  workingMessage: "Editing content...",
  debug: false,
});
```

**New**:
```typescript
const agentExecutor: AgentExecutor = new A2AAdapter(contentEditorAgent, {
  mode: 'stream',      // ← CHANGE: Real-time streaming
  streamText: true,    // ← ADD: Stream edited content
  workingMessage: "Editing content...",
  debug: false,
});
```

**Testing**:
- Send: Long article to edit
- Expect: Edited content streams paragraph-by-paragraph
- Verify: Complete edited article at end

---

### 1.3 Movie Agent ⭐ Priority: HIGH (Multi-turn conversations)

**File**: `samples/js/src/agents/movie-agent/index.ts`

**Current**:
```typescript
const agentExecutor: AgentExecutor = new A2AAdapter(movieAgent, {
  mode: 'generate', // Simple awaited response
  workingMessage: "Processing your question, hang tight!",
  includeHistory: true,
  parseTaskState,
  transformResponse,
  debug: false,
});
```

**New**:
```typescript
const agentExecutor: AgentExecutor = new A2AAdapter(movieAgent, {
  mode: 'stream',      // ← CHANGE: Real-time streaming
  streamText: true,    // ← ADD: Stream recommendations
  workingMessage: "Processing your question, hang tight!",
  includeHistory: true,
  parseTaskState,
  transformResponse,
  debug: false,
});
```

**Testing**:
- Send: "Recommend movies like Inception"
- Expect: Recommendations stream incrementally
- Verify: Multi-turn conversation history works
- Verify: State parsing still works correctly

---

### 1.4 GitHub Agent ⭐ Priority: MEDIUM (Tool-based)

**File**: `samples/js/src/agents/github-agent/index.ts`

**Current**:
```typescript
const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
  mode: 'generate', // Simple awaited response
  workingMessage: "Querying GitHub...",
  debug: false,
});
```

**New**:
```typescript
const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
  mode: 'stream',      // ← CHANGE: Real-time streaming
  streamText: true,    // ← ADD: Stream repo details
  workingMessage: "Querying GitHub...",
  debug: false,
});
```

**Testing**:
- Send: "Tell me about vercel/ai repository"
- Expect: Tool execution + streamed analysis
- Verify: GitHub API calls work correctly
- Verify: Response streams after tool completion

---

### 1.5 Weather Agent ⭐ Priority: MEDIUM (Multi-agent sub-agent)

**File**: `samples/js/src/agents/travel-planner-multiagent/weather-agent/index.ts`

**Current**:
```typescript
const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
  mode: 'generate', // Simple awaited response
  workingMessage: "Looking up weather forecast...",
  debug: false,
});
```

**New**:
```typescript
const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
  mode: 'stream',      // ← CHANGE: Real-time streaming
  streamText: true,    // ← ADD: Stream forecast details
  workingMessage: "Looking up weather forecast...",
  debug: false,
});
```

**Testing**:
- Send: "What's the weather in Paris?"
- Expect: Forecast streams incrementally
- Verify: Tool execution works
- Verify: Works when called by travel-planner agent

---

### 1.6 Airbnb Agent ⭐ Priority: HIGH (Multi-agent sub-agent with MCP)

**File**: `samples/js/src/agents/travel-planner-multiagent/airbnb-agent/index.ts`

**Current**:
```typescript
const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
  mode: 'generate', // Simple awaited response
  workingMessage: "Searching for accommodations...",
  debug: false,
});
```

**New**:
```typescript
const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
  mode: 'stream',      // ← CHANGE: Real-time streaming
  streamText: true,    // ← ADD: Stream accommodation results
  workingMessage: "Searching for accommodations...",
  debug: false,
});
```

**Testing**:
- Send: "Find accommodations in Paris for 2 guests"
- Expect: Results stream as they're found
- Verify: MCP tools work correctly
- Verify: Works when called by travel-planner agent

---

## Phase 2: Agents with Artifacts

### 2.1 Analytics Agent ⭐ Priority: MEDIUM (Has generateArtifacts)

**File**: `samples/js/src/agents/analytics-agent/index.ts`

**Current**:
```typescript
const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
  mode: 'generate', // Simple awaited response with async artifacts
  generateArtifacts: generateChartArtifacts,
  workingMessage: "Generating chart...",
  debug: false,
});
```

**New**:
```typescript
const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
  mode: 'stream',      // ← CHANGE: Stream analysis text
  streamText: true,    // ← ADD: Stream analysis explanation
  generateArtifacts: generateChartArtifacts,  // Keep artifact generation
  workingMessage: "Generating chart...",
  debug: false,
});
```

**Benefits**:
- User sees analysis explanation in real-time
- Chart artifact generated after text completes
- Best of both worlds!

**Testing**:
- Send: "Show me sales data for Q4"
- Expect: Analysis text streams → chart artifact emitted at end
- Verify: Both text and chart are delivered
- Verify: Chart is correctly formatted PNG

---

### 2.2 Currency Agent ⭐ Priority: MEDIUM (Has generateArtifacts + parseTaskState)

**File**: `samples/js/src/agents/currency-agent/index.ts`

**Current**:
```typescript
const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
  mode: 'generate', // Simple awaited response with async artifacts
  generateArtifacts: generateConversionArtifacts,
  parseTaskState,
  transformResponse,
  includeHistory: true,
  workingMessage: "Converting currency...",
  debug: false,
});
```

**New**:
```typescript
const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
  mode: 'stream',      // ← CHANGE: Stream conversion explanation
  streamText: true,    // ← ADD: Stream explanation text
  generateArtifacts: generateConversionArtifacts,  // Keep artifact generation
  parseTaskState,
  transformResponse,
  includeHistory: true,
  workingMessage: "Converting currency...",
  debug: false,
});
```

**Benefits**:
- Conversion explanation streams in real-time
- Structured artifact with rates generated at end
- Multi-turn conversations work

**Testing**:
- Send: "Convert 100 USD to EUR"
- Expect: Explanation streams → artifact with conversion details
- Verify: Multi-turn: "Now convert to JPY" works
- Verify: State parsing works correctly

---

## Phase 3: Already Streaming (Verify Only)

### 3.1 Coder Agent ✅ Already Streaming

**File**: `samples/js/src/agents/coder/index.ts`

**Current** (No changes needed):
```typescript
const agentExecutor: AgentExecutor = new A2AAdapter(coderAgent, {
  mode: 'stream',      // ✅ Already streaming
  streamText: true,    // ✅ Already enabled
  parseArtifacts: parseCodeArtifacts,
  buildFinalMessage: buildCoderFinalMessage,
  workingMessage: "Generating code...",
  debug: false,
});
```

**Testing**:
- Verify: Still works after adapter changes
- Verify: Text + code artifacts both stream

---

## Phase 4: Keep as Generate (No Changes)

### 4.1 Dice Agent ⏹️ Keep as Generate

**File**: `samples/js/src/agents/dice-agent/index.ts`

**Current** (No changes):
```typescript
const agentExecutor: AgentExecutor = new A2AAdapter(agent, {
  mode: 'generate', // ⏹️ Keep as generate (ultra-short responses)
  workingMessage: "Rolling dice...",
  debug: false,
});
```

**Rationale**:
- Responses are 1-2 words ("You rolled a 4")
- Streaming adds no UX value
- Serves as educational example of generate mode

**Testing**:
- Verify: Still works after adapter changes
- Verify: Generate mode still functions correctly

---

## Implementation Checklist

### Pre-Implementation

- [x] Create conversion plan
- [x] Document expected behavior changes
- [x] Identify potential risks

### Implementation (By Phase)

#### Phase 1: Simple Text-Only Agents
- [ ] Convert hello-world to streaming
- [ ] Test hello-world streaming
- [ ] Convert content-editor to streaming
- [ ] Test content-editor streaming
- [ ] Convert movie-agent to streaming
- [ ] Test movie-agent streaming (with state parsing)
- [ ] Convert github-agent to streaming
- [ ] Test github-agent streaming (with tools)
- [ ] Convert weather-agent to streaming
- [ ] Test weather-agent streaming
- [ ] Convert airbnb-agent to streaming
- [ ] Test airbnb-agent streaming (with MCP)

#### Phase 2: Agents with Artifacts
- [ ] Convert analytics-agent to streaming
- [ ] Test analytics-agent (text + artifact)
- [ ] Convert currency-agent to streaming
- [ ] Test currency-agent (text + artifact + state)

#### Phase 3: Verification
- [ ] Verify coder agent still works
- [ ] Verify dice agent still works

### Post-Implementation

- [ ] Run full test suite
- [ ] Document new streaming behavior
- [ ] Update README examples
- [ ] Commit with clear message

---

## Testing Strategy

### Manual Testing Approach

For each agent:

1. **Start agent**: `pnpm tsx samples/js/src/agents/{agent-name}/index.ts`
2. **Send test message**: Use appropriate query for agent
3. **Observe streaming**: Watch for incremental text updates
4. **Verify completion**: Ensure final response is complete
5. **Check artifacts**: If applicable, verify artifacts are generated

### Automated Testing (Future)

```typescript
// Test helper for streaming verification
async function testStreaming(agent: string, query: string) {
  const chunks: string[] = [];
  
  // Capture streaming chunks
  for await (const chunk of streamResponse(agent, query)) {
    chunks.push(chunk.text);
  }
  
  // Assertions
  expect(chunks.length).toBeGreaterThan(1); // Multiple chunks
  expect(chunks.join('')).toMatchSnapshot(); // Final text correct
}
```

---

## Potential Issues & Mitigations

### Issue 1: State Parsing with Streaming

**Risk**: `parseTaskState` might not work with incremental text

**Mitigation**: 
- `parseTaskState` is called on complete response text
- No changes needed to state parsing logic
- Test movie-agent and currency-agent carefully

---

### Issue 2: Transform Response with Streaming

**Risk**: `transformResponse` might interfere with streaming

**Mitigation**:
- `transformResponse` operates on final response
- Streaming happens before transformation
- Test movie-agent and currency-agent

---

### Issue 3: Artifacts Timing

**Risk**: `generateArtifacts` might delay final message

**Mitigation**:
- Artifacts generated after text completes
- Text still streams in real-time
- Final message waits for artifacts (expected behavior)
- Test analytics-agent and currency-agent

---

### Issue 4: Multi-Agent Orchestration

**Risk**: Streaming in sub-agents might confuse travel-planner

**Mitigation**:
- Travel-planner uses `a2a-ai-provider` which handles streaming
- Sub-agents (weather, airbnb) can stream independently
- Test end-to-end travel-planner flow

---

### Issue 5: MCP Tools with Streaming

**Risk**: MCP tool calls might interrupt streaming

**Mitigation**:
- Tools execute, then response streams
- This is standard AI SDK behavior
- Test airbnb-agent carefully

---

## Success Criteria

### Functional Requirements

- [x] All agents (except dice) use `mode: 'stream'`
- [ ] All agents stream text incrementally
- [ ] All agents produce correct final responses
- [ ] Artifacts still generate correctly
- [ ] State parsing still works
- [ ] Multi-turn conversations work
- [ ] Tool execution still works
- [ ] Multi-agent orchestration still works

### Performance Requirements

- [ ] No significant latency increase
- [ ] First chunk appears within 500ms
- [ ] Complete response time unchanged

### Quality Requirements

- [ ] No TypeScript errors
- [ ] No linter warnings
- [ ] All existing functionality preserved
- [ ] Improved perceived responsiveness

---

## Rollback Plan

If streaming causes issues:

1. **Revert specific agent**: Change `mode: 'stream'` back to `mode: 'generate'`
2. **Revert all agents**: `git revert <commit-hash>`
3. **File issue**: Document problem for investigation
4. **Investigate**: Determine root cause before re-attempting

---

## Timeline

### Estimated Duration: 2-3 hours

- **Phase 1** (Simple agents): 1 hour
  - 6 agents × 10 min each
- **Phase 2** (Artifact agents): 45 minutes
  - 2 agents × 20 min each (more complex testing)
- **Phase 3** (Verification): 15 minutes
  - 2 agents × 7 min each
- **Documentation**: 30 minutes

---

## Next Steps

1. ✅ Review this plan
2. 🔄 Execute Phase 1 conversions
3. 🧪 Test each agent after conversion
4. 🔄 Execute Phase 2 conversions
5. 🧪 Run full test suite
6. 📝 Update documentation
7. ✅ Commit changes

---

## References

- A2A Streaming: https://baeke.info/2025/07/15/using-tasks-with-streaming-in-google-agent2agent-a2a/
- AI SDK streamText: https://sdk.vercel.ai/docs/ai-sdk-core/generating-text#streamtext
- A2AAdapter docs: `samples/js/src/shared/a2a-adapter.ts`

