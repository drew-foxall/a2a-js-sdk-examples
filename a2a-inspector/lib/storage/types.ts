/**
 * Storage types for the A2A Inspector.
 *
 * These types define the shape of data stored in IndexedDB (client-side)
 * and optionally synced to the server database for logged-in users.
 */

import type { AgentCard } from "@drew-foxall/a2a-js-sdk";

/**
 * A stored agent record.
 * Contains the agent's metadata and cached agent card.
 */
export interface StoredAgent {
  /** Unique agent ID (slug-hash format, e.g., "dice-agent-a3f8b2c1") */
  readonly id: string;

  /** The agent's URL endpoint */
  readonly url: string;

  /** Agent name (copied from agent card for quick access) */
  readonly name: string;

  /** Agent description (copied from agent card for search/display) */
  readonly description: string;

  /** The full cached agent card JSON */
  readonly card: AgentCard;

  /** When the agent card was last fetched from the URL */
  readonly cardFetchedAt: Date;

  /** When the user first added this agent */
  readonly addedAt: Date;

  /** When this agent was last used (for sorting in recent list) */
  readonly lastUsedAt: Date;
}

/**
 * Input for creating a new stored agent.
 * The ID will be generated from the card and URL.
 */
export interface CreateAgentInput {
  /** The agent's URL endpoint */
  readonly url: string;

  /** The fetched agent card */
  readonly card: AgentCard;
}

/**
 * A stored chat session record.
 * Links to an agent and contains metadata about the conversation.
 */
export interface StoredChat {
  /** Unique chat ID (UUID) */
  readonly id: string;

  /** Reference to the agent this chat is with */
  readonly agentId: string;

  /** Chat title (auto-generated from first message or user-set) */
  readonly title: string;

  /** When the chat was created */
  readonly createdAt: Date;

  /** When the chat was last updated (message added) */
  readonly updatedAt: Date;
}

/**
 * A stored message record.
 * Contains the message content and optional view-specific metadata.
 */
export interface StoredMessage {
  /** Unique message ID (UUID) */
  readonly id: string;

  /** Reference to the chat this message belongs to */
  readonly chatId: string;

  /** Message sender role */
  readonly role: "user" | "assistant";

  /** Plain text content of the message */
  readonly content: string;

  /** When the message was created */
  readonly timestamp: Date;

  /**
   * Optional view-specific metadata.
   * Stored as JSON to preserve data from either Direct A2A or AI SDK views.
   */
  readonly metadata?: MessageMetadata;
}

/**
 * View-specific metadata that can be attached to messages.
 * This allows restoring the full fidelity of messages in their original view.
 */
export interface MessageMetadata {
  /** AI SDK UIMessage parts (for AI SDK view) */
  readonly uiParts?: unknown[];

  /** Raw A2A events (for Direct A2A view) */
  readonly a2aEvents?: unknown[];

  /** A2A task ID if this message was part of a task */
  readonly taskId?: string;

  /** A2A context ID for the conversation */
  readonly contextId?: string;
}

/**
 * Result of an agent lookup operation.
 */
export type AgentLookupResult =
  | { readonly found: true; readonly agent: StoredAgent }
  | { readonly found: false; readonly agent: null };

/**
 * Options for listing agents.
 */
export interface ListAgentsOptions {
  /** Sort order for the results */
  readonly sortBy?: "lastUsedAt" | "addedAt" | "name";

  /** Sort direction */
  readonly sortOrder?: "asc" | "desc";

  /** Maximum number of agents to return */
  readonly limit?: number;
}

/**
 * Result of a chat lookup operation.
 */
export type ChatLookupResult =
  | { readonly found: true; readonly chat: StoredChat }
  | { readonly found: false; readonly chat: null };

/**
 * Options for listing chats.
 */
export interface ListChatsOptions {
  /** Filter by agent ID */
  readonly agentId?: string;

  /** Sort order for the results */
  readonly sortBy?: "updatedAt" | "createdAt" | "title";

  /** Sort direction */
  readonly sortOrder?: "asc" | "desc";

  /** Maximum number of chats to return */
  readonly limit?: number;
}

/**
 * Input for creating a new chat.
 */
export interface CreateChatInput {
  /** The chat ID (UUID, typically from AI SDK's generateId) */
  readonly id: string;

  /** Reference to the agent this chat is with */
  readonly agentId: string;

  /** Optional initial title (defaults to "New Chat") */
  readonly title?: string;
}

/**
 * Input for creating a new message.
 */
export interface CreateMessageInput {
  /** The message ID (UUID) */
  readonly id: string;

  /** Reference to the chat this message belongs to */
  readonly chatId: string;

  /** Message sender role */
  readonly role: "user" | "assistant";

  /** Plain text content of the message */
  readonly content: string;

  /** Optional view-specific metadata */
  readonly metadata?: MessageMetadata;
}

/**
 * Options for listing messages.
 */
export interface ListMessagesOptions {
  /** Maximum number of messages to return */
  readonly limit?: number;

  /** Skip this many messages (for pagination) */
  readonly offset?: number;
}
