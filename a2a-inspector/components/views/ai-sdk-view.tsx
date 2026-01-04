"use client";

import { useChat } from "@ai-sdk/react";
import {
  ArrowCounterClockwise,
  ChatCircle,
  ChatText,
  CircleNotch,
  Info,
  List,
  Sparkle,
} from "@phosphor-icons/react";
import type { UIMessage } from "ai";
import { DefaultChatTransport, isTextUIPart } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
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
import { useConnection, useInspector } from "@/context";
import { useChatHistoryEnabled } from "@/hooks/use-chat-history";
import { getStringProp } from "@/lib/a2a-type-guards";
import { formatChatTitle } from "@/lib/chat-title";
import { addMessage, chatExists, createChat, notifyChatsUpdated } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { type A2AEventData, a2aDataPartSchemas, a2aEventDataSchema } from "@/schemas/a2a-events";
import type { MessageDisplayMode, RawA2AEvent, ValidationError } from "@/types";
import type { A2AUIMessage } from "@/types/ui-message";

interface AISDKViewProps {
  readonly className?: string;
  readonly agentId?: string;
  readonly chatId?: string;
  readonly initialMessages?: A2AUIMessage[];
  readonly initialRawEvents?: RawA2AEvent[];
}

/**
 * Convert A2A event data from the stream to RawA2AEvent format.
 * The event field is validated at runtime by the A2A provider before reaching here.
 */
function toRawA2AEvent(data: A2AEventData, index: number): RawA2AEvent {
  const result: RawA2AEvent = {
    id: `a2a-event-${index}-${data.timestamp}`,
    timestamp: new Date(data.timestamp),
    kind: data.kind,
    // The event is already validated by the A2A provider's type system
    // We use a type assertion here because the schema validates the structure
    // but zod's z.unknown() doesn't carry the type information
    event: data.event as RawA2AEvent["event"],
    validationErrors: [], // TODO: Add validation
  };
  if (typeof data.taskId === "string") {
    result.taskId = data.taskId;
  }
  if (typeof data.messageId === "string") {
    result.messageId = data.messageId;
  }
  // Only add textContent if it exists
  if (data.textContent !== undefined) {
    result.textContent = data.textContent;
  }
  return result;
}

/**
 * AI SDK View component that uses the useChat hook with the A2A provider.
 *
 * This demonstrates the abstracted approach where AI SDK handles
 * the message state and streaming, while also exposing raw A2A events
 * for the Raw/Pretty display modes.
 *
 * Uses AI Elements components following the chatbot pattern from:
 * https://sdk.vercel.ai/elements/examples/chatbot
 */
