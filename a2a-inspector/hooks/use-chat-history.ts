"use client";

import { useEffect, useMemo, useState } from "react";

export const CHAT_HISTORY_SETTING_CHANGED_EVENT = "a2a-inspector:chat-history-setting-changed";
const CHAT_HISTORY_STORAGE_KEY = "a2a-inspector:chat-history-enabled";

function readStoredPreference(): boolean | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(CHAT_HISTORY_STORAGE_KEY);
  if (raw === null) return null;
  return raw === "1" || raw === "true";
}

function defaultPreference(isLoggedIn: boolean): boolean {
  // Requirement:
  // - Local default: no
  // - Logged-in default: yes
  return isLoggedIn;
}

export function setChatHistoryEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, enabled ? "1" : "0");
  window.dispatchEvent(new Event(CHAT_HISTORY_SETTING_CHANGED_EVENT));
}

export function useChatHistoryEnabled(options?: {
  /**
   * Placeholder until Phase 5 (Better Auth).
   * When true, default preference becomes enabled (unless user explicitly disables).
   */
  readonly isLoggedIn?: boolean;
}): {
  enabled: boolean;
  isReady: boolean;
  setEnabled: (enabled: boolean) => void;
} {
  const isLoggedIn = options?.isLoggedIn ?? false;

  // Important: default to false (local default is no) to avoid accidentally persisting
  // a user's first message before we have a chance to read localStorage.
  const [enabled, setEnabledState] = useState<boolean>(defaultPreference(isLoggedIn));
  const [isReady, setIsReady] = useState(false);

  // Initialize from localStorage and listen for changes
  useEffect(() => {
    function sync(): void {
      const stored = readStoredPreference();
      setEnabledState(stored ?? defaultPreference(isLoggedIn));
      setIsReady(true);
    }

    sync();
    window.addEventListener(CHAT_HISTORY_SETTING_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener(CHAT_HISTORY_SETTING_CHANGED_EVENT, sync);
    };
  }, [isLoggedIn]);

  const setEnabled = useMemo(() => {
    return (value: boolean) => {
      setChatHistoryEnabled(value);
      setEnabledState(value);
      setIsReady(true);
    };
  }, []);

  return { enabled, isReady, setEnabled };
}
