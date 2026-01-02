/**
 * Message storage using IndexedDB via the `idb` library.
 *
 * This module provides CRUD operations for storing and retrieving chat messages.
 * Messages are linked to chats and can contain view-specific metadata.
 *
 * @module storage/message-store
 */

import { touchChat } from "./chat-store";
import { getDB, STORES, type StoredMessageRecord } from "./db";
import type {
  CreateMessageInput,
  ListMessagesOptions,
  MessageMetadata,
  StoredMessage,
} from "./types";

/**
 * Convert a stored record to the public StoredMessage type.
 */
function recordToMessage(record: StoredMessageRecord): StoredMessage {
  const base = {
    id: record.id,
    chatId: record.chatId,
    role: record.role,
    content: record.content,
    timestamp: new Date(record.timestamp),
  };

  // Only include metadata if it exists (satisfies exactOptionalPropertyTypes)
  if (record.metadata !== undefined) {
    return { ...base, metadata: record.metadata as MessageMetadata };
  }

  return base;
}

/**
 * Convert a StoredMessage to the internal record format.
 */
function messageToRecord(message: StoredMessage): StoredMessageRecord {
  return {
    id: message.id,
    chatId: message.chatId,
    role: message.role,
    content: message.content,
    timestamp: message.timestamp.toISOString(),
    metadata: message.metadata,
  };
}

/**
 * Add a message to a chat.
 *
 * @param input - The message data to store
 * @returns The stored message
 *
 * @example
 * ```ts
 * const message = await addMessage({
 *   id: generateId(),
 *   chatId: "abc123",
 *   role: "user",
 *   content: "Roll a d20",
 * });
 * ```
 */
export async function addMessage(input: CreateMessageInput): Promise<StoredMessage> {
  const db = await getDB();
  const now = new Date();

  const base = {
    id: input.id,
    chatId: input.chatId,
    role: input.role,
    content: input.content,
    timestamp: now,
  };

  // Only include metadata if provided (satisfies exactOptionalPropertyTypes)
  const message: StoredMessage =
    input.metadata !== undefined ? { ...base, metadata: input.metadata } : base;

  await db.add(STORES.MESSAGES, messageToRecord(message));

  // Update the chat's updatedAt timestamp
  await touchChat(input.chatId);

  return message;
}

/**
 * Add multiple messages to a chat in a single transaction.
 * Useful for saving the complete message history at once.
 *
 * @param messages - Array of messages to store
 * @returns Array of stored messages
 *
 * @example
 * ```ts
 * const messages = await addMessages([
 *   { id: "msg1", chatId: "abc", role: "user", content: "Hello" },
 *   { id: "msg2", chatId: "abc", role: "assistant", content: "Hi!" },
 * ]);
 * ```
 */
export async function addMessages(messages: CreateMessageInput[]): Promise<StoredMessage[]> {
  if (messages.length === 0) {
    return [];
  }

  const db = await getDB();
  const now = new Date();

  const storedMessages: StoredMessage[] = messages.map((input, index) => {
    const base = {
      id: input.id,
      chatId: input.chatId,
      role: input.role,
      content: input.content,
      // Stagger timestamps slightly to preserve order
      timestamp: new Date(now.getTime() + index),
    };

    // Only include metadata if provided (satisfies exactOptionalPropertyTypes)
    return input.metadata !== undefined ? { ...base, metadata: input.metadata } : base;
  });

  // Use a transaction for atomicity
  const tx = db.transaction(STORES.MESSAGES, "readwrite");
  await Promise.all([...storedMessages.map((msg) => tx.store.add(messageToRecord(msg))), tx.done]);

  // Update chat timestamp (use the chatId from the first message)
  const firstMessage = messages[0];
  if (firstMessage) {
    await touchChat(firstMessage.chatId);
  }

  return storedMessages;
}

/**
 * Get a message by its ID.
 *
 * @param id - The message ID to look up
 * @returns The message or null if not found
 */
export async function getMessageById(id: string): Promise<StoredMessage | null> {
  const db = await getDB();
  const record = await db.get(STORES.MESSAGES, id);

  if (!record) {
    return null;
  }

  return recordToMessage(record);
}