export function AISDKView({
  className,
  agentId,
  chatId,
  initialMessages,
  initialRawEvents,
}: AISDKViewProps): React.JSX.Element {
  const { agentUrl, status: connectionStatus, agentCard } = useConnection();
  const { log } = useInspector();
  const { enabled: historyEnabled, setEnabled: setHistoryEnabled } = useChatHistoryEnabled({
    isLoggedIn: false,
  });
  const contextIdRef = useRef<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [displayMode, setDisplayMode] = useState<MessageDisplayMode>("pretty");
  const [showSessionDetails, setShowSessionDetails] = useState(false);
  const persistedUserIdsRef = useRef<Set<string>>(new Set());
  const persistedAssistantIdsRef = useRef<Set<string>>(new Set());

  // Store raw A2A events received via data parts
  const [rawEvents, setRawEvents] = useState<RawA2AEvent[]>(() => initialRawEvents ?? []);
  const eventCountRef = useRef(0);
  const rawEventsRef = useRef<RawA2AEvent[]>(rawEvents);
  const lastTaskIdRef = useRef<string | null>(null);
  const assistantMessageTaskIdMapRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    rawEventsRef.current = rawEvents;
  }, [rawEvents]);

  // Create a transport with the API endpoint and dynamic body
  // Enable smoothStream for a better streaming UX - this is processed server-side
  // by AI SDK's smoothStream transform which chunks the response into words/lines
  // with a small delay between each chunk for a typing effect.
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai-sdk-chat",
        body: () => ({
          agentUrl,
          contextId: contextIdRef.current,
          includeRawEvents: true,
          smoothStream: {
            enabled: true,
            delayInMs: 10,
            chunking: "word" as const,
          },
        }),
      }),
    [agentUrl]
  );

  const { messages, sendMessage, status, error, setMessages } = useChat<A2AUIMessage>({
    transport,
    // Register the A2A event data part schema
    dataPartSchemas: a2aDataPartSchemas,
    onError: (err: Error) => {
      log("error", `AI SDK error: ${err.message}`, err);
    },
    // Receive raw A2A events via onData callback
    onData: (dataPart) => {
      if (dataPart.type === "data-a2a-event") {
        // Validate/parse for correctness and typing (avoids casts).
        const eventData: A2AEventData = a2aEventDataSchema.parse(dataPart.data);
        const rawEvent = toRawA2AEvent(eventData, eventCountRef.current++);

        log("event", `A2A Event: ${eventData.kind}`, eventData.event, "inbound");

        setRawEvents((prev: RawA2AEvent[]) => [...prev, rawEvent]);

        // Extract context/task IDs from events
        if (eventData.contextId && !contextIdRef.current) {
          contextIdRef.current = eventData.contextId;
        }
        if (typeof eventData.taskId === "string") {
          lastTaskIdRef.current = eventData.taskId;
        }
      }
    },
    onFinish: ({
      message,
      providerOptions,
    }: {
      message: UIMessage;
      providerOptions?: Record<string, unknown>;
    }) => {
      // =========================================================================
      // A2A STREAM COMPLETION - CORRECTION & PERSISTENCE
      // =========================================================================
      //
      // The authoritative final text is in providerMetadata.a2a.finalText.
      // If this differs from accumulated stream text (e.g., agent sent non-cumulative
      // status updates), we REPLACE the message content with the authoritative text.
      //
      // =========================================================================
      const textParts = (message.parts ?? []).filter(isTextUIPart);
      const streamedText = textParts.map((p) => p.text).join("");

      // Extract finalText from provider metadata (authoritative content)
      const a2aMetadata = providerOptions?.a2a as Record<string, unknown> | undefined;
      const finalText =
        typeof a2aMetadata?.finalText === "string" ? a2aMetadata.finalText : streamedText;

      log("info", "AI SDK message completed", {
        role: message.role,
        streamedLength: streamedText.length,
        finalTextLength: finalText.length,
        contentPreview: finalText.substring(0, 100),
      });

      // If finalText differs from streamed text, replace message content with authoritative text
      // This handles agents that send non-cumulative status updates (streaming shows garbage)
      if (finalText && finalText !== streamedText) {
        setMessages((msgs) =>
          msgs.map((m) =>
            m.id === message.id
              ? {
                  ...m,
                  parts: [
                    // Preserve non-text parts
                    ...(m.parts ?? []).filter((p) => !isTextUIPart(p)),
                    // Replace all text parts with authoritative final text
                    { type: "text" as const, text: finalText },
                  ],
                }
              : m
          )
        );
      }

      // Associate this assistant message with the most recent taskId (for correct "kind" labeling)
      if (message.role === "assistant") {
        const fallbackTaskId =
          rawEventsRef.current
            .slice()
            .reverse()
            .find((e) => typeof e.taskId === "string")?.taskId ?? null;
        const taskId = lastTaskIdRef.current ?? fallbackTaskId;
        if (typeof taskId === "string") {
          assistantMessageTaskIdMapRef.current.set(message.id, taskId);
        }
      }

      // Persist the final assistant message when chat context is present.
      // Use finalText (from metadata) as the authoritative content.
      if (
        historyEnabled &&
        agentId &&
        chatId &&
        message.role === "assistant" &&
        !persistedAssistantIdsRef.current.has(message.id)
      ) {
        const agentIdSafe = agentId;
        const chatIdSafe = chatId;
        const contentToSave = finalText.trim();
        if (contentToSave.length > 0) {
          void (async (agentIdSafe: string, chatIdSafe: string) => {
            const exists = await chatExists(chatIdSafe);
            if (!exists) {
              // Usually created when the first user message is persisted.
              // Fallback: create with a generic title if we somehow got here first.
              await createChat({
                id: chatIdSafe,
                agentId: agentIdSafe,
                title: formatChatTitle(new Date()),
              });
            }

            // Best-effort task id extraction from raw events
            const taskEvent = rawEvents.find((e: RawA2AEvent) => e.kind === "task");
            let taskId: string | undefined;
            if (taskEvent) {
              const maybeId = getStringProp(taskEvent.event, "id");
              if (maybeId) taskId = maybeId;
            }

            const metadata = {
              // Store finalText explicitly so rehydration uses authoritative content
              finalText: contentToSave,
              ...(message.parts ? { uiParts: message.parts } : {}),
              ...(rawEvents.length > 0 ? { a2aEvents: rawEvents } : {}),
              ...(typeof contextIdRef.current === "string"
                ? { contextId: contextIdRef.current }
                : {}),
              ...(typeof taskId === "string" ? { taskId } : {}),
            };

            const base = {
              id: message.id,
              chatId: chatIdSafe,
              role: "assistant" as const,
              content: contentToSave,
            };
            await addMessage({ ...base, metadata });

            persistedAssistantIdsRef.current.add(message.id);
            notifyChatsUpdated();
          })(agentIdSafe, chatIdSafe);
        }
      }
    },
  });

  // Initialize message history when navigating to an existing chat.
  useEffect(() => {
    if (!agentId || !chatId) return;
    if (!initialMessages || initialMessages.length === 0) return;
    if (messages.length > 0) return;

    // Seed persisted-id sets so we don't re-store loaded history.
    for (const m of initialMessages) {
      if (m.role === "user") persistedUserIdsRef.current.add(m.id);
      if (m.role === "assistant") persistedAssistantIdsRef.current.add(m.id);
    }

    // Seed event counter so new events won't collide with loaded history ids
    eventCountRef.current = initialRawEvents?.length ?? rawEvents.length;

    setMessages(initialMessages);
  }, [
    agentId,
    chatId,
    initialMessages,
    initialRawEvents,
    messages.length,
    rawEvents.length,
    setMessages,
  ]);

  // Persist user messages when they appear (useChat generates the id internally).
  useEffect(() => {
    const agentIdSafe = agentId;
    const chatIdSafe = chatId;
    if (!agentIdSafe || !chatIdSafe) return;
    if (!historyEnabled) return;
    if (messages.length === 0) return;

    async function persistUsers(agentIdSafe: string, chatIdSafe: string): Promise<void> {
      const existing = await chatExists(chatIdSafe);
      if (!existing) {
        await createChat({
          id: chatIdSafe,
          agentId: agentIdSafe,
          title: formatChatTitle(new Date()),
        });
      }

      for (const m of messages) {
        if (m.role !== "user") continue;
        if (persistedUserIdsRef.current.has(m.id)) continue;

        const text = (m.parts ?? [])
          .filter(isTextUIPart)
          .map((p) => p.text)
          .join("")
          .trim();
        if (!text) continue;

        const base = {
          id: m.id,
          chatId: chatIdSafe,
          role: "user" as const,
          content: text,
        };
        await addMessage(m.parts ? { ...base, metadata: { uiParts: m.parts } } : base);
        persistedUserIdsRef.current.add(m.id);
        notifyChatsUpdated();
      }
    }

    void persistUsers(agentIdSafe, chatIdSafe);
  }, [agentId, chatId, historyEnabled, messages]);

  const handleClear = useCallback(() => {
    setMessages([]);
    setRawEvents([]);
    contextIdRef.current = null;
    eventCountRef.current = 0;
    setInputValue("");
    log("info", "AI SDK messages cleared, context reset");
  }, [setMessages, log]);

  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      const hasText = Boolean(message.text?.trim());

      if (!hasText || status !== "ready") {
        return;
      }

      log("info", `Sending message via AI SDK: ${message.text}`, undefined, "outbound");
      sendMessage({ text: message.text });
      setInputValue("");
    },
    [status, sendMessage, log]
  );

  const isConnected = connectionStatus === "connected";
  const isLoading = status === "submitted" || status === "streaming";

  // Extract examples from agent card for suggestions
  const suggestions = useMemo(() => {
    if (!agentCard) return [];
    return extractExamplesFromCard(agentCard).slice(0, 8);
  }, [agentCard]);

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      if (status !== "ready") return;
      log("info", `Sending suggestion via AI SDK: ${suggestion}`, undefined, "outbound");
      sendMessage({ text: suggestion });
    },
    [status, sendMessage, log]
  );

  // Build session details from raw events
  const session = useMemo(() => {
    // Find the first task event and extract its ID safely
    const taskEvent = rawEvents.find((e: RawA2AEvent) => e.kind === "task");
    let taskId: string | null = null;
    if (taskEvent?.event && typeof taskEvent.event === "object" && "id" in taskEvent.event) {
      const eventId = (taskEvent.event as { id?: unknown }).id;
      taskId = typeof eventId === "string" ? eventId : null;
    }

    return {
      contextId: contextIdRef.current,
      taskId,
      transport: "http" as const,
      capabilities: {
        streaming: agentCard?.capabilities?.streaming ?? false,
        pushNotifications: agentCard?.capabilities?.pushNotifications ?? false,
        stateTransitionHistory: agentCard?.capabilities?.stateTransitionHistory ?? false,
      },
      startedAt: rawEvents.length > 0 ? (rawEvents[0]?.timestamp ?? null) : null,
      messageCount: messages.length,
      eventCount: rawEvents.length,
    };
  }, [rawEvents, messages.length, agentCard]);

  if (!isConnected) {
    return (
      <div className={cn("flex h-full flex-col items-center justify-center p-8", className)}>
        <div className="text-center">
          <ChatCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">No Agent Connected</h3>
          <p className="text-sm text-muted-foreground">
            Connect to an A2A agent to start chatting via AI SDK.
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
            <ChatText className="h-4 w-4 text-primary" weight="fill" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">AI SDK (useChat)</h2>
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
          <Button variant="ghost" size="sm" onClick={handleClear} disabled={isLoading}>
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
            <PrettyMessages
              messages={messages}
              rawEvents={rawEvents}
              agentName={agentCard?.name}
              isLoading={isLoading}
            />
          ) : (
            <RawEventsMessages messages={messages} rawEvents={rawEvents} />
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Error Display */}
      {error && (
        <div className="shrink-0 border-t border-red-900/50 bg-red-900/20 px-4 py-2">
          <p className="text-sm text-red-400">Error: {error.message}</p>
        </div>
      )}

      {/* Suggestions - separate container for proper stacking */}
      {suggestions.length > 0 && (
        <div className="shrink-0 border-t border-border bg-background px-4 pt-3">
          <Suggestions>
            {suggestions.map((suggestion) => (
              <Suggestion
                key={suggestion}
                suggestion={suggestion}
                onClick={handleSuggestionClick}
                disabled={isLoading}
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
          disabled={isLoading}
          value={inputValue}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInputValue(e.target.value)}
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
          <PromptInputSubmit disabled={isLoading} status={status} />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}

// =============================================================================
// Display Mode Toggle
// =============================================================================

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

// =============================================================================
// Pretty Messages Mode
// =============================================================================

function PrettyMessages({
  messages,
  rawEvents,
  agentName,
  isLoading,
}: {
  readonly messages: UIMessage[];
  readonly rawEvents: RawA2AEvent[];
  readonly agentName?: string | undefined;
  readonly isLoading: boolean;
}): React.JSX.Element {
  if (messages.length === 0 && !isLoading) {
    return (
      <ConversationEmptyState
        icon={<ChatCircle className="h-8 w-8" />}
        title="Start a conversation"
        description={`Send a message to ${agentName ?? "the agent"} to begin.`}
      />
    );
  }

  // Get the kind for this message from raw events
  // The FIRST event determines the type (task, message, etc.) - just like A2A protocol
  const getMessageKind = (messageIndex: number) => {
    const agentMessageCount = messages.filter((m: UIMessage) => m.role === "assistant").length;
    if (messageIndex < agentMessageCount && rawEvents.length > 0) {
      const eventsPerMessage = Math.ceil(rawEvents.length / Math.max(agentMessageCount, 1));
      const startIdx = messageIndex * eventsPerMessage;
      const endIdx = Math.min(startIdx + eventsPerMessage, rawEvents.length);
      const relevantEvents = rawEvents.slice(startIdx, endIdx);

      // Use the FIRST event's kind - this tells us what type of response this is
      const firstEvent = relevantEvents[0];
      if (!firstEvent) return undefined;

      // status-update events are part of a task, so display as "task"
      if (firstEvent.kind === "status-update") {
        return "task";
      }

      return firstEvent.kind;
    }
    return undefined;
  };

  // Get validation errors from raw events
  const getValidationErrors = (messageIndex: number): ValidationError[] => {
    const agentMessageCount = messages.filter((m: UIMessage) => m.role === "assistant").length;
    if (messageIndex < agentMessageCount && rawEvents.length > 0) {
      const eventsPerMessage = Math.ceil(rawEvents.length / Math.max(agentMessageCount, 1));
      const startIdx = messageIndex * eventsPerMessage;
      const endIdx = Math.min(startIdx + eventsPerMessage, rawEvents.length);
      const relevantEvents = rawEvents.slice(startIdx, endIdx);
      return relevantEvents.flatMap((e) => e.validationErrors);
    }
    return [];
  };

  // Get the raw events that belong to a specific message
  const getMessageEvents = (messageIndex: number): RawA2AEvent[] => {
    const agentMessageCount = messages.filter((m: UIMessage) => m.role === "assistant").length;
    if (messageIndex < agentMessageCount && rawEvents.length > 0) {
      const eventsPerMessage = Math.ceil(rawEvents.length / Math.max(agentMessageCount, 1));
      const startIdx = messageIndex * eventsPerMessage;
      const endIdx = Math.min(startIdx + eventsPerMessage, rawEvents.length);
      return rawEvents.slice(startIdx, endIdx);
    }
    return [];
  };

  let agentMessageIndex = 0;

  return (
    <>
      {messages.map((message) => {
        const isAssistant = message.role === "assistant";
        const currentAgentIndex = isAssistant ? agentMessageIndex++ : -1;
        const kind = isAssistant ? getMessageKind(currentAgentIndex) : undefined;
        const validationErrors = isAssistant ? getValidationErrors(currentAgentIndex) : [];
        const messageEvents = isAssistant ? getMessageEvents(currentAgentIndex) : [];

        // Combine all text parts into a single string for display
        // This handles edge cases where multiple text parts exist
        const combinedText = message.parts
          .filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map((p) => p.text)
          .join("");

        if (!combinedText) {
          return null; // No text content to display
        }

        return (
          <Message key={message.id} from={message.role}>
            <MessageContent>
              {isAssistant ? (
                <div className="space-y-2">
                  {/* Header with kind chip and validation status */}
                  <div className="flex items-center gap-2">
                    {kind && <KindChip kind={kind} showIcon />}
                    {validationErrors.length > 0 && <ValidationStatus errors={validationErrors} />}
                  </div>

                  {/* Message content - combined text from all parts */}
                  <MessageResponse>{combinedText}</MessageResponse>

                  {/* Events dropdown - shows constituent A2A events */}
                  {messageEvents.length > 0 && <EventsDropdown events={messageEvents} />}
                </div>
              ) : (
                <span>{combinedText}</span>
              )}
            </MessageContent>
          </Message>
        );
      })}
      {/* Loading indicator - only show when waiting for FIRST token (no content yet) */}
      {isLoading && (() => {
        const lastMessage = messages[messages.length - 1];
        const lastMessageHasContent = lastMessage?.role === "assistant" && 
          lastMessage.parts.some((p): p is { type: "text"; text: string } => 
            p.type === "text" && p.text.length > 0
          );
        // Only show spinner if we don't have any content yet
        return !lastMessageHasContent;
      })() && (
        <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
          <CircleNotch className="h-4 w-4 animate-spin" />
          <span>Agent is responding...</span>
        </div>
      )}
    </>
  );
}

// =============================================================================
// Raw Events Mode
// =============================================================================

function RawEventsMessages({
  messages,
  rawEvents,
}: {
  readonly messages: UIMessage[];
  readonly rawEvents: RawA2AEvent[];
}): React.JSX.Element {
  // Combine user messages with raw events for display
  const allItems: Array<
    { type: "user"; message: UIMessage; timestamp: Date } | { type: "event"; event: RawA2AEvent }
  > = [];

  // Add user messages with timestamps
  for (const msg of messages) {
    if (msg.role === "user") {
      // Use current time as fallback since UIMessage doesn't have timestamp
      allItems.push({
        type: "user",
        message: msg,
        timestamp: new Date(),
      });
    }
  }

  // Add raw events
  for (const event of rawEvents) {
    allItems.push({ type: "event", event });
  }

  // Sort by timestamp (events have timestamps, user messages use insertion order)
  // Since user messages don't have reliable timestamps, we keep them in order
  // and interleave events based on their timestamps

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
          const textContent = item.message.parts
            .filter(isTextUIPart)
            .map((p) => p.text)
            .join("");

          return (
            <Message key={`user-${item.message.id}`} from="user">
              <MessageContent>
                <span>{textContent}</span>
              </MessageContent>
            </Message>
          );
        }

        // Raw event - matches DirectA2AView RawEventsMessages layout
        const { event } = item;
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

                {/* Event content */}
                {event.textContent ? (
                  <MessageResponse>{event.textContent}</MessageResponse>
                ) : (
                  <span className="text-xs italic text-muted-foreground">
                    {event.kind === "task" && "Task created"}
                    {event.kind === "status-update" && "Status update (no text)"}
                    {event.kind === "artifact-update" && "Artifact update"}
                    {event.kind === "message" && "Message (no text)"}
                    {event.kind === "error" && "Error event"}
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
