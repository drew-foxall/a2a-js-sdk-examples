/**
 * Storage module for the A2A Inspector.
 *
 * Provides IndexedDB-based storage for agents, chats, and messages.
 * All storage is client-side for unauthenticated users.
 *
 * @module storage
 */

// Agent store operations
export {
  addAgent,
  agentExistsByUrl,
  clearAllAgents,
  getAgentById,
  getAgentByUrl,
  getAgentCount,
  listAgents,
  removeAgent,
  updateAgentLastUsed,
} from "./agent-store";
// Chat storage events (client-only convenience)
export { CHATS_UPDATED_EVENT, notifyChatsUpdated } from "./chat-events";
// Chat store operations
export {
  chatExists,
  createChat,
  deleteChat,
  deleteChatsForAgent,
  getChatById,
  getChatCountForAgent,
  listChats,
  touchChat,
  updateChatTitle,
} from "./chat-store";
// Database utilities
export { closeDB, getDB } from "./db";

// Message store operations
export {
  addMessage,
  addMessages,
  deleteMessage,
  deleteMessagesForChat,
  getLastMessageForChat,
  getMessageById,
  getMessageCountForChat,
  getMessagesForChat,
  replaceMessagesForChat,
  updateMessageContent,
  updateMessageMetadata,
} from "./message-store";

// Types
export type {
  AgentLookupResult,
  ChatLookupResult,
  CreateAgentInput,
  CreateChatInput,
  CreateMessageInput,
  ListAgentsOptions,
  ListChatsOptions,
  ListMessagesOptions,
  MessageMetadata,
  StoredAgent,
  StoredChat,
  StoredMessage,
} from "./types";
