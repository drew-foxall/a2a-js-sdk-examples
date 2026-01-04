# A2A Inspector UI Improvements Plan

## Overview

This document outlines the planned improvements to the A2A Inspector UI, focusing on two main areas:

1. **Agent Card Display Enhancement** - Show all available AgentCard fields
2. **Chat Suggestions** - Use skill examples as chat input suggestions

---

## 1. Agent Card Display Enhancement

### Current State

The `AgentCardDisplay` component (`a2a-inspector/components/connection/agent-card-display.tsx`) currently displays:

- ✅ `name` - Agent name
- ✅ `description` - Agent description
- ✅ `version` - Agent version badge
- ✅ `url` - Service endpoint URL
- ✅ `provider.organization` - Provider org name
- ✅ `provider.url` - Provider URL link
- ✅ `capabilities.streaming` - Capability badge
- ✅ `capabilities.pushNotifications` - Capability badge
- ✅ `capabilities.stateTransitionHistory` - Capability badge
- ✅ `skills` - Skills list (limited to 5, shows name, description, id)

### Missing Fields to Add

From the `AgentCard` interface in `@drew-foxall/a2a-js-sdk`:

| Field | Type | Description | Priority |
|-------|------|-------------|----------|
| `protocolVersion` | `string` | A2A protocol version | High |
| `preferredTransport` | `string?` | Preferred transport (JSONRPC, etc.) | High |
| `defaultInputModes` | `string[]` | Supported input MIME types | Medium |
| `defaultOutputModes` | `string[]` | Supported output MIME types | Medium |
| `documentationUrl` | `string?` | Link to agent documentation | Medium |
| `iconUrl` | `string?` | Agent icon URL | High |
| `additionalInterfaces` | `AgentInterface[]?` | Alternative transport URLs | Low |
| `security` | `object[]?` | Security requirements | Low |
| `securitySchemes` | `object?` | Available security schemes | Low |
| `supportsAuthenticatedExtendedCard` | `boolean?` | Extended card support | Low |
| `signatures` | `AgentCardSignature[]?` | JWS signatures | Low |

### Skill Fields to Add

From the `AgentSkill` interface:

| Field | Type | Description | Priority |
|-------|------|-------------|----------|
| `id` | `string` | Unique skill ID (✅ already shown) | - |
| `name` | `string` | Skill name (✅ already shown) | - |
| `description` | `string` | Skill description (✅ already shown) | - |
| `examples` | `string[]?` | Example prompts | **Critical** |
| `tags` | `string[]?` | Skill tags | Medium |
| `inputModes` | `string[]?` | Skill-specific input modes | Low |
| `outputModes` | `string[]?` | Skill-specific output modes | Low |

### Proposed Layout

```
┌─────────────────────────────────────────────────────────────┐
│  [Icon]  Agent Name                              v1.0.0     │
│          Short description...                               │
│          Protocol: 0.3.0 · Transport: JSONRPC               │
├─────────────────────────────────────────────────────────────┤
│  🌐 Endpoint                                                │
│  https://example.com/agent                                  │
│  [📖 Docs]                                                  │
├─────────────────────────────────────────────────────────────┤
│  🏢 Provider                                                │
│  Acme Corp                                                  │
├─────────────────────────────────────────────────────────────┤
│  ⚡ Capabilities                                            │
│  [Streaming] [Push Notifications] [State History]           │
├─────────────────────────────────────────────────────────────┤
│  📊 Supported Modes                                         │
│  Input: text/plain, application/json                        │
│  Output: text/plain                                         │
├─────────────────────────────────────────────────────────────┤
│  ✨ Skills (3)                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ # Roll Dice                                         │    │
│  │ Rolls an N-sided dice...                            │    │
│  │ [dice] [random] [game]                              │    │
│  │ Examples:                                           │    │
│  │   • "Roll a d20"                                    │    │
│  │   • "Roll 2d6"                                      │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ # Prime Detector                                    │    │
│  │ Determines which numbers are prime...               │    │
│  │ [prime] [math] [numbers]                            │    │
│  │ Examples:                                           │    │
│  │   • "Is 17 a prime number?"                         │    │
│  │   • "Check if 2, 3, 5, 7 are prime"                 │    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│  ⚠️ Validation Warnings                                    │
│  [warnings if any]                                          │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Steps

1. **Add `iconUrl` support** - Display agent icon if provided, fallback to Robot icon
2. **Add protocol/transport info** - Show `protocolVersion` and `preferredTransport` in header
3. **Add documentation link** - Add a "Docs" button/link if `documentationUrl` is provided
4. **Enhance input/output modes** - New section showing MIME types
5. **Enhance skills display**:
   - Show `tags` as small badges
   - Show `examples` as bullet list
   - Make examples clickable (for suggestion feature)
6. **Add collapsible sections** - For advanced info (security schemes, interfaces)

---

## 2. Chat Suggestions Feature

### Concept

When the chat area is empty or at any time, display clickable suggestion chips based on the agent's skill examples. This helps users quickly understand what the agent can do and reduces friction.

### Design Reference

Similar to the shadcn/ui Suggestion component pattern:
- Horizontal scrollable row of suggestion chips
- Click to populate the input field
- Optionally auto-submit

### Data Flow

```
AgentCard
   └── skills[]
        └── examples[]  ──────►  SuggestionChips
                                      │
                                      ▼
                                 Chat Input
