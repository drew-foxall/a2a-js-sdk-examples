# Agent Naming Alignment: Python vs JavaScript

## Overview

This document tracks naming consistency between Python examples and JavaScript implementations to ensure easy cross-referencing.

---

## Current Naming Comparison

| Python Name | JavaScript Name | Match? | Notes |
|------------|----------------|--------|-------|
| `helloworld` | `hello-world` | ⚠️ | Hyphenated vs no separator |
| `dice_agent_rest` | `dice-agent` | ⚠️ | Underscore vs hyphen |
| `github-agent` | `github-agent` | ✅ | Perfect match |
| `analytics` | `analytics-agent` | ⚠️ | Added `-agent` suffix |
| `langgraph` | `currency-agent` | ❌ | Different name (currency is content) |
| `airbnb_planner_multiagent` | `travel-planner-multiagent` | ❌ | Different name |

---

## JavaScript-Specific Agents (Not in Python)

| JavaScript Name | Purpose | Notes |
|----------------|---------|-------|
| `movie-agent` | TMDB API demo | Original example for this repo |
| `coder` | Streaming code gen | Original example for this repo |
| `content-editor` | Text editing | Original example for this repo |

---

## Recommended Naming Convention

### Option 1: Match Python Exactly ⭐ **RECOMMENDED**
Use Python's exact naming for converted agents:

```
Python: helloworld          → JS: helloworld
Python: dice_agent_rest     → JS: dice_agent_rest
Python: analytics           → JS: analytics
Python: langgraph           → JS: langgraph (or currency-agent with note)
Python: airbnb_planner_multiagent → JS: airbnb_planner_multiagent
```

**Pros**:
- Easy cross-referencing
- No confusion about which Python agent was converted
- Documentation links work naturally
- Developers can find equivalents immediately

**Cons**:
- Mix of naming styles (hyphens, underscores, no separator)
- Less consistent within JavaScript codebase

---

### Option 2: Keep Current JavaScript Naming
Maintain current hyphenated convention:

```
Python: helloworld          → JS: hello-world
Python: dice_agent_rest     → JS: dice-agent
Python: analytics           → JS: analytics-agent
Python: langgraph           → JS: currency-agent
Python: airbnb_planner_multiagent → JS: travel-planner-multiagent
```

**Pros**:
- Consistent JavaScript/npm naming convention
- More readable (hyphens)
- Cleaner in package.json scripts

**Cons**:
- Requires mapping table for cross-reference
- Users need to look up equivalent names
- More documentation needed

---

### Option 3: Hybrid Approach ⚡ **PRAGMATIC**
Match Python for converted agents, keep custom names for originals:

**Converted Agents** (match Python):
```
helloworld
dice_agent_rest
analytics
langgraph  (with note: currency conversion)
airbnb_planner_multiagent
```

**Original Agents** (keep current):
```
movie-agent
coder
content-editor
```

**Pros**:
- Clear which are conversions vs originals
- Easy Python cross-reference for conversions
- JavaScript conventions for new agents

**Cons**:
- Mixed naming within codebase

---

## Proposed Actions

### Immediate: Document Current Mapping ✅

Create clear mapping in `PYTHON_TO_JS_CONVERSION_PLAN.md`:

| Python Source | JavaScript Implementation | Status |
|--------------|---------------------------|---------|
| `helloworld` | `hello-world` | ✅ Implemented |
| `dice_agent_rest` | `dice-agent` | ✅ Implemented |
| `github-agent` | `github-agent` | ✅ Implemented |
| `analytics` | `analytics-agent` | ✅ Implemented |
| `langgraph` | `currency-agent` | ✅ Implemented |
| `airbnb_planner_multiagent` | `travel-planner-multiagent` | ✅ Implemented |

### Optional: Rename for Exact Match

If we want **exact Python naming**:

