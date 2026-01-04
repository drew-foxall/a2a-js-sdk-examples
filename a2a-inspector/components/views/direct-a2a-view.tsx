"use client";

import {
  ArrowCounterClockwise,
  ChatCircle,
  Info,
  Lightning,
  List,
  Sparkle,
} from "@phosphor-icons/react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, SmoothMessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { extractExamplesFromCard } from "@/components/connection";
import { JsonViewerButton } from "@/components/debug/json-viewer-modal";
import { EventsDropdown, KindChip, ValidationStatus } from "@/components/message";
import { SessionDetailsPanel } from "@/components/session";
import { Button } from "@/components/ui/button";
import { useConnection } from "@/context";
import { useChatHistoryEnabled } from "@/hooks/use-chat-history";
import { useDirectA2A } from "@/hooks/use-direct-a2a";
import { formatChatTitle } from "@/lib/chat-title";
import { addMessage, chatExists, createChat, notifyChatsUpdated } from "@/lib/storage";
import { cn } from "@/lib/utils";
import type { ChatMessage, MessageDisplayMode, RawA2AEvent } from "@/types";

/**
 * Props for the DirectA2AView component.
 */
interface DirectA2AViewProps {
  readonly className?: string;
  readonly agentId?: string;
  readonly chatId?: string;
  readonly initialMessages?: ChatMessage[];
  readonly initialRawEvents?: RawA2AEvent[];
}

/**
 * Direct A2A View - Connects directly to an A2A agent and streams messages
 * without using the AI SDK useChat abstraction.
 *
 * Features two display modes:
 * - "Pretty" mode: Aggregates events into logical messages with dropdown for constituent events
 * - "Raw Events" mode: Shows all A2A events as separate messages with kind chips
 */
