"use client";

import { ChatCircle, Code } from "@phosphor-icons/react";
import type { UIMessage } from "ai";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { DebugConsole } from "@/components/debug";
import { AISDKView, DirectA2AView } from "@/components/views";
import { useInspector } from "@/context";
import { useChatHistoryEnabled } from "@/hooks/use-chat-history";
import { isValidAgentId } from "@/lib/agent-id";
import { getAgentById, getMessagesForChat, type StoredAgent } from "@/lib/storage";
import {
  extractRawA2AEventsFromMetadata,
  extractUIPartsFromMetadata,
} from "@/lib/storage/rehydrate";
import { cn } from "@/lib/utils";
import type { ChatMessage, RawA2AEvent, ViewMode } from "@/types";
import type { A2AUIMessage } from "@/types/ui-message";

function toDirectHistoryMessage(
  m: Awaited<ReturnType<typeof getMessagesForChat>>[number]
): ChatMessage {
  const a2aEvents = m.metadata ? extractRawA2AEventsFromMetadata(m.metadata) : [];
  const validationErrors = a2aEvents.flatMap((e) => e.validationErrors);
  const kind = a2aEvents.length > 0 ? a2aEvents[a2aEvents.length - 1]?.kind : undefined;

  return {
    id: m.id,
    timestamp: m.timestamp,
    role: m.role === "user" ? "user" : "agent",
    content: m.content,
    ...(a2aEvents.length > 0 ? { rawEvents: a2aEvents } : {}),
    ...(validationErrors.length > 0 ? { validationErrors } : {}),
    ...(kind ? { kind } : {}),
  };
}

function toAIHistoryMessage(m: Awaited<ReturnType<typeof getMessagesForChat>>[number]): UIMessage {
  const parts = extractUIPartsFromMetadata(m.metadata, m.content);
  return {
    id: m.id,
    role: m.role === "user" ? "user" : "assistant",
    parts,
  };
}

/**
 * Chat page component.
 *
 * Loads the agent from IndexedDB, connects to it via context, and renders
 * the chat UI with Direct A2A or AI SDK view modes.
 */
export default function ChatPage(): React.JSX.Element {
  const params = useParams<{ agentId: string; chatId: string }>();
  const router = useRouter();
  const { agentId, chatId } = params;

  const { dispatch } = useInspector();
  const { enabled: historyEnabled, isReady: historyReady } = useChatHistoryEnabled({
    isLoggedIn: false,
  });
  const [agent, setAgent] = useState<StoredAgent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("direct");

  const [initialDirectMessages, setInitialDirectMessages] = useState<ChatMessage[]>([]);
  const [initialAISDKMessages, setInitialAISDKMessages] = useState<A2AUIMessage[]>([]);
  const [initialRawEvents, setInitialRawEvents] = useState<RawA2AEvent[]>([]);

  // Validate params (client-safe; don't call next/navigation notFound() here)
  useEffect(() => {
    if (!agentId || !isValidAgentId(agentId) || !chatId) {
      setError("Invalid route parameters");
      setLoading(false);
      router.replace("/");
    }
  }, [agentId, chatId, router]);

  // Load agent from storage, load stored history, and connect
  useEffect(() => {
    async function loadAndConnect(): Promise<void> {
      if (!agentId || !chatId) return;
      if (!historyReady) return;

      try {
        const agentResult = await getAgentById(agentId);
        const storedMessages = historyEnabled ? await getMessagesForChat(chatId) : [];

        if (!agentResult.found) {
          setError(`Agent not found: ${agentId}`);
          setLoading(false);
          return;
        }

        const loadedAgent = agentResult.agent;
        setAgent(loadedAgent);

        setInitialDirectMessages(storedMessages.map(toDirectHistoryMessage));
        setInitialAISDKMessages(storedMessages.map(toAIHistoryMessage));

        const allRawEvents: RawA2AEvent[] = [];
        if (historyEnabled) {
          for (const msg of storedMessages) {
            if (msg.metadata) {
              allRawEvents.push(...extractRawA2AEventsFromMetadata(msg.metadata));
            }
          }
          allRawEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        }
        setInitialRawEvents(allRawEvents);

        dispatch({
          type: "CONNECT_FROM_STORED",
          payload: {
            url: loadedAgent.url,
            card: loadedAgent.card,
          },
        });

        setLoading(false);
      } catch (err) {
        console.error("Failed to load agent/chat:", err);
        setError("Failed to load chat from storage");
        setLoading(false);
      }
    }

    loadAndConnect();
  }, [agentId, chatId, dispatch, historyEnabled, historyReady]);

  // Loading state
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading chat...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !agent) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-md text-center">
          <h1 className="mb-2 text-2xl font-bold text-destructive">Chat Not Available</h1>
          <p className="mb-4 text-muted-foreground">
            {error || "The chat you're looking for doesn't exist."}
          </p>
          <p className="text-sm text-muted-foreground">
            Agent ID: <code className="rounded bg-muted px-2 py-1">{agentId}</code>
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Chat ID: <code className="rounded bg-muted px-2 py-1">{chatId}</code>
          </p>
          <a
            href="/"
            className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            Go to Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden pb-12">
      {/* View Mode Toggle */}
      <div className="shrink-0 border-b border-border bg-card/30 px-4 py-2">
        <div className="flex gap-2">
          <ViewTab
            active={viewMode === "direct"}
            onClick={() => setViewMode("direct")}
            icon={<Code className="h-4 w-4" />}
            label="Direct A2A"
            description="Raw protocol"
          />
          <ViewTab
            active={viewMode === "ai-sdk"}
            onClick={() => setViewMode("ai-sdk")}
            icon={<ChatCircle className="h-4 w-4" />}
            label="AI SDK"
            description="useChat hook"
          />
        </div>
      </div>

      {/* Chat View */}
      <div className="flex-1 overflow-hidden">
        {viewMode === "direct" ? (
          <DirectA2AView
            className="h-full"
            agentId={agentId}
            chatId={chatId}
            initialMessages={initialDirectMessages}
            initialRawEvents={initialRawEvents}
          />
        ) : (
          <AISDKView
            className="h-full"
            agentId={agentId}
            chatId={chatId}
            initialMessages={initialAISDKMessages}
            initialRawEvents={initialRawEvents}
          />
        )}
      </div>
      <DebugConsole />
    </div>
  );
}

function ViewTab({
  active,
  onClick,
  icon,
  label,
  description,
}: {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly description: string;
}): React.JSX.Element {
  const tabClassName = useMemo(
    () =>
      cn(
        "flex items-center gap-2 border px-3 py-1.5 text-left transition-all text-xs",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card/30 text-muted-foreground hover:border-border hover:bg-card/50"
      ),
    [active]
  );

  return (
    <button type="button" onClick={onClick} className={tabClassName}>
      <div
        className={cn(
          "flex h-6 w-6 items-center justify-center",
          active ? "bg-primary/20" : "bg-muted"
        )}
      >
        {icon}
      </div>
      <div>
        <p className={cn("font-medium", active ? "text-primary" : "text-foreground")}>{label}</p>
        <p className="text-[10px] text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}