```bash
# Rename operations (these would need to be done carefully)
mv samples/js/src/agents/hello-world samples/js/src/agents/helloworld
mv samples/js/src/agents/dice-agent samples/js/src/agents/dice_agent_rest
mv samples/js/src/agents/analytics-agent samples/js/src/agents/analytics
mv samples/js/src/agents/currency-agent samples/js/src/agents/langgraph
mv samples/js/src/agents/travel-planner-multiagent samples/js/src/agents/airbnb_planner_multiagent

# Would also need to update:
# - package.json scripts
# - README references
# - Import paths
# - Documentation
```

---

## Recommendation

### ⭐ **RECOMMENDED**: Add Clear Mapping, Keep Current Names

**Reason**: Renaming at this stage would be disruptive and the current names are more JavaScript-idiomatic. Instead:

1. ✅ **Add Python source mapping** to conversion plan
2. ✅ **Document equivalents** in README
3. ✅ **Create this alignment document** for reference
4. ✅ **Add comments** in each agent's README linking to Python source

**Example addition to agent README**:
```markdown
# Hello World Agent

**Python Equivalent**: [`helloworld`](https://github.com/a2aproject/a2a-samples/tree/main/samples/python/agents/helloworld)

This is the JavaScript/TypeScript implementation of the Python helloworld agent...
```

---

## Future Agent Conversions

### For New Conversions Going Forward

**Use Python's exact name** to avoid confusion:

- If converting `content_planner` → use `content_planner` (not `content-planner`)
- If converting `birthday_planner_adk` → use `birthday_planner_adk`
- If converting `travel_planner_agent` → use `travel_planner_agent`

**Exception**: If Python name conflicts with existing JS agent, document clearly.

---

## Impact Analysis

### Breaking Changes if We Rename

Renaming existing agents would affect:
- [ ] Package.json scripts (21 references)
- [ ] README.md documentation
- [ ] Import paths in tests (if any)
- [ ] User bookmarks/documentation
- [ ] Git history clarity
- [ ] Existing deployments

**Verdict**: Not worth the disruption at this stage.

---

## Implementation Plan

### Phase 1: Documentation (Immediate) ✅
- [x] Create this alignment document
- [ ] Add Python source links to each agent README
- [ ] Add mapping table to PYTHON_TO_JS_CONVERSION_PLAN.md
- [ ] Update main README with cross-reference section

### Phase 2: Future Conversions
- [ ] Use exact Python names for new conversions
- [ ] Document any naming decisions clearly
- [ ] Keep this alignment doc updated

### Phase 3: Optional Rename (Future)
- [ ] Consider renaming if project reaches 1.0 release
- [ ] Provide migration guide if renaming occurs
- [ ] Use redirects/deprecation warnings

---

## Naming Style Guide for Future Agents

### Converting from Python
**Rule**: Match Python name exactly

```
Python: some_agent_name     → JS: some_agent_name
Python: some-agent-name     → JS: some-agent-name
Python: someagentname       → JS: someagentname
```

### Creating New JavaScript Agents
**Rule**: Use kebab-case (hyphenated)

```
Good: movie-agent, code-generator, data-analyzer
Bad: movie_agent, movieagent, MovieAgent
```

**Rationale**: Follows npm/JavaScript community conventions

---

## Cross-Reference Quick Lookup

```yaml
# Python → JavaScript Mapping
helloworld: hello-world
dice_agent_rest: dice-agent
github-agent: github-agent
analytics: analytics-agent
langgraph: currency-agent
airbnb_planner_multiagent: travel-planner-multiagent

# JavaScript-Only Agents (no Python equivalent)
- movie-agent
- coder
- content-editor
```

---

## Conclusion

**Decision**: Keep current JavaScript names for consistency within the JS codebase, but:

1. ✅ Clearly document Python source mapping
2. ✅ Add cross-reference links in READMEs
3. ✅ Use exact Python names for future conversions
4. ✅ Maintain this alignment document

**Result**: Users can easily find Python equivalents without breaking existing JavaScript implementations.

---

*This document should be updated whenever new agents are converted or naming decisions are made.*

