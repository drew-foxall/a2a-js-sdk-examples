# A2A Inspector - Comparison Analysis

## Original A2A Inspector - Deep Analysis Notes

### Architecture Overview

**Backend (Python/FastAPI + Socket.IO)**
- Uses Socket.IO for real-time bidirectional communication
- Maintains client state in a global dictionary: `clients: dict[str, tuple[httpx.AsyncClient, Client, AgentCard, str]]`
- Two main communication paths:
  1. HTTP POST `/agent-card` - Fetches and validates agent cards
  2. Socket.IO events for message exchange and streaming

**Frontend (Vanilla TypeScript)**
- Single-page application with DOM manipulation
- Uses `socket.io-client` for real-time communication
- Renders messages using `marked` (Markdown) + `DOMPurify` (sanitization)
- Syntax highlighting via `highlight.js` (CDN)

---

### Message Handling - Original Implementation

#### 1. Message Structure
The original uses `AgentResponseEvent` interface:
```typescript
interface AgentResponseEvent {
  kind: 'task' | 'status-update' | 'artifact-update' | 'message';
  id: string;
  contextId?: string;
  error?: string;
  status?: {
    state: string;
    message?: {parts?: {text?: string}[]};
  };
  artifact?: { parts?: [...] };
  artifacts?: Array<{...}>;
  parts?: {text?: string}[];
  validation_errors: string[];
}
```

#### 2. Message Display Logic
Each event type is handled differently:

- **`task`**: 
  - If has artifacts → extracts and displays all artifact content with `kind-chip-task` badge
  - If no artifacts but has status → shows "Task created with status: {state}"
  - Uses `agent progress` class for status-only messages

- **`status-update`**:
  - Extracts text from `event.status?.message?.parts?.[0]?.text`
  - Displays with `kind-chip-status-update` badge
  - Shows as `agent progress` (italicized, smaller)

- **`artifact-update`**:
  - Iterates through `artifact.parts` and processes each part
  - Displays with `kind-chip-artifact-update` badge
  - Uses `agent` class (normal message styling)

- **`message`**:
  - Extracts text from `event.parts`
  - Displays with `kind-chip-message` badge
  - Uses `agent` class

#### 3. Kind Chips (Visual Event Type Indicators)
Each event type has a colored badge:
- `task` → Light blue
- `status-update` → Light yellow
- `artifact-update` → Light green
- `message` → Light purple
- `error` → Light red

#### 4. Validation Status Indicators
Every agent message shows:
- ✅ (green) - Message is compliant
- ⚠️ (orange) - Has validation errors (tooltip shows errors)

#### 5. Click-to-View Raw JSON
Clicking any message opens a modal with the raw JSON payload, with `"method"` fields highlighted.

---

### Debug Console - Original Implementation

#### Features:
1. **Log Types**:
   - `request` - Outbound API requests (blue border)
   - `response` - Inbound responses (gray border)
   - `error` - Error events (red border)
   - `validation_error` - Validation issues (yellow border)

2. **Log Entry Structure**:
```typescript
interface DebugLog {
  type: 'request' | 'response' | 'error' | 'validation_error';
  data: any;
  id: string;
}
```

3. **Display Format**:
   - Timestamp (localized time string)
   - Type badge (uppercase, bold)
   - Full JSON data (pretty-printed)
   - `"method"` fields highlighted in yellow

4. **Controls**:
   - Resizable panel (drag handle)
   - Clear button
   - Show/Hide toggle
   - Scrolls to bottom automatically

5. **Log Limit**: MAX_LOGS = 500 (older entries removed)

6. **Raw Log Storage**: 
   - `rawLogStore` - Stores request/response pairs by ID
   - `messageJsonStore` - Stores message JSON for click-to-view

---

### Session Management - Original

1. **Context ID Management**:
   - Stored in `contextId` variable
   - Displayed in "Session Details" section
   - Updated from `event.contextId` on each response

2. **New Session**:
   - "New Session" button resets `contextId` to null
   - Clears chat messages
   - Shows "Send a message to start a new session"

3. **Session Details Panel** (collapsible):
   - Transport type (jsonrpc, http_json, grpc)
   - Input Modalities (with icons)
   - Output Modalities (with icons)
   - Context ID (monospace code block)

---

### Multimodal Support - Original

1. **File Attachments**:
   - Attach button triggers file picker
   - Preview chips show thumbnail (for images), name, size
   - Files converted to base64 and sent with message

2. **Supported Input Modes**:
   - Validated against agent's `defaultInputModes`
   - Shows alert if file type not supported

3. **Content Rendering**:
   - Images: `<img>` tag
   - Audio: `<audio>` with controls
   - Video: `<video>` with controls
   - PDF: Link to view
   - Other: Download link

---