/**
 * Get all messages for a chat, ordered by timestamp.
 *
 * @param chatId - The chat ID to get messages for
 * @param options - Pagination options
 * @returns Array of stored messages, oldest first
 *
 * @example
 * ```ts
 * const messages = await getMessagesForChat("abc123");
 * ```
 */
export async function getMessagesForChat(
  chatId: string,
  options: ListMessagesOptions = {}
): Promise<StoredMessage[]> {
  const { limit, offset = 0 } = options;

  const db = await getDB();
  let records = await db.getAllFromIndex(STORES.MESSAGES, "by-chatId", chatId);

  // Sort by timestamp (oldest first)
  records.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // Apply offset
  if (offset > 0) {
    records = records.slice(offset);
  }

  // Apply limit
  if (limit !== undefined && limit > 0) {
    records = records.slice(0, limit);
  }

  return records.map(recordToMessage);
}

/**
 * Update a message's content.
 *
 * @param id - The message ID to update
 * @param content - The new content
 * @returns True if the message was found and updated
 */
export async function updateMessageContent(id: string, content: string): Promise<boolean> {
  const db = await getDB();
  const record = await db.get(STORES.MESSAGES, id);

  if (!record) {
    return false;
  }

  record.content = content;
  await db.put(STORES.MESSAGES, record);

  // Touch the chat
  await touchChat(record.chatId);

  return true;
}

/**
 * Update a message's metadata.
 *
 * @param id - The message ID to update
 * @param metadata - The new metadata (merged with existing)
 * @returns True if the message was found and updated
 */
export async function updateMessageMetadata(
  id: string,
  metadata: Partial<MessageMetadata>
): Promise<boolean> {
  const db = await getDB();
  const record = await db.get(STORES.MESSAGES, id);

  if (!record) {
    return false;
  }

  record.metadata = {
    ...(record.metadata as MessageMetadata | undefined),
    ...metadata,
  };
  await db.put(STORES.MESSAGES, record);

  return true;
}

/**
 * Delete a message.
 *
 * @param id - The message ID to delete
 * @returns True if the message was found and deleted
 */
export async function deleteMessage(id: string): Promise<boolean> {
  const db = await getDB();
  const existing = await db.get(STORES.MESSAGES, id);

  if (!existing) {
    return false;
  }

  await db.delete(STORES.MESSAGES, id);

  // Touch the chat
  await touchChat(existing.chatId);

  return true;
}

/**
 * Delete all messages for a chat.
 *
 * @param chatId - The chat ID whose messages to delete
 * @returns The number of messages deleted
 */
export async function deleteMessagesForChat(chatId: string): Promise<number> {
  const db = await getDB();
  const messages = await db.getAllFromIndex(STORES.MESSAGES, "by-chatId", chatId);

  if (messages.length === 0) {
    return 0;
  }

  const tx = db.transaction(STORES.MESSAGES, "readwrite");
  await Promise.all([...messages.map((msg) => tx.store.delete(msg.id)), tx.done]);

  return messages.length;
}

/**
 * Get the count of messages in a chat.
 *
 * @param chatId - The chat ID to count messages for
 * @returns The number of messages
 */
export async function getMessageCountForChat(chatId: string): Promise<number> {
  const db = await getDB();
  const messages = await db.getAllFromIndex(STORES.MESSAGES, "by-chatId", chatId);
  return messages.length;
}

/**
 * Get the last message in a chat.
 *
 * @param chatId - The chat ID
 * @returns The last message or null if chat is empty
 */
export async function getLastMessageForChat(chatId: string): Promise<StoredMessage | null> {
  const messages = await getMessagesForChat(chatId);

  if (messages.length === 0) {
    return null;
  }

  const lastMessage = messages[messages.length - 1];
  return lastMessage ?? null;
}

/**
 * Replace all messages in a chat.
 * Useful for syncing with AI SDK's message history.
 *
 * @param chatId - The chat ID
 * @param messages - The new messages to store
 * @returns The stored messages
 */
export async function replaceMessagesForChat(
  chatId: string,
  messages: CreateMessageInput[]
): Promise<StoredMessage[]> {
  // Delete existing messages
  await deleteMessagesForChat(chatId);

  // Add new messages
  if (messages.length === 0) {
    return [];
  }

  return addMessages(messages);
}
