# A2A Inspector UI Reorganization Plan

> **Status**: Phase 4 Complete - Client-Side Chat/Message Storage ✅  
> **Created**: 2025-12-23  
> **Last Updated**: 2025-12-23

## ✅ Phase 1 Completed

**What was built:**
- `lib/agent-id.ts` - Agent ID generation utility (slug-hash format)
- `lib/storage/` - IndexedDB storage module using `idb`
  - `types.ts` - Type definitions for stored agents, chats, messages
  - `agent-store.ts` - CRUD operations for agents
  - `index.ts` - Module exports
- `app/agent/[agentId]/page.tsx` - Agent page (redirects to new chat)
- `app/agent/[agentId]/chat/[chatId]/page.tsx` - Chat placeholder page
- `components/routing/legacy-agent-redirect.tsx` - Handles `?agent=URL` legacy URLs
- Updated `app/page.tsx` to use LegacyAgentRedirect wrapper

**How it works:**
1. Legacy URL `/?agent=http://localhost:8788` triggers redirect flow
2. LegacyAgentRedirect fetches agent card via Eden Treaty (`client.api["agent-card"].post()`)
3. Agent saved to IndexedDB with generated ID (e.g., `dice-agent-6edddc58`)
4. Redirects to `/agent/dice-agent-6edddc58`
5. Agent page generates new chat ID and redirects to `/agent/dice-agent-6edddc58/chat/[uuid]`
6. Chat page loads agent from IndexedDB and displays placeholder UI

---

## ✅ Phase 2 Completed

**What was built:**
- `hooks/use-mobile.ts` - Mobile viewport detection hook
- `components/ui/sidebar.tsx` - Shadcn sidebar component (with `@ts-nocheck` for complex base-ui types)
- `components/sidebar/` - Sidebar components
  - `app-sidebar.tsx` - Main sidebar with agent switcher, navigation, chat history placeholder
  - `agent-switcher.tsx` - Searchable dropdown for switching between saved agents
  - `site-header.tsx` - Sticky header with sidebar toggle, breadcrumbs
  - `index.ts` - Module exports
- `app/agent/[agentId]/layout.tsx` - Layout following sidebar-16 pattern
- Added `SidebarRail` for click-to-collapse functionality

**How it works:**
1. Agent layout wraps pages with `SidebarProvider` and sticky `SiteHeader`
2. Sidebar toggle button in header controls open/collapsed state
3. `SidebarRail` provides edge click to toggle sidebar
4. `AgentSwitcher` loads agents from IndexedDB and allows searching/switching
5. Breadcrumb shows current agent name in header

---

## ✅ Phase 3 Completed

**What was built:**
- `components/landing/agent-grid.tsx` - Searchable grid of saved agents
- `components/landing/index.ts` - Module exports
- Updated `app/page.tsx` to include AgentGrid and conditionally hide welcome section

**How it works:**
1. AgentGrid loads agents from IndexedDB on mount
2. Displays cards with agent name, description, skills count, host
3. Cards are clickable → navigates to `/agent/[agentId]`
4. Remove button (X) on hover allows deleting agents
5. Search input appears when >3 agents (filters by name, description, URL)
6. Welcome section ("Connect to an Agent") only shows when no saved agents
7. `onAgentsChange` callback notifies parent when agents list changes

---

## ✅ Phase 4 Completed

**What was built:**
- `lib/storage/db.ts` - Shared IndexedDB schema with agents, chats, messages stores
- `lib/storage/chat-store.ts` - CRUD operations for chat sessions
- `lib/storage/message-store.ts` - CRUD operations for messages
- Updated `lib/storage/types.ts` with additional types for chat/message operations
- Database version upgraded to v2 with migration support

**Key Features:**
- **Chats**: Create, read, list (with agent filter), update title, delete (cascades to messages)
- **Messages**: Add single/batch, list (ordered by timestamp), update content/metadata, delete
- **Indexing**: Efficient lookups via IndexedDB indexes (by-agentId, by-chatId, by-timestamp, etc.)
- **Transactions**: Atomic operations for batch inserts and cascade deletes