export function DirectA2AView({
  className,
  agentId,
  chatId,
  initialMessages,
  initialRawEvents,
}: DirectA2AViewProps): React.JSX.Element {
  const { agentUrl, status, agentCard } = useConnection();
  const directOptions = useMemo(() => {
    return {
      ...(initialMessages ? { initialMessages } : {}),
      ...(initialRawEvents ? { initialRawEvents } : {}),
    };
  }, [initialMessages, initialRawEvents]);
  const { messages, rawEvents, isStreaming, sendMessage, clearMessages, session } = useDirectA2A(
    agentUrl || null,
    directOptions
  );
  const { enabled: historyEnabled, setEnabled: setHistoryEnabled } = useChatHistoryEnabled({
    isLoggedIn: false,
  });
  const [displayMode, setDisplayMode] = useState<MessageDisplayMode>("pretty");
  const [showSessionDetails, setShowSessionDetails] = useState(false);
  const persistedIdsRef = useRef<Set<string>>(new Set());

  // Seed persisted ids from loaded history (so we don't re-add on mount)
  useEffect(() => {
    if (!agentId || !chatId) return;
    if (!initialMessages || initialMessages.length === 0) return;
    for (const m of initialMessages) {
      const isUser = m.role === "user" && Boolean(m.content.trim());
      const isAgent = m.role === "agent" && Boolean(m.content.trim());
      if (isUser || isAgent) {
        persistedIdsRef.current.add(m.id);
      }
    }
  }, [agentId, chatId, initialMessages]);

  // Persist messages to IndexedDB (client-side history) when chat context is provided.
  useEffect(() => {
    // Only persist when routed chat context is available.
    const agentIdSafe = agentId;
    const chatIdSafe = chatId;
    if (!agentIdSafe || !chatIdSafe) return;
    if (!historyEnabled) return;
    if (messages.length === 0) return;

    async function persistNewMessages(agentIdSafe: string, chatIdSafe: string): Promise<void> {
      // Ensure the chat exists once we have our first message.
      const chatAlreadyExists = await chatExists(chatIdSafe);
      if (!chatAlreadyExists) {
        await createChat({
          id: chatIdSafe,
          agentId: agentIdSafe,
          title: formatChatTitle(new Date()),
        });
      }

      for (const msg of messages) {
        if (persistedIdsRef.current.has(msg.id)) continue;

        if (msg.role === "user") {
          const metadata = {
            ...(typeof session.contextId === "string" ? { contextId: session.contextId } : {}),
            ...(typeof session.taskId === "string" ? { taskId: session.taskId } : {}),
          };

          const base = {
            id: msg.id,
            chatId: chatIdSafe,
            role: "user" as const,
            content: msg.content,
          };
          await addMessage(Object.keys(metadata).length > 0 ? { ...base, metadata } : base);
          persistedIdsRef.current.add(msg.id);
          notifyChatsUpdated();
          continue;
        }

        if (msg.role === "agent") {
          const doneStreaming = msg.isStreaming !== true;
          const hasContent = Boolean(msg.content.trim());
          if (!doneStreaming || !hasContent) {
            continue;
          }

          const metadata = {
            ...(msg.rawEvents && msg.rawEvents.length > 0 ? { a2aEvents: msg.rawEvents } : {}),
            ...(typeof session.contextId === "string" ? { contextId: session.contextId } : {}),
            ...(typeof session.taskId === "string" ? { taskId: session.taskId } : {}),
          };

          const base = {
            id: msg.id,
            chatId: chatIdSafe,
            role: "assistant" as const,
            content: msg.content,
          };
          await addMessage(Object.keys(metadata).length > 0 ? { ...base, metadata } : base);
          persistedIdsRef.current.add(msg.id);
          notifyChatsUpdated();
        }
      }
    }

    void persistNewMessages(agentIdSafe, chatIdSafe);
  }, [agentId, chatId, historyEnabled, messages, session.contextId, session.taskId]);

  // Extract examples from agent card for suggestions
  const suggestions = useMemo(() => {
    if (!agentCard) return [];
    return extractExamplesFromCard(agentCard).slice(0, 8);
  }, [agentCard]);

  const handleSubmit = useCallback(
    async (message: PromptInputMessage) => {
      if (message.text.trim()) {
        await sendMessage(message.text);
      }
    },
    [sendMessage]
  );

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      sendMessage(suggestion);
    },
    [sendMessage]
  );

  const isConnected = status === "connected";

  if (!isConnected) {
    return (
      <div className={cn("flex h-full flex-col items-center justify-center p-8", className)}>
        <div className="text-center">
          <ChatCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">No Agent Connected</h3>
          <p className="text-sm text-muted-foreground">
            Connect to an A2A agent to start chatting directly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex h-full min-h-0 min-w-0 flex-col overflow-hidden", className)}>
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between border-b border-border bg-background px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center bg-primary/10">
            <Lightning className="h-4 w-4 text-primary" weight="fill" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Direct A2A</h2>
            <p className="text-xs text-muted-foreground">{agentCard?.name ?? "Connected Agent"}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Display Mode Toggle */}
          <DisplayModeToggle mode={displayMode} onChange={setDisplayMode} />

          {/* Session Details Toggle */}
          <Button
            variant={showSessionDetails ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setShowSessionDetails(!showSessionDetails)}
          >
            <Info className="h-4 w-4" />
            Session
          </Button>

          {/* Clear Button */}
          <Button variant="ghost" size="sm" onClick={clearMessages} disabled={isStreaming}>
            <ArrowCounterClockwise className="h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>

      {/* Session Details Panel (collapsible) */}
      {showSessionDetails && (
        <div className="shrink-0 border-b border-border px-4 py-3">
          <SessionDetailsPanel session={session} />
        </div>
      )}

      {/* Messages - Scrollable area (AI Elements pattern) */}
      <Conversation className="h-full">
        <ConversationContent>
          {displayMode === "pretty" ? (
            <PrettyMessages messages={messages} agentName={agentCard?.name ?? undefined} />
          ) : (
            <RawEventsMessages rawEvents={rawEvents} messages={messages} />
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Suggestions - separate container for proper stacking */}
      {suggestions.length > 0 && (
        <div className="shrink-0 border-t border-border bg-background px-4 pt-3">
          <Suggestions>
            {suggestions.map((suggestion) => (
              <Suggestion
                key={suggestion}
                suggestion={suggestion}
                onClick={handleSuggestionClick}
                disabled={isStreaming}
              />
            ))}
          </Suggestions>
        </div>
      )}

      {/* Input - Direct sibling to Conversation (AI Elements pattern) */}
      <PromptInput
        onSubmit={handleSubmit}
        className={cn(
          "shrink-0 border-t border-border bg-background p-4",
          suggestions.length > 0 && "border-t-0 pt-3"
        )}
      >
        <PromptInputTextarea
          placeholder={`Message ${agentCard?.name ?? "the agent"}...`}
          disabled={isStreaming}
        />
        <PromptInputFooter>
          <Button
            type="button"
            variant={historyEnabled ? "secondary" : "outline"}
            size="sm"
            className="h-8 px-2 text-xs"
            aria-pressed={historyEnabled}
            onClick={() => setHistoryEnabled(!historyEnabled)}
          >
            History {historyEnabled ? "On" : "Off"}
          </Button>
          <PromptInputTools />
          <PromptInputSubmit
            disabled={isStreaming}
            {...(isStreaming ? { status: "streaming" as const } : {})}
          />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}

/**
 * Display mode toggle button group.
 */
function DisplayModeToggle({
  mode,
  onChange,
}: {
  readonly mode: MessageDisplayMode;
  readonly onChange: (mode: MessageDisplayMode) => void;
}): React.JSX.Element {
  return (
    <div className="flex items-center border border-border bg-muted/50 p-1">
      <button
        type="button"
        onClick={() => onChange("pretty")}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition-colors",
          mode === "pretty"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Sparkle className="h-3.5 w-3.5" />
        Pretty
      </button>
      <button
        type="button"
        onClick={() => onChange("raw")}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition-colors",
          mode === "raw"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <List className="h-3.5 w-3.5" />
        Raw Events
      </button>
    </div>
  );
}

/**
 * Pretty mode - Shows aggregated messages with event dropdown.
 */
function PrettyMessages({
  messages,
  agentName,
}: {
  readonly messages: ChatMessage[];
  readonly agentName?: string | undefined;
}): React.JSX.Element {
  if (messages.length === 0) {
    return (
      <ConversationEmptyState
        title="Start a conversation"
        description={`Send a message to ${agentName ?? "the agent"} to begin.`}
        icon={<ChatCircle className="h-8 w-8" />}
      />
    );
  }

  return (
    <>
      {messages.map((message) => (
        <Message key={message.id} from={message.role === "agent" ? "assistant" : "user"}>
          <MessageContent>
            {message.role === "agent" ? (
              <div className="space-y-2">
                {/* Header with kind chip and validation status */}
                <div className="flex items-center gap-2">
                  {message.kind && <KindChip kind={message.kind} showIcon />}
                  {message.validationErrors && (
                    <ValidationStatus errors={message.validationErrors} />
                  )}
                </div>

                {/* Message content - smooth animation only for completed messages */}
                <SmoothMessageResponse
                  text={message.content || "..."}
                  smooth={{
                    enabled: !message.isStreaming,
                    delayInMs: 15,
                    chunking: "word",
                  }}
                />

                {/* Events dropdown */}
                {message.rawEvents && message.rawEvents.length > 0 && (
                  <EventsDropdown events={message.rawEvents} />
                )}
              </div>
            ) : (
              <span>{message.content}</span>
            )}
          </MessageContent>
        </Message>
      ))}
    </>
  );
}

/**
 * Raw Events mode - Shows all A2A events as separate messages.
 */
function RawEventsMessages({
  rawEvents,
  messages,
}: {
  readonly rawEvents: RawA2AEvent[];
  readonly messages: ChatMessage[];
}): React.JSX.Element {
  // Combine user messages with raw events for display
  // We need to interleave them based on timestamp
  const allItems: Array<
    { type: "user"; message: ChatMessage } | { type: "event"; event: RawA2AEvent }
  > = [];

  // Add user messages
  for (const msg of messages) {
    if (msg.role === "user") {
      allItems.push({ type: "user", message: msg });
    }
  }

  // Add raw events
  for (const event of rawEvents) {
    allItems.push({ type: "event", event });
  }

  // Sort by timestamp
  allItems.sort((a, b) => {
    const timeA = a.type === "user" ? a.message.timestamp : a.event.timestamp;
    const timeB = b.type === "user" ? b.message.timestamp : b.event.timestamp;
    return timeA.getTime() - timeB.getTime();
  });

  if (allItems.length === 0) {
    return (
      <ConversationEmptyState
        title="Start a conversation"
        description="Send a message to see raw A2A events."
        icon={<List className="h-8 w-8" />}
      />
    );
  }

  return (
    <>
      {allItems.map((item) => {
        if (item.type === "user") {
          return (
            <Message key={item.message.id} from="user">
              <MessageContent>
                <span>{item.message.content}</span>
              </MessageContent>
            </Message>
          );
        }

        const event = item.event;
        return (
          <Message key={event.id} from="assistant">
            <MessageContent>
              <div className="space-y-1">
                {/* Header with kind chip, timestamp, JSON button, and validation status */}
                <div className="flex items-center gap-2">
                  <KindChip kind={event.kind} showIcon />
                  <span className="font-mono text-xs text-muted-foreground">
                    {event.timestamp.toLocaleTimeString("en-US", {
                      hour12: false,
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      fractionalSecondDigits: 3,
                    })}
                  </span>
                  <JsonViewerButton
                    data={event.event}
                    title={`${event.kind} Event`}
                    description={`Raw A2A ${event.kind} event data`}
                  />
                  <ValidationStatus errors={event.validationErrors} />
                </div>

                {/* Event content with smooth streaming effect */}
                {event.textContent ? (
                  <SmoothMessageResponse
                    text={event.textContent}
                    smooth={{ enabled: true, delayInMs: 15, chunking: "word" }}
                  />
                ) : (
                  <span className="text-xs italic text-muted-foreground">
                    {event.kind === "task" && "Task created"}
                    {event.kind === "status-update" && "Status update (no text)"}
                    {event.kind === "artifact-update" && "Artifact update"}
                  </span>
                )}
              </div>
            </MessageContent>
          </Message>
        );
      })}
    </>
  );
}
