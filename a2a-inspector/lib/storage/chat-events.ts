/**
 * Lightweight client-side event helpers to notify UI when chat storage changes.
 *
 * We use a window event so components like the sidebar can refresh their list
 * when messages are persisted (without needing server sync yet).
 */

export const CHATS_UPDATED_EVENT = "a2a-inspector:chats-updated";

/**
 * Notify listeners that chat list/message counts may have changed.
 * Safe to call from client components only.
 */
export function notifyChatsUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CHATS_UPDATED_EVENT));
}
