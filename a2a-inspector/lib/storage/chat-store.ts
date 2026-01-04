/**
 * Chat storage using IndexedDB via the `idb` library.
 *
 * This module provides CRUD operations for storing and retrieving chat sessions.
 * Chats are linked to agents and contain messages.
 *
 * @module storage/chat-store
 */

import { getDB, STORES, type StoredChatRecord } from "./db";
import type { ChatLookupResult, CreateChatInput, ListChatsOptions, StoredChat } from "./types";

/**
 * Convert a stored record to the public StoredChat type.
 */
function recordToChat(record: StoredChatRecord): StoredChat {
  return {
    id: record.id,
    agentId: record.agentId,
    title: record.title,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

/**
 * Convert a StoredChat to the internal record format.
 */
function chatToRecord(chat: StoredChat): StoredChatRecord {
  return {
    id: chat.id,
    agentId: chat.agentId,
    title: chat.title,
    createdAt: chat.createdAt.toISOString(),
    updatedAt: chat.updatedAt.toISOString(),
  };
}

/**
 * Create a new chat.
 *
 * @param input - The chat data to store
 * @returns The stored chat
 *
 * @example
 * ```ts
 * const chat = await createChat({
 *   id: generateId(),
 *   agentId: "dice-agent-a3f8b2c1",
 *   title: "New Chat",
 * });
 * ```
 */
export async function createChat(input: CreateChatInput): Promise<StoredChat> {
  const db = await getDB();
  const now = new Date();

  const chat: StoredChat = {
    id: input.id,
    agentId: input.agentId,
    title: input.title ?? "New Chat",
    createdAt: now,
    updatedAt: now,
  };

  await db.add(STORES.CHATS, chatToRecord(chat));
  return chat;
}

/**
 * Get a chat by its ID.
 *
 * @param id - The chat ID to look up
 * @returns The chat lookup result
 *
 * @example
 * ```ts
 * const result = await getChatById("abc123");
 * if (result.found) {
 *   console.log(result.chat.title);
 * }
 * ```
 */
export async function getChatById(id: string): Promise<ChatLookupResult> {
  const db = await getDB();
  const record = await db.get(STORES.CHATS, id);

  if (!record) {
    return { found: false, chat: null };
  }

  return { found: true, chat: recordToChat(record) };
}

/**
 * List chats, optionally filtered by agent.
 *
 * @param options - Filter and sorting options
 * @returns Array of stored chats
 *
 * @example
 * ```ts
 * // Get 10 most recent chats for an agent
 * const chats = await listChats({
 *   agentId: "dice-agent-a3f8b2c1",
 *   sortBy: "updatedAt",
 *   sortOrder: "desc",
 *   limit: 10,
 * });
 * ```
 */
export async function listChats(options: ListChatsOptions = {}): Promise<StoredChat[]> {
  const { agentId, sortBy = "updatedAt", sortOrder = "desc", limit } = options;

  const db = await getDB();
  let records: StoredChatRecord[];

  if (agentId) {
    // Filter by agent ID using index
    records = await db.getAllFromIndex(STORES.CHATS, "by-agentId", agentId);

    // Sort in memory after filtering
    if (sortBy === "updatedAt") {
      records.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    } else if (sortBy === "createdAt") {
      records.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    } else {
      records.sort((a, b) => a.title.localeCompare(b.title));
    }
  } else {
    // Get all chats with appropriate index
    if (sortBy === "updatedAt") {
      records = await db.getAllFromIndex(STORES.CHATS, "by-updatedAt");
    } else if (sortBy === "createdAt") {
      records = await db.getAllFromIndex(STORES.CHATS, "by-createdAt");
    } else {
      records = await db.getAll(STORES.CHATS);
      records.sort((a, b) => a.title.localeCompare(b.title));
    }
  }

  // Reverse if descending
  if (sortOrder === "desc") {
    records.reverse();
  }

  // Apply limit
  if (limit !== undefined && limit > 0) {
    records = records.slice(0, limit);
  }

  return records.map(recordToChat);
}

/**
 * Update a chat's title.
 *
 * @param id - The chat ID to update
 * @param title - The new title
 * @returns True if the chat was found and updated
 *
 * @example
 * ```ts
 * await updateChatTitle("abc123", "Dice Rolling Session");
 * ```
 */
export async function updateChatTitle(id: string, title: string): Promise<boolean> {
  const db = await getDB();
  const record = await db.get(STORES.CHATS, id);

  if (!record) {
    return false;
  }

  record.title = title;
  record.updatedAt = new Date().toISOString();
  await db.put(STORES.CHATS, record);
  return true;
}

/**
 * Update a chat's updatedAt timestamp.
 * Call this when a new message is added to the chat.
 *
 * @param id - The chat ID to update
 * @returns True if the chat was found and updated
 */
export async function touchChat(id: string): Promise<boolean> {
  const db = await getDB();
  const record = await db.get(STORES.CHATS, id);

  if (!record) {
    return false;
  }

  record.updatedAt = new Date().toISOString();
  await db.put(STORES.CHATS, record);
  return true;
}

/**
 * Delete a chat and all its messages.
 *
 * @param id - The chat ID to delete
 * @returns True if the chat was found and deleted
 *
 * @example
 * ```ts
 * const deleted = await deleteChat("abc123");
 * ```
 */
export async function deleteChat(id: string): Promise<boolean> {
  const db = await getDB();
  const existing = await db.get(STORES.CHATS, id);

  if (!existing) {
    return false;
  }

  // Delete all messages for this chat
  const messages = await db.getAllFromIndex(STORES.MESSAGES, "by-chatId", id);
  const tx = db.transaction([STORES.CHATS, STORES.MESSAGES], "readwrite");

  await Promise.all([
    ...messages.map((msg) => tx.objectStore(STORES.MESSAGES).delete(msg.id)),
    tx.objectStore(STORES.CHATS).delete(id),
    tx.done,
  ]);

  return true;
}

/**
 * Delete all chats for an agent.
 *
 * @param agentId - The agent ID whose chats to delete
 * @returns The number of chats deleted
 */
export async function deleteChatsForAgent(agentId: string): Promise<number> {
  const db = await getDB();
  const chats = await db.getAllFromIndex(STORES.CHATS, "by-agentId", agentId);

  if (chats.length === 0) {
    return 0;
  }

  // Delete all chats and their messages
  for (const chat of chats) {
    await deleteChat(chat.id);
  }

  return chats.length;
}

/**
 * Get the count of chats for an agent.
 *
 * @param agentId - The agent ID to count chats for
 * @returns The number of chats
 */
export async function getChatCountForAgent(agentId: string): Promise<number> {
  const db = await getDB();
  const chats = await db.getAllFromIndex(STORES.CHATS, "by-agentId", agentId);
  return chats.length;
}

/**
 * Check if a chat exists.
 *
 * @param id - The chat ID to check
 * @returns True if the chat exists
 */
export async function chatExists(id: string): Promise<boolean> {
  const result = await getChatById(id);
  return result.found;
}
