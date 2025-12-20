"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { DefaultChatTransport, isTextUIPart } from "ai";
import {
  Info,
  List,
  Loader2,
  MessageCircle,
  MessageSquare,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
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
import { JsonViewerButton } from "@/components/debug/JsonViewerModal";
import { EventsDropdown, KindChip, ValidationStatus } from "@/components/message";
import { SessionDetailsPanel } from "@/components/session";
import { Button } from "@/components/ui/button";
import { useConnection, useInspector } from "@/context";
import { cn } from "@/lib/utils";
import { type A2AEventData, a2aDataPartSchemas } from "@/schemas/a2a-events";
import type { MessageDisplayMode, RawA2AEvent, ValidationError } from "@/types";

interface AISDKViewProps {
  readonly className?: string;
}

/**
 * Convert A2A event data from the stream to RawA2AEvent format.
 */
function toRawA2AEvent(data: A2AEventData, index: number): RawA2AEvent {
  const result: RawA2AEvent = {
    id: `a2a-event-${index}-${data.timestamp}`,
    timestamp: new Date(data.timestamp),
    kind: data.kind,
    event: data.event as RawA2AEvent["event"],
    validationErrors: [], // TODO: Add validation
  };
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
export function AISDKView({ className }: AISDKViewProps): React.JSX.Element {
  const { agentUrl, status: connectionStatus, agentCard } = useConnection();
  const { log } = useInspector();
  const contextIdRef = useRef<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [displayMode, setDisplayMode] = useState<MessageDisplayMode>("pretty");
  const [showSessionDetails, setShowSessionDetails] = useState(false);

  // Store raw A2A events received via data parts
  const [rawEvents, setRawEvents] = useState<RawA2AEvent[]>([]);
  const eventCountRef = useRef(0);

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

  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport,
    // Register the A2A event data part schema
    dataPartSchemas: a2aDataPartSchemas,
    onError: (err: Error) => {
      log("error", `AI SDK error: ${err.message}`, err);
    },
    // Receive raw A2A events via onData callback
    onData: (dataPart) => {
      if (dataPart.type === "data-a2a-event") {
        const eventData = dataPart.data as A2AEventData;
        const rawEvent = toRawA2AEvent(eventData, eventCountRef.current++);

        log("event", `A2A Event: ${eventData.kind}`, eventData.event, "inbound");

        setRawEvents((prev: RawA2AEvent[]) => [...prev, rawEvent]);

        // Extract context/task IDs from events
        if (eventData.contextId && !contextIdRef.current) {
          contextIdRef.current = eventData.contextId;
        }
      }
    },
    onFinish: ({ message }: { message: UIMessage }) => {
      // =========================================================================
      // A2A STREAM DEDUPLICATION - CLIENT SIDE
      // =========================================================================
      //
      // This handler works in conjunction with the A2A provider (model.ts) to
      // ensure the correct final message is displayed after streaming completes.
      //
      // ## Background
      //
      // A2A protocol sends two types of content:
      // 1. "working" state: Streaming deltas (may include status like "Processing...")
      // 2. "completed" state: Full authoritative text that should REPLACE deltas
      //
      // The A2A provider emits these as SEPARATE text streams, creating multiple
      // text parts in the AI SDK message:
      //   - Text Part 1: Accumulated working deltas ("Processing...Hello world")
      //   - Text Part 2: Completed authoritative text ("Hello world")
      //
      // ## Our Strategy
      //
      // When multiple text parts exist, use only the LAST one (the completed
      // content) and discard earlier parts (accumulated working deltas).
      //
      // See also: packages/a2a-ai-provider-v3/src/model.ts handleStatusUpdate()
      // =========================================================================
      const textParts = (message.parts ?? []).filter(isTextUIPart);
      const lastTextPart = textParts[textParts.length - 1];

      log("info", "AI SDK message completed", {
        role: message.role,
        textPartsCount: textParts.length,
        content: lastTextPart?.text.substring(0, 100) ?? "",
      });

      // Multiple text parts = streaming agent that sent working deltas + completed
      // Use only the last text part (authoritative completed content)
      if (textParts.length > 1 && lastTextPart) {
        setMessages((msgs) =>
          msgs.map((m) =>
            m.id === message.id
              ? {
                  ...m,
                  parts: [
                    // Preserve non-text parts (step-start, tool calls, etc.)
                    ...(m.parts ?? []).filter((p) => !isTextUIPart(p)),
                    // Replace all text parts with just the authoritative last one
                    { type: "text" as const, text: lastTextPart.text },
                  ],
                }
              : m
          )
        );
      }
    },
  });

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

  // Build session details from raw events
  const session = useMemo(
    () => ({
      contextId: contextIdRef.current,
      taskId: rawEvents.find((e: RawA2AEvent) => e.kind === "task")?.event
        ? ((rawEvents.find((e: RawA2AEvent) => e.kind === "task")?.event as { id?: string })?.id ??
          null)
        : null,
      transport: "http" as const,
      capabilities: {
        streaming: agentCard?.capabilities?.streaming ?? false,
        pushNotifications: agentCard?.capabilities?.pushNotifications ?? false,
        stateTransitionHistory: agentCard?.capabilities?.stateTransitionHistory ?? false,
      },
      startedAt: rawEvents.length > 0 ? (rawEvents[0]?.timestamp ?? null) : null,
      messageCount: messages.length,
      eventCount: rawEvents.length,
    }),
    [rawEvents, messages.length, agentCard]
  );

  if (!isConnected) {
    return (
      <div className={cn("flex h-full flex-col items-center justify-center p-8", className)}>
        <div className="text-center">
          <MessageCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">No Agent Connected</h3>
          <p className="text-sm text-muted-foreground">
            Connect to an A2A agent to start chatting via AI SDK.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}>
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between border-b border-border bg-background px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <MessageSquare className="h-4 w-4 text-primary" />
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
            <Info className="mr-2 h-4 w-4" />
            Session
          </Button>

          {/* Clear Button */}
          <Button variant="ghost" size="sm" onClick={handleClear} disabled={isLoading}>
            <RotateCcw className="mr-2 h-4 w-4" />
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

      {/* Messages - Using AI Elements Conversation pattern */}
      <Conversation className="min-h-0 flex-1">
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

      {/* Input - Using AI Elements PromptInput pattern */}
      <div className="shrink-0 border-t border-border bg-background p-4">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputTextarea
            placeholder={`Message ${agentCard?.name ?? "the agent"}...`}
            disabled={isLoading}
            value={inputValue}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInputValue(e.target.value)}
          />
          <PromptInputFooter>
            <PromptInputTools />
            <PromptInputSubmit disabled={isLoading} status={status} />
          </PromptInputFooter>
        </PromptInput>
      </div>
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
    <div className="flex items-center rounded-lg border border-border bg-muted/50 p-1">
      <button
        type="button"
        onClick={() => onChange("pretty")}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
          mode === "pretty"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Sparkles className="h-3.5 w-3.5" />
        Pretty
      </button>
      <button
        type="button"
        onClick={() => onChange("raw")}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
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
        icon={<MessageCircle className="h-8 w-8" />}
        title="Start a conversation"
        description={`Send a message to ${agentName ?? "the agent"} to begin.`}
      />
    );
  }

  // Get the most recent kind from raw events for the current message
  const getMessageKind = (messageIndex: number) => {
    // Find events that correspond to this message (rough heuristic)
    const agentMessageCount = messages.filter((m: UIMessage) => m.role === "assistant").length;
    if (messageIndex < agentMessageCount && rawEvents.length > 0) {
      // Get the last event for this message
      const eventsPerMessage = Math.ceil(rawEvents.length / Math.max(agentMessageCount, 1));
      const startIdx = messageIndex * eventsPerMessage;
      const endIdx = Math.min(startIdx + eventsPerMessage, rawEvents.length);
      const relevantEvents = rawEvents.slice(startIdx, endIdx);
      return relevantEvents[relevantEvents.length - 1]?.kind;
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

        return (
          <div key={message.id}>
            {message.parts.map((part, i) => {
              switch (part.type) {
                case "text":
                  return (
                    <Message key={`${message.id}-${i}`} from={message.role}>
                      <MessageContent>
                        {isAssistant ? (
                          <div className="space-y-2">
                            {/* Header with kind chip and validation status */}
                            <div className="flex items-center gap-2">
                              {kind && <KindChip kind={kind} showIcon />}
                              {validationErrors.length > 0 && (
                                <ValidationStatus errors={validationErrors} />
                              )}
                            </div>

                            {/* Message content */}
                            <MessageResponse>{part.text}</MessageResponse>

                            {/* Events dropdown - shows constituent A2A events */}
                            {messageEvents.length > 0 && <EventsDropdown events={messageEvents} />}
                          </div>
                        ) : (
                          <span>{part.text}</span>
                        )}
                      </MessageContent>
                    </Message>
                  );
                default:
                  return null;
              }
            })}
          </div>
        );
      })}
      {/* Loading indicator while streaming */}
      {isLoading && messages.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
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
