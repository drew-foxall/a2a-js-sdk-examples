import type {
  AgentCard,
  Message,
  Task,
  TaskArtifactUpdateEvent,
  TaskStatusUpdateEvent,
} from "@drew-foxall/a2a-js-sdk";

/**
 * Connection status for the inspector.
 */
export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

/**
 * A2A stream event types that can be received.
 * Union of all A2A protocol event types from @drew-foxall/a2a-js-sdk.
 */
export type A2AStreamEvent = Message | Task | TaskStatusUpdateEvent | TaskArtifactUpdateEvent;

/**
 * Event kind for A2A events - derived from the `kind` discriminator in A2A SDK types.
 *
 * Source of truth: @drew-foxall/a2a-js-sdk
 * - Task.kind = "task"
 * - Message.kind = "message"
 * - TaskStatusUpdateEvent.kind = "status-update"
 * - TaskArtifactUpdateEvent.kind = "artifact-update"
 *
 * Plus "error" for error events (not part of SDK stream events but needed for error handling).
 */
export type A2AEventKind = A2AStreamEvent["kind"] | "error";

/**
 * Validation error structure.
 */
export interface ValidationError {
  field: string;
  message: string;
  severity: "error" | "warning";
}

/**
 * A raw A2A event with metadata for display.
 * Used in "Raw Events" mode and for tracking constituent events in "Pretty" mode.
 */
export interface RawA2AEvent {
  id: string;
  timestamp: Date;
  kind: A2AEventKind;
  /** The original A2A event */
  event: A2AStreamEvent;
  /** Task ID associated with this event (if available) */
  taskId?: string;
  /** Message ID associated with this event (if available) */
  messageId?: string;
  /** Validation errors for this event */
  validationErrors: ValidationError[];
  /** Extracted text content (if any) */
  textContent?: string;
}

/**
 * Debug log entry for the debug console.
 */
export interface DebugLogEntry {
  id: string;
  timestamp: Date;
  type: "info" | "error" | "warning" | "request" | "response" | "event";
  direction?: "inbound" | "outbound";
  message: string;
  data?: unknown;
}

/**
 * Chat message for display in the UI.
 * Wraps A2A Message with additional UI metadata.
 *
 * In "Pretty" mode, a single ChatMessage may be composed of multiple raw events.
 * In "Raw Events" mode, each event is displayed separately.
 */
export interface ChatMessage {
  id: string;
  timestamp: Date;
  role: "user" | "agent";
  /** Text content for display */
  content: string;
  /** Original A2A message if available */
  a2aMessage?: Message;
  /** Whether this message is currently being streamed */
  isStreaming?: boolean;
  /** Associated task ID if part of a task flow */
  taskId?: string;
  /** Validation errors for this message (aggregated from all events) */
  validationErrors?: ValidationError[];
  /**
   * Raw A2A events that compose this message.
   * In "Pretty" mode, this contains all events that were aggregated.
   * Used for the dropdown showing constituent events.
   */
  rawEvents?: RawA2AEvent[];
  /**
   * Event kind - for display in "Raw Events" mode.
   * In "Pretty" mode, this is derived from the primary event type.
   */
  kind?: A2AEventKind;
}

/**
 * Task state for tracking active tasks.
 */
export interface TaskState {
  id: string;
  contextId?: string;
  status: Task["status"];
  artifacts?: Task["artifacts"];
  history?: Message[];
  createdAt?: Date;
  updatedAt?: Date;
  lastUpdate?: Date;
}

/**
 * Inspector connection state.
 */
export interface ConnectionState {
  /** Agent base URL */
  agentUrl: string;
  /** Connection status */
  status: ConnectionStatus;
  /** Connected agent card */
  agentCard: AgentCard | null;
  /** Validation errors from agent card */
  validationErrors: ValidationError[];
  /** Error message if connection failed */
  error: string | null;
}

/**
 * Inspector view mode - Direct A2A vs AI SDK.
 */
export type ViewMode = "direct" | "ai-sdk";

/**
 * Message display mode - Raw events vs Pretty aggregated view.
 */
export type MessageDisplayMode = "raw" | "pretty";

/**
/**
 * Authentication type for agent connections.
 */
export type AuthType = "none" | "bearer" | "api-key" | "basic";

/**
 * Custom HTTP header entry.
 */
export interface CustomHeader {
  id: string;
  name: string;
  value: string;
  enabled: boolean;
}

/**
 * Authentication configuration for agent connections.
 */
export interface AuthConfig {
  /** Type of authentication */
  type: AuthType;
  /** Bearer token (for type: "bearer") */
  bearerToken?: string;
  /** API key header name (for type: "api-key") */
  apiKeyHeader?: string;
  /** API key value (for type: "api-key") */
  apiKeyValue?: string;
  /** Basic auth username (for type: "basic") */
  basicUsername?: string;
  /** Basic auth password (for type: "basic") */
  basicPassword?: string;
  /** Custom HTTP headers */
  customHeaders?: CustomHeader[];
}

/**
 * Session details for the current A2A conversation.
 */
export interface SessionDetails {
  /** Current context ID */
  contextId: string | null;
  /** Current task ID */
  taskId: string | null;
  /** Transport type being used */
  transport: "http" | "sse" | "websocket" | null;
  /** Agent capabilities */
  capabilities: {
    streaming: boolean;
    pushNotifications: boolean;
    stateTransitionHistory: boolean;
  };
  /** Session start time */
  startedAt: Date | null;
  /** Number of messages exchanged */
  messageCount: number;
  /** Number of events received */
  eventCount: number;
}