## Comparison: Our Implementation vs Original

### ✅ Features We Have

| Feature | Original | Ours | Status |
|---------|----------|------|--------|
| Agent Card Fetching | ✅ | ✅ | Complete |
| Agent Card Validation | ✅ | ✅ | Complete |
| Streaming Messages | ✅ Socket.IO | ✅ SSE/Eden | Complete |
| Debug Console | ✅ | ✅ | Complete |
| Log Filtering | ❌ | ✅ | Better |
| Direction Indicators | ❌ | ✅ | Better |
| URL State Persistence | ❌ | ✅ | Better |
| Dark Mode | ✅ Toggle | ✅ Default | Different |
| Message Rendering | marked+DOMPurify | AI Elements | Different |
| Dual View (Direct/AI SDK) | ❌ | ✅ | Better |

### ❌ Missing Features

| Feature | Original | Ours | Priority |
|---------|----------|------|----------|
| **Kind Chips** | ✅ Visual badges | ❌ Missing | HIGH |
| **Validation Status** | ✅ ✅/⚠️ icons | ❌ Missing | HIGH |
| **Click-to-View JSON** | ✅ Modal | ❌ Missing | MEDIUM |
| **Session Details Panel** | ✅ Collapsible | ❌ Missing | MEDIUM |
| **Transport Badge** | ✅ Shows protocol | ❌ Missing | LOW |
| **File Attachments** | ✅ Full support | ❌ Missing | LOW |
| **Resizable Debug Console** | ✅ Drag handle | ❌ Fixed height | LOW |
| **Message Metadata** | ✅ Custom fields | ❌ Missing | LOW |
| **Auth Configuration** | ✅ Bearer/API Key/Basic | ❌ Missing | MEDIUM |
| **Custom Headers** | ✅ Add/remove | ❌ Missing | LOW |

### ⚠️ Differences in Message Handling

**Original Approach:**
1. Shows ALL events (task, status-update, artifact-update, message) as separate chat bubbles
2. Each bubble has a "kind chip" showing the event type
3. Progress messages styled differently (italicized, smaller)
4. Every message shows validation status

**Our Approach:**
1. Accumulates text from status-update events into a single message
2. Only shows final content, not intermediate events
3. No visual distinction between event types
4. No validation status indicators on messages

### 📊 Debug Console Comparison

**Original:**
- Types: `request`, `response`, `error`, `validation_error`
- Shows full JSON with method highlighting
- Stores raw request/response pairs for click-to-view
- MAX_LOGS = 500

**Ours:**
- Types: `info`, `error`, `warning`, `request`, `response`, `event`
- Has filter buttons for each type
- Shows direction (inbound/outbound)
- Expandable data sections
- No log limit implemented

---

## Implementation Plan

### Phase 1: Message Display Enhancements (HIGH PRIORITY)

#### 1.1 Kind Chips
Add visual badges showing event type for each message:
- `task` → Light blue badge
- `status-update` → Light yellow badge  
- `artifact-update` → Light green badge
- `message` → Light purple badge
- `error` → Light red badge

#### 1.2 Validation Status Indicators
Add ✅/⚠️ indicators on each agent message:
- ✅ (green) - Message is A2A compliant
- ⚠️ (orange) - Has validation errors (with tooltip)

#### 1.3 Dual Event Display Mode
Implement a toggle between two message view modes:

**"Raw Events" Mode:**
- Shows ALL A2A events as separate messages
- Each event displayed with kind chip
- Full transparency into protocol communication

**"Pretty" Mode:**
- Aggregates related events into logical messages
- Shows accumulated content as a single message
- Dropdown/accordion attached to each message showing:
  - All constituent events that make up the message
  - Event timestamps
  - Event types with kind chips
  - Individual validation status

### Phase 2: Interactivity (MEDIUM PRIORITY)

#### 2.1 Click-to-View JSON Modal
- Click any message to open modal
- Shows raw JSON with syntax highlighting
- Highlight `"method"` fields in yellow

#### 2.2 Session Details Panel
Collapsible panel showing:
- Transport type (with badge)
- Input/Output Modalities (with icons)
- Context ID (monospace)
- Task ID (if active)

#### 2.3 Auth Configuration
Support for:
- No Auth
- Bearer Token
- API Key (header name + value)
- Basic Auth (username + password)

### Phase 3: Polish (LOW PRIORITY)

#### 3.1 File Attachments
- Attach button with file picker
- Preview chips with thumbnails
- Base64 encoding for transmission

#### 3.2 Resizable Debug Console
- Drag handle for height adjustment
- Persist height preference

#### 3.3 Custom Headers
- Add/remove custom HTTP headers
- Persist across sessions

#### 3.4 Message Metadata
- Custom key-value pairs per message
- Displayed in message details