```

### Implementation Options

#### Option A: Empty State Suggestions
Show suggestions only when no messages exist.

```tsx
<ConversationEmptyState>
  <SuggestionChips 
    suggestions={allExamples} 
    onSelect={handleSuggestionClick}
  />
</ConversationEmptyState>
```

#### Option B: Always-Visible Suggestions (Preferred)
Show suggestions above the input area, scrollable.

```tsx
<div className="chat-container">
  <Messages />
  <SuggestionBar suggestions={allExamples} />
  <PromptInput />
</div>
```

### Component Structure

```tsx
// New component: components/chat/suggestion-chips.tsx

interface SuggestionChipsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  className?: string;
}

function SuggestionChips({ suggestions, onSelect }: SuggestionChipsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto py-2">
      {suggestions.map((suggestion, idx) => (
        <button
          key={idx}
          onClick={() => onSelect(suggestion)}
          className="shrink-0 px-3 py-1.5 text-sm border rounded-full 
                     hover:bg-primary/10 hover:border-primary transition-colors"
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
```

### Extraction Logic

```typescript
function extractSuggestions(card: AgentCard): string[] {
  if (!card.skills) return [];
  
  return card.skills
    .flatMap(skill => skill.examples ?? [])
    .slice(0, 10); // Limit to reasonable number
}
```

### Integration Points

1. **DirectA2AView** (`components/views/direct-a2a-view.tsx`)
   - Has access to `agentCard` via `useConnection()`
   - Add suggestions above `PromptInput`
   
2. **AISDKView** (`components/views/ai-sdk-view.tsx`)
   - Same access pattern
   - Same integration point

3. **Empty State** 
   - Enhance `ConversationEmptyState` to accept suggestions
   - Display when `messages.length === 0`

### Behavior

1. **Click suggestion** → Populate input field
2. **Shift+Click suggestion** → Populate and auto-submit
3. **Visual feedback** → Chip shows "active" state briefly
4. **Scroll** → Horizontal scroll for many suggestions

---

## 3. File Structure

### New Files to Create

```
a2a-inspector/
├── components/
│   ├── chat/
│   │   └── suggestion-chips.tsx     # New suggestion component
│   └── connection/
│       └── agent-card-display.tsx   # Enhanced (existing)
```

### Files to Modify

```
a2a-inspector/
├── components/
│   ├── views/
│   │   ├── direct-a2a-view.tsx      # Add suggestions
│   │   └── ai-sdk-view.tsx          # Add suggestions
│   ├── ai-elements/
│   │   └── conversation.tsx         # Enhance empty state (if needed)
│   └── connection/
│       └── agent-card-display.tsx   # Enhance fields
```

---

## 4. Task Breakdown

### Phase 1: Agent Card Enhancement

- [ ] **1.1** Add `iconUrl` display with fallback
- [ ] **1.2** Add `protocolVersion` and `preferredTransport` to header
- [ ] **1.3** Add `documentationUrl` link button
- [ ] **1.4** Add input/output modes section
- [ ] **1.5** Enhance skill cards with `tags` badges
- [ ] **1.6** Add skill `examples` display
- [ ] **1.7** Add collapsible section for advanced details

### Phase 2: Suggestion Chips

- [ ] **2.1** Create `SuggestionChips` component
- [ ] **2.2** Add suggestion extraction utility
- [ ] **2.3** Integrate into `DirectA2AView`
- [ ] **2.4** Integrate into `AISDKView`
- [ ] **2.5** Add click-to-populate behavior
- [ ] **2.6** Add shift+click auto-submit behavior
- [ ] **2.7** Style and polish

### Phase 3: Polish

- [ ] **3.1** Test with various agent cards
- [ ] **3.2** Responsive design adjustments
- [ ] **3.3** Accessibility review
- [ ] **3.4** Documentation update

---

## 5. Technical Considerations

### Type Safety

The `AgentCard` type from `@drew-foxall/a2a-js-sdk` should be used directly. No custom type definitions needed.

### Icons

Use Phosphor Icons (already in project) for new UI elements:
- `BookOpen` for documentation
- `Tag` for tags
- `Lightbulb` for examples/suggestions
- `Shield` for security
- `ArrowsLeftRight` for transport

### Styling

Follow existing patterns:
- Use `cn()` utility for class composition
- Use existing color variables (`primary`, `muted-foreground`, etc.)
- Maintain consistent spacing (multiples of 4px)
- Use existing component primitives (Button, Badge, etc.)

---

## 6. Success Criteria

1. All AgentCard fields are visible (with sensible defaults for missing optional fields)
2. Skill examples are prominently displayed and clickable
3. Suggestions are intuitive and speed up user interaction
4. No regression in existing functionality
5. Works with agents that have no skills/examples (graceful degradation)

