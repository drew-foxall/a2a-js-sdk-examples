/**
 * Shared IndexedDB database for the A2A Inspector.
 *
 * This module provides a singleton database instance with all object stores
 * for agents, chats, and messages. All storage modules use this shared DB.
 *
 * @module storage/db
 */

import type { DBSchema, IDBPDatabase } from "idb";
import { openDB } from "idb";

/**
 * Database name for the A2A Inspector.
 */
export const DB_NAME = "a2a-inspector-db";

/**
 * Current database version.
 * Increment this when making schema changes.
 */
export const DB_VERSION = 2;

/**
 * Object store names.
 */
export const STORES = {
  AGENTS: "agents",
  CHATS: "chats",
  MESSAGES: "messages",
} as const;

/**
 * Internal record format for agents stored in IndexedDB.
 * Dates are stored as ISO strings for JSON compatibility.
 */
export interface StoredAgentRecord {
  id: string;
  url: string;
  name: string;
  description: string;
  card: unknown; // AgentCard stored as JSON
  cardFetchedAt: string; // ISO date string
  addedAt: string; // ISO date string
  lastUsedAt: string; // ISO date string
}

/**
 * Internal record format for chats stored in IndexedDB.
 */
export interface StoredChatRecord {
  id: string;
  agentId: string;
  title: string;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

/**
 * Internal record format for messages stored in IndexedDB.
 */
export interface StoredMessageRecord {
  id: string;
  chatId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string; // ISO date string
  metadata?: unknown; // MessageMetadata stored as JSON
}

/**
 * IndexedDB schema definition for type safety with `idb`.
 */
export interface InspectorDBSchema extends DBSchema {
  agents: {
    key: string;
    value: StoredAgentRecord;
    indexes: {
      "by-url": string;
      "by-lastUsedAt": string;
      "by-addedAt": string;
    };
  };
  chats: {
    key: string;
    value: StoredChatRecord;
    indexes: {
      "by-agentId": string;
      "by-updatedAt": string;
      "by-createdAt": string;
    };
  };
  messages: {
    key: string;
    value: StoredMessageRecord;
    indexes: {
      "by-chatId": string;
      "by-timestamp": string;
    };
  };
}

/**
 * Singleton database instance.
 */
let dbInstance: IDBPDatabase<InspectorDBSchema> | null = null;

/**
 * Open or get the database instance.
 * Creates the database and object stores if they don't exist.
 */
export async function getDB(): Promise<IDBPDatabase<InspectorDBSchema>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<InspectorDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, _transaction) {
      // Version 1: Initial schema with agents store
      if (oldVersion < 1) {
        const agentsStore = db.createObjectStore(STORES.AGENTS, {
          keyPath: "id",
        });

        // Index for looking up agents by URL (unique)
        agentsStore.createIndex("by-url", "url", { unique: true });

        // Index for sorting by last used
        agentsStore.createIndex("by-lastUsedAt", "lastUsedAt", { unique: false });

        // Index for sorting by when added
        agentsStore.createIndex("by-addedAt", "addedAt", { unique: false });
      }

      // Version 2: Add chats and messages stores
      if (oldVersion < 2) {
        // Create chats store
        const chatsStore = db.createObjectStore(STORES.CHATS, {
          keyPath: "id",
        });

        // Index for finding chats by agent
        chatsStore.createIndex("by-agentId", "agentId", { unique: false });

        // Index for sorting by last updated
        chatsStore.createIndex("by-updatedAt", "updatedAt", { unique: false });

        // Index for sorting by creation date
        chatsStore.createIndex("by-createdAt", "createdAt", { unique: false });

        // Create messages store
        const messagesStore = db.createObjectStore(STORES.MESSAGES, {
          keyPath: "id",
        });

        // Index for finding messages by chat
        messagesStore.createIndex("by-chatId", "chatId", { unique: false });

        // Index for sorting by timestamp
        messagesStore.createIndex("by-timestamp", "timestamp", { unique: false });
      }

      // Future versions: Add migration logic here
      // if (oldVersion < 3) { ... }
    },
    blocked() {
      console.warn("[InspectorDB] Database upgrade blocked by other tabs");
    },
    blocking() {
      // Close connection so other tabs can upgrade
      dbInstance?.close();
      dbInstance = null;
    },
    terminated() {
      dbInstance = null;
    },
  });

  return dbInstance;
}

/**
 * Close the database connection.
 * Useful for testing or cleanup.
 */
export function closeDB(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