**API Examples:**
```typescript
// Create a chat
const chat = await createChat({
  id: generateId(),
  agentId: "dice-agent-a3f8b2c1",
  title: "Dice Rolling Session",
});

// Add messages
await addMessages([
  { id: "msg1", chatId: chat.id, role: "user", content: "Roll a d20" },
  { id: "msg2", chatId: chat.id, role: "assistant", content: "You rolled 17!" },
]);

// List chats for an agent
const chats = await listChats({
  agentId: "dice-agent-a3f8b2c1",
  sortBy: "updatedAt",
  sortOrder: "desc",
  limit: 10,
});

// Get messages for a chat
const messages = await getMessagesForChat(chat.id);
```

**Also Added:**
- Dark mode toggle using `next-themes` (following shadcn docs pattern)
- `components/theme-provider.tsx` - ThemeProvider wrapper
- `components/mode-toggle.tsx` - Dropdown with Light/Dark/System options
- Mode toggle added to landing page header and agent page header

---

## Table of Contents

1. [Overview](#overview)
2. [Current State](#current-state)
3. [Target Architecture](#target-architecture)
4. [URL Structure](#url-structure)
5. [Component Hierarchy](#component-hierarchy)
6. [Data Architecture](#data-architecture)
7. [Implementation Phases](#implementation-phases)
8. [Dependencies](#dependencies)
9. [Migration Strategy](#migration-strategy)
10. [Open Questions](#open-questions)

---

## Overview

### Goals

- **Multi-page workflow**: Transform single-page app into a proper multi-page experience
- **Agent management**: Allow users to add, browse, and manage connected agents
- **Chat history**: Implement persistent chat history (client + server)
- **Authentication**: Add GitHub OAuth for server-side history sync
- **Improved UX**: Sidebar navigation, searchable agent switcher/grid, collapsible panels

### Search Functionality

| Component | Searchable? | Notes |
|-----------|-------------|-------|
| Agent grid (landing page) | ✅ Yes | Filter by name, description |
| Agent switcher (sidebar) | ✅ Yes | Combobox with type-to-search |
| Chat history list | ❌ No | Simple chronological list |

### Key User Flows

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Landing Page  │ ──▶  │   Agent Card     │ ──▶  │   Chat View     │
│                 │      │   Selection      │      │                 │
│  • Add new URL  │      │  • Agent grid    │      │  • Messages     │
│  • Browse saved │      │  • Search/filter │      │  • History list │
│                 │      │                  │      │  • Agent panel  │
└─────────────────┘      └──────────────────┘      └─────────────────┘
```

---

## Current State

### Current File Structure

```
a2a-inspector/
├── app/
│   ├── page.tsx              # Single monolithic page
│   ├── layout.tsx
│   └── api/
│       ├── agent-card/
│       ├── stream/
│       └── ai-sdk-chat/
├── components/
│   ├── views/
│   │   ├── direct-a2a-view.tsx
│   │   └── ai-sdk-view.tsx
│   ├── connection/
│   │   ├── agent-card-display.tsx
│   │   └── ...
│   └── ai-elements/
│       ├── message.tsx
│       ├── prompt-input.tsx
│       └── suggestion.tsx
└── lib/
    └── utils.ts
```

### Current Behavior

- Single page at `/`
- Agent URL passed as query param: `/?agent=http://...`
- No persistent history
- No authentication
- All state in React useState

---

## Target Architecture

### New File Structure

```
a2a-inspector/
├── app/
│   ├── layout.tsx                    # Root layout with providers
│   ├── page.tsx                      # Landing page (add agent, grid)
│   ├── agent/
│   │   └── [agentId]/
│   │       ├── page.tsx              # Agent overview/chat selection
│   │       └── chat/
│   │           └── [chatId]/
│   │               └── page.tsx      # Active chat view
│   ├── auth/
│   │   └── [...all]/
│   │       └── route.ts              # Better Auth routes
│   └── api/
│       ├── agent-card/
│       ├── stream/
│       ├── ai-sdk-chat/
│       └── history/                  # New: history API
│           ├── agents/
│           └── chats/
├── components/
│   ├── layout/
│   │   ├── app-sidebar.tsx           # Main sidebar (shadcn)
│   │   ├── agent-panel.tsx           # Right collapsible panel
│   │   └── nav-*.tsx                 # Navigation components
│   ├── agents/
│   │   ├── agent-grid.tsx            # Searchable agent grid
│   │   ├── agent-card-mini.tsx       # Grid card variant
│   │   └── add-agent-form.tsx        # Add new agent
│   ├── chat/
│   │   ├── chat-view.tsx             # Main chat area
│   │   ├── chat-history-list.tsx     # History in sidebar
│   │   └── chat-message.tsx          # Individual message
│   ├── views/                        # Keep existing for now
│   └── ai-elements/                  # Keep existing
├── lib/
│   ├── utils.ts
│   ├── auth.ts                       # Better Auth config
│   ├── db/
│   │   ├── schema.ts                 # Drizzle schema
│   │   ├── client.ts                 # Database client
│   │   └── migrations/
│   └── history/
│       ├── client-store.ts           # IndexedDB store
│       ├── server-store.ts           # Server API calls
│       └── use-history.ts            # Unified hook
└── providers/
    ├── auth-provider.tsx
    └── history-provider.tsx
```

---

## URL Structure

### Routes

| Route | Description | Auth Required |
|-------|-------------|---------------|
| `/` | Landing page - add agent, browse saved | No |
| `/agent/[agentId]` | Agent overview (recent chats, start new) | No |
| `/agent/[agentId]/chat/[chatId]` | Active chat with agent | No |
| `/auth/signin` | Sign in page | No |
| `/auth/callback/github` | OAuth callback | No |
| `/settings` | User settings (future) | Yes |

### Agent ID Strategy

Agent IDs should be URL-safe and stable. Options:

1. **Base64 URL encoding**: `btoa(agentUrl)` → `/agent/aHR0cDovL2xvY2Fs...`
2. **Hash-based**: `sha256(agentUrl).slice(0, 12)` → `/agent/a3f8b2c1d4e5`
3. **Slugified name + hash**: `dice-agent-a3f8b2` → `/agent/dice-agent-a3f8b2`

**Recommendation**: Option 3 (slugified name + short hash) for readability

### Chat ID Strategy

- UUIDs for new chats: `crypto.randomUUID()`
- Format: `/agent/dice-agent-a3f8b2/chat/550e8400-e29b-41d4-a716-446655440000`

---

## Component Hierarchy

### Root Layout

```tsx
<RootLayout>
  <AuthProvider>
    <HistoryProvider>
      <SidebarProvider>
        <AppSidebar />           {/* Left sidebar */}
        <SidebarInset>
          <Header />             {/* Breadcrumbs, user menu */}
          <main>{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </HistoryProvider>
  </AuthProvider>
</RootLayout>
```

### Page Components

```
Landing Page (/)
├── AddAgentForm
└── AgentGrid
    └── AgentCardMini (×n)

Agent Page (/agent/[agentId])
├── AgentHeader
├── RecentChats
└── StartNewChatButton

Chat Page (/agent/[agentId]/chat/[chatId])
├── ChatView (center)
│   ├── MessageList
│   ├── Suggestions
│   └── PromptInput
└── AgentPanel (right, collapsible)
    └── AgentCardDisplay
```

### Sidebar Structure

```
AppSidebar
├── SidebarHeader
│   └── AgentSwitcher (searchable dropdown/combobox)
├── SidebarContent
│   ├── NavMain
│   │   ├── Home link
│   │   └── Current agent link
│   └── ChatHistoryList (simple list, not searchable)
│       └── ChatHistoryItem (×n)
├── SidebarFooter
│   └── UserMenu (auth status, settings)
└── SidebarRail (collapse toggle)
```

> **Note**: Agent switcher is searchable (combobox pattern), but chat history is a simple chronological list without search.

---

## AI SDK Persistence Assessment

### Two Streaming Methods Comparison

| Aspect | Direct A2A View | AI SDK View |
|--------|-----------------|-------------|
| **Hook** | Custom `useDirectA2A` | AI SDK `useChat` |
| **Message Type** | Custom `ChatMessage[]` | AI SDK `UIMessage[]` |
| **Transport** | Eden Treaty SSE | `DefaultChatTransport` |
| **Has `initialMessages`** | ❌ No (needs adding) | ✅ Yes (via `useChat`) |
| **Has `onFinish`** | ❌ Manual (task complete) | ✅ Yes (built-in) |
| **Persistence Approach** | Manual save after task | Use `onFinish` callback |

### AI SDK Persistence Pattern (from docs)

The AI SDK guide recommends:

```tsx
// Loading: Pass initialMessages to useChat
const { messages } = useChat({
  id: chatId,
  initialMessages: loadedMessages,  // ← Load from storage
});

// Saving: Use onFinish callback
return result.toUIMessageStreamResponse({
  originalMessages: messages,
  onFinish: ({ messages }) => {
    saveChat({ chatId, messages });  // ← Save to storage
  },
});
```

### Applying to Our Views

#### AI SDK View (`useChat`)

**Can directly use AI SDK patterns:**

```tsx
// In AISDKView component
const { messages, sendMessage } = useChat({
  id: chatId,                    // Chat ID from URL
  initialMessages,               // Loaded from storage (prop from page)
  transport: new DefaultChatTransport({
    api: "/api/ai-sdk-chat",
    body: () => ({ agentUrl, contextId, chatId }),  // Add chatId
  }),
  onFinish: ({ message }) => {
    // Client-side: Save to IndexedDB
    // Server-side: API handles via onFinish in route
  },
});
```

**Server route changes needed:**

```tsx
// app/api/ai-sdk-chat/route.ts
export async function POST(req: Request) {
  const { messages, chatId, agentUrl } = await req.json();
  
  const result = streamText({ /* ... */ });
  
  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onFinish: async ({ messages }) => {
      // For logged-in users, save to database
      const session = await getSession();
      if (session?.user) {
        await saveChat({ chatId, userId: session.user.id, messages });
      }
    },
  });
}
```

#### Direct A2A View (Custom Hook)

**Needs custom persistence layer:**

```tsx
// In useDirectA2A hook - add persistence support
export function useDirectA2A(agentUrl: string | null, options?: {
  chatId?: string;
  initialMessages?: ChatMessage[];
  onMessageComplete?: (messages: ChatMessage[]) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    options?.initialMessages ?? []
  );
  
  // After task completes, trigger save callback
  const handleTaskComplete = (task: Task) => {
    options?.onMessageComplete?.(messages);
  };
}
```

**Conversion between formats:**

```tsx
// lib/history/message-converters.ts

// Convert Direct A2A messages to storable format
function chatMessageToStorable(msg: ChatMessage): StorableMessage {
  return {
    id: msg.id,
    role: msg.sender === "user" ? "user" : "assistant",
    content: msg.aggregatedText,
    rawEvents: msg.rawEvents,  // Preserve A2A events
    timestamp: msg.timestamp,
  };
}

// Convert AI SDK UIMessage to storable format  
function uiMessageToStorable(msg: UIMessage): StorableMessage {
  return {
    id: msg.id,
    role: msg.role,
    content: msg.parts.filter(isTextUIPart).map(p => p.text).join(''),
    parts: msg.parts,  // Preserve all parts
    timestamp: msg.createdAt,
  };
}
```

### Unified Storage Format

To support both views, we need a **unified message format** that can be converted to either:

```typescript
// Storable format that works for both views
interface StorableMessage {
  id: string;
  role: "user" | "assistant";
  content: string;                    // Plain text for display
  timestamp: Date;
  
  // View-specific data (optional)
  uiParts?: UIPart[];                 // For AI SDK view
  a2aEvents?: RawA2AEvent[];          // For Direct A2A view
  taskId?: string;                    // A2A task reference
}

interface StorableChat {
  id: string;
  agentId: string;
  title: string;
  messages: StorableMessage[];
  createdAt: Date;
  updatedAt: Date;
  
  // Metadata
  lastViewUsed: "direct-a2a" | "ai-sdk";  // Track which view created it
}
```

### Server History for Logged-In Users

**Authentication flow:**

```
User clicks "Sign in with GitHub"
  → Better Auth handles OAuth flow
  → User session created
  → useHistory hook detects logged-in state
  → Sync local IndexedDB → Server database
```

**Sync strategy:**

1. **On login**: Upload local chats to server (merge by chat ID)
2. **On message send**: Save to both IndexedDB (immediate) and server (async)
3. **On page load**: Check server for newer data, merge if needed
4. **On logout**: Keep local copy, stop server sync

**Server save in `onFinish` (AI SDK route):**

```tsx
// Only save to server if user is logged in
onFinish: async ({ messages }) => {
  const session = await auth.api.getSession({ headers: req.headers });
  
  if (session?.user) {
    await db.insert(chatMessages).values(
      messages.map(m => ({
        id: m.id,
        sessionId: chatId,
        userId: session.user.id,
        role: m.role,
        content: JSON.stringify(m.parts),
        createdAt: m.createdAt,
      }))
    ).onConflictDoUpdate({ /* upsert logic */ });
  }
}
```

### Key Implementation Notes

1. **Client-side always saves to IndexedDB** (works offline, fast)
2. **Server-side saves only when logged in** (via `onFinish` or manual API call)
3. **Both views use same storage abstraction** (`useHistory` hook)
4. **AI SDK's `validateUIMessages`** should be used when loading AI SDK view messages
5. **Direct A2A needs custom validation** for loaded messages
6. **Use `consumeStream()`** to ensure messages save even on client disconnect

---

## Data Architecture

### Client-Side Storage (IndexedDB via `idb`)

```typescript
// Schema for IndexedDB
// Database name: 'a2a-inspector-db'
// Version: 1

interface AgentStoreSchema {
  // Object store: 'agents'
  // Key path: 'id'
  // Indexes: 'url' (unique), 'lastUsedAt'
  agents: {
    id: string;              // Generated ID (slug-hash format)
    url: string;             // Agent URL (unique)
    name: string;            // From agent card
    description: string;     // From agent card
    card: AgentCard;         // Full cached agent card JSON
    cardFetchedAt: Date;     // When card was last fetched
    addedAt: Date;           // When user first added this agent
    lastUsedAt: Date;        // For sorting in recent list
  };
  
  // Object store: 'chats'
  // Key path: 'id'
  // Indexes: 'agentId', 'updatedAt'
  chats: {
    id: string;              // Chat UUID
    agentId: string;         // Reference to agent.id
    title: string;           // Auto-generated from first message
    createdAt: Date;
    updatedAt: Date;
  };
  
  // Object store: 'messages'
  // Key path: 'id'
  // Indexes: 'chatId', 'timestamp'
  messages: {
    id: string;              // Message UUID
    chatId: string;          // Reference to chat.id
    role: 'user' | 'assistant';
    content: string;         // Plain text content
    timestamp: Date;
    // View-specific data stored as JSON
    metadata?: {
      uiParts?: unknown[];       // AI SDK parts
      a2aEvents?: unknown[];     // Direct A2A events
      taskId?: string;
    };
  };
}
```

### Agent Storage Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    ADD NEW AGENT FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Landing Page                                                   │
│  ┌─────────────────┐                                           │
│  │ Enter URL       │                                           │
│  │ [____________]  │                                           │
│  │ [Connect]       │                                           │
│  └────────┬────────┘                                           │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────┐     ┌──────────────────┐                  │
│  │ Fetch agent     │────▶│ Validate card    │                  │
│  │ card from URL   │     │ (has name, url)  │                  │
│  └─────────────────┘     └────────┬─────────┘                  │
│                                   │                             │
│                                   ▼                             │
│  ┌─────────────────┐     ┌──────────────────┐                  │
│  │ Generate ID     │◀────│ Check if agent   │                  │
│  │ (slug + hash)   │     │ already exists   │                  │
│  └────────┬────────┘     └──────────────────┘                  │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────┐     ┌──────────────────┐                  │
│  │ Save to         │────▶│ If logged in:    │                  │
│  │ IndexedDB       │     │ sync to server   │                  │
│  └────────┬────────┘     └──────────────────┘                  │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────┐                                           │
│  │ Redirect to     │                                           │
│  │ /agent/[id]     │                                           │
│  └─────────────────┘                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Agent ID Generation

```typescript
// lib/agent-id.ts
import { AgentCard } from "@drew-foxall/a2a-js-sdk";

/**
 * Generate a URL-safe, human-readable agent ID.
 * Format: {slugified-name}-{short-hash}
 * Example: "dice-agent-a3f8b2c1"
 */
export function generateAgentId(card: AgentCard, url: string): string {
  const slug = slugify(card.name);
  const hash = shortHash(url);
  return `${slug}-${hash}`;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
}

function shortHash(input: string): string {
  // Simple hash - in production use crypto.subtle
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).slice(0, 8);
}

/**
 * Parse agent ID back to check format validity.
 */
export function isValidAgentId(id: string): boolean {
  return /^[a-z0-9-]+-[a-f0-9]{1,8}$/.test(id);
}
```
```

### Server-Side Storage (PostgreSQL via Drizzle + Neon)

```typescript
// Drizzle schema
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const savedAgents = pgTable('saved_agents', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id),
  url: text('url').notNull(),
  cardJson: jsonb('card_json'),
  addedAt: timestamp('added_at').defaultNow(),
  lastUsedAt: timestamp('last_used_at'),
});

export const chatSessions = pgTable('chat_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id),
  agentId: text('agent_id').references(() => savedAgents.id),
  title: text('title'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at'),
});

export const chatMessages = pgTable('chat_messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').references(() => chatSessions.id),
  role: text('role').notNull(), // 'user' | 'agent'
  content: jsonb('content'),    // Message parts
  createdAt: timestamp('created_at').defaultNow(),
});
```

### History Hook (Unified Interface)

```typescript
// Abstracts client vs server storage
function useHistory() {
  const { user } = useAuth();
  
  return {
    // Agents
    agents: StoredAgent[];
    addAgent: (url: string, card: AgentCard) => Promise<StoredAgent>;
    removeAgent: (id: string) => Promise<void>;
    updateAgentLastUsed: (id: string) => Promise<void>;
    
    // Chats
    getChatsForAgent: (agentId: string) => StorableChat[];
    createChat: (agentId: string) => Promise<StorableChat>;
    getChat: (chatId: string) => Promise<StorableChat | null>;
    
    // Messages - view-agnostic save
    saveMessages: (chatId: string, messages: StorableMessage[]) => Promise<void>;
    
    // Converters for loading into specific views
    toChatMessages: (messages: StorableMessage[]) => ChatMessage[];      // Direct A2A
    toUIMessages: (messages: StorableMessage[]) => UIMessage[];          // AI SDK
    
    // Sync (when logged in)
    isLoggedIn: boolean;
    syncStatus: 'synced' | 'syncing' | 'offline' | 'local-only';
    syncNow: () => Promise<void>;
  };
}
```

### View Integration Pattern

```tsx
// AI SDK View - loading and saving
function AISDKView({ chatId }: { chatId: string }) {
  const { getChat, saveMessages, toUIMessages } = useHistory();
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  
  useEffect(() => {
    getChat(chatId).then(chat => {
      if (chat) setInitialMessages(toUIMessages(chat.messages));
    });
  }, [chatId]);
  
  const { messages } = useChat({
    id: chatId,
    initialMessages,
    onFinish: ({ message }) => {
      // Convert and save
      saveMessages(chatId, [uiMessageToStorable(message)]);
    },
  });
}

// Direct A2A View - loading and saving  
function DirectA2AView({ chatId }: { chatId: string }) {
  const { getChat, saveMessages, toChatMessages } = useHistory();
  
  const { messages, sendMessage } = useDirectA2A(agentUrl, {
    chatId,
    initialMessages: toChatMessages(loadedChat?.messages ?? []),
    onMessagesChange: (msgs) => {
      saveMessages(chatId, msgs.map(chatMessageToStorable));
    },
  });
}
```
```

---

## Implementation Phases

### Phase 1: Routing Foundation ✅ COMPLETE
**Estimated: 2-3 days**

> **Important Dependency**: Agent cards must be saved to storage before routing works.
> The agent ID is derived from the stored agent, not just the URL.

**Flow when adding an agent:**
```
1. User enters agent URL on landing page
2. Fetch agent card from /.well-known/agent-card.json
3. Generate agent ID (slug + hash)
4. Save agent + card to IndexedDB (always, for offline)
5. If logged in: also save to server database
6. Redirect to /agent/[agentId]
```

**Flow when visiting /agent/[agentId]:**
```
1. Look up agent in storage by ID
2. If not found: redirect to / with error
3. If found but stale: re-fetch card in background
4. Load agent context and render page
```

- [x] Set up Next.js App Router file structure
- [x] Create route groups and layouts
- [x] Implement agent ID generation utility
- [x] **Create minimal agent storage layer** (IndexedDB only for Phase 1)
- [x] Create placeholder pages for all routes
- [x] Set up URL navigation between pages
- [ ] Move existing chat functionality to new chat page *(deferred to Phase 4)*

**Files created:**
- `app/agent/[agentId]/page.tsx`
- `app/agent/[agentId]/chat/[chatId]/page.tsx`
- `lib/agent-id.ts`
- `lib/storage/agent-store.ts`
- `lib/storage/types.ts`
- `lib/storage/index.ts`
- `components/routing/legacy-agent-redirect.tsx`

### Phase 2: Sidebar Navigation ✅ COMPLETE
**Estimated: 2-3 days**

- [x] Install shadcn sidebar components
- [x] Create `AppSidebar` component
- [x] Implement searchable agent switcher (combobox pattern)
- [x] Add simple chat history list in sidebar (chronological, no search) *(placeholder)*
- [ ] Create collapsible right panel for agent info *(deferred to Phase 4)*
- [x] Style and theme consistency

**Reference:** [shadcn Sidebar Blocks](https://ui.shadcn.com/blocks/sidebar)

**Files created:**
- `components/sidebar/app-sidebar.tsx`
- `components/sidebar/agent-switcher.tsx` (searchable dropdown)
- `components/sidebar/index.ts`
- `app/agent/[agentId]/layout.tsx`
- `hooks/use-mobile.ts`
- `components/ui/sidebar.tsx` (shadcn)
- `components/ui/sheet.tsx` (shadcn)
- `components/ui/skeleton.tsx` (shadcn)
- `components/ui/avatar.tsx` (shadcn)

### Phase 3: Landing Page & Agent Grid ⏳
**Estimated: 2 days**

- [ ] Design agent grid component
- [ ] Create mini agent card for grid
- [ ] Add search/filter for agent grid (by name, description)
- [ ] Create "Add new agent" form/modal
- [ ] Implement agent card caching

**Files to create:**
- `components/agents/agent-grid.tsx` (with search input)
- `components/agents/agent-card-mini.tsx`
- `components/agents/add-agent-form.tsx`

### Phase 4: Client-Side History (IndexedDB) ⏳
**Estimated: 2-3 days**

> **Note**: Phase 1 creates minimal agent storage. Phase 4 expands this to full
> chat/message persistence and the unified `useHistory` hook.

- [ ] Expand IndexedDB schema to include chats and messages stores
- [ ] Implement chat history persistence
- [ ] Implement message persistence with view-specific metadata
- [ ] Create `useHistory` hook with full API
- [ ] Add message converters (StorableMessage ↔ ChatMessage/UIMessage)
- [ ] Add simple chronological history list UI in sidebar
- [ ] Handle storage migration for schema changes

**Files to create/update:**
- `lib/storage/agent-store.ts` → expand to full store
- `lib/storage/chat-store.ts`
- `lib/storage/message-store.ts`
- `lib/storage/converters.ts`
- `lib/history/use-history.ts`
- `components/chat/chat-history-list.tsx` (simple list, sorted by date)

### Phase 5: Authentication (Better Auth + GitHub) ⏳
**Estimated: 2-3 days**

- [ ] Install Better Auth packages
- [ ] Configure GitHub OAuth provider
- [ ] Create auth configuration
- [ ] Set up auth API routes
- [ ] Create auth provider component
- [ ] Add sign in/out UI
- [ ] Handle auth state in app

**Reference:** [Better Auth GitHub Setup](https://www.better-auth.com/docs/authentication/github)

**Files to create:**
- `lib/auth.ts`
- `app/api/auth/[...all]/route.ts`
- `providers/auth-provider.tsx`
- `components/auth/user-menu.tsx`

### Phase 6: Server-Side History (Drizzle + Neon) ⏳
**Estimated: 3-4 days**

- [ ] Install Drizzle and Neon packages
- [ ] Create database schema
- [ ] Set up Drizzle client
- [ ] Create migration files
- [ ] Implement server history API routes
- [ ] Create server store abstraction
- [ ] Implement sync between client/server
- [ ] Add sync status UI

**Reference:** [Neon Local Development Guide](https://neon.com/guides/local-development-with-neon)

**Files to create:**
- `lib/db/schema.ts`
- `lib/db/client.ts`
- `lib/db/migrations/`
- `lib/history/server-store.ts`
- `app/api/history/agents/route.ts`
- `app/api/history/chats/route.ts`

### Phase 7: Polish & Migration ⏳
**Estimated: 2 days**

- [ ] Remove old single-page code
- [ ] Update all imports and references
- [ ] Comprehensive testing
- [ ] Fix edge cases and bugs
- [ ] Update documentation
- [ ] Performance optimization

---

## Dependencies

### New Packages Required

```json
{
  "dependencies": {
    // Routing (already have Next.js)
    
    // UI
    "@radix-ui/react-collapsible": "^1.x",
    // Other shadcn dependencies as needed
    
    // Client Storage
    "idb": "^8.x",
    
    // Authentication
    "better-auth": "^1.x",
    
    // Database
    "@neondatabase/serverless": "^0.x",
    "drizzle-orm": "^0.x",
    "drizzle-kit": "^0.x"
  }
}
```

### Environment Variables Required

```bash
# GitHub OAuth (Better Auth)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
BETTER_AUTH_SECRET=

# Neon Database
DATABASE_URL=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3002
```

---

## Migration Strategy

### Preserving Current Functionality

During migration:
1. Keep existing `/?agent=URL` working with redirect to new routes
2. Maintain all current API endpoints
3. Existing chat views become components in new structure

### Redirect Mapping

```typescript
// middleware.ts or page redirect
if (searchParams.has('agent')) {
  const agentUrl = searchParams.get('agent');
  const agentId = generateAgentId(agentUrl);
  redirect(`/agent/${agentId}`);
}
```

### Data Migration (IndexedDB)

When user first visits after update:
1. Check for any localStorage/sessionStorage data
2. Migrate to IndexedDB structure
3. Clear old storage

---

## Open Questions

### Design Decisions Needed

1. **Agent ID format**: Which option for URL-safe IDs?
   - [ ] Base64 encoding
   - [ ] Hash-based
   - [x] Slugified name + hash (recommended)

2. **Chat title generation**: How to auto-title chats?
   - [ ] First user message (truncated)
   - [ ] AI-generated summary
   - [ ] Timestamp-based

3. **Offline support**: How much offline functionality?
   - [ ] Full offline with service worker
   - [x] Client-side history only (recommended for MVP)

4. **Sync strategy**: How to handle conflicts?
   - [ ] Server wins
   - [ ] Client wins
   - [x] Last-write-wins with timestamps (recommended)

### Technical Concerns

1. **Large chat histories**: Need pagination strategy for very long chats
2. **Agent card caching**: How often to refresh cached agent cards?
3. **Real-time sync**: Do we need WebSocket for multi-device sync?

---

## Progress Tracking

| Phase | Status | Started | Completed | Notes |
|-------|--------|---------|-----------|-------|
| 1. Routing Foundation | ✅ Complete | 2025-12-23 | 2025-12-23 | Routes, agent store, ID generation, legacy redirect |
| 2. Sidebar Navigation | ✅ Complete | 2025-12-23 | 2025-12-23 | Shadcn sidebar, agent switcher, layout |
| 3. Landing Page | ⏳ Not Started | - | - | - |
| 4. Client History | ⏳ Not Started | - | - | - |
| 5. Authentication | ⏳ Not Started | - | - | - |
| 6. Server History | ⏳ Not Started | - | - | - |
| 7. Polish | ⏳ Not Started | - | - | - |

---

## References

- [shadcn Sidebar Blocks](https://ui.shadcn.com/blocks/sidebar)
- [Better Auth - GitHub Provider](https://www.better-auth.com/docs/authentication/github)
- [Neon Local Development Guide](https://neon.com/guides/local-development-with-neon)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Drizzle ORM](https://orm.drizzle.team/)
- [idb (IndexedDB wrapper)](https://github.com/jakearchibald/idb)

---

## Changelog

### 2025-12-23
- Initial plan created
- Defined target architecture and phases
- Outlined data models and URL structure
- Clarified search scope: agent switcher/grid searchable, chat history is not
- Added AI SDK persistence assessment for both streaming methods
- Defined unified storage format for cross-view compatibility
- Documented server history strategy for logged-in users
- **Clarified**: Agent cards must be stored before routing - added minimal storage to Phase 1
- Added detailed agent storage flow diagram and ID generation strategy
- **Phase 1 Complete**: Routing foundation with agent storage, ID generation, and legacy redirect
- **Phase 2 Complete**: Sidebar navigation with shadcn components
  - Installed shadcn sidebar, sheet, skeleton, avatar components
  - Created `AppSidebar` with agent switcher and chat history sections
  - Created `AgentSwitcher` searchable dropdown using Command + DropdownMenu
  - Created agent layout with sidebar and mobile header
  - Added `use-mobile` hook for responsive detection
  - Fixed TypeScript strict mode compatibility issues in sidebar component

