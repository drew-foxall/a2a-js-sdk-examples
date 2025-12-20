"use client";

import { Info, List, MessageCircle, RotateCcw, Sparkles, Zap } from "lucide-react";
import type React from "react";
import { useCallback, useState } from "react";
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
import { useConnection } from "@/context";
import { useDirectA2A } from "@/hooks/useDirectA2A";
import { cn } from "@/lib/utils";
import type { ChatMessage, MessageDisplayMode, RawA2AEvent } from "@/types";

/**
 * Props for the DirectA2AView component.
 */
interface DirectA2AViewProps {
  readonly className?: string;
}

/**
 * Direct A2A View - Connects directly to an A2A agent and streams messages
 * without using the AI SDK useChat abstraction.
 *
 * Features two display modes:
 * - "Pretty" mode: Aggregates events into logical messages with dropdown for constituent events
 * - "Raw Events" mode: Shows all A2A events as separate messages with kind chips
 */
export function DirectA2AView({ className }: DirectA2AViewProps): React.JSX.Element {
  const { agentUrl, status, agentCard } = useConnection();
  const { messages, rawEvents, isStreaming, sendMessage, clearMessages, session } = useDirectA2A(
    agentUrl || null
  );
  const [displayMode, setDisplayMode] = useState<MessageDisplayMode>("pretty");
  const [showSessionDetails, setShowSessionDetails] = useState(false);

  const handleSubmit = useCallback(
    async (message: PromptInputMessage) => {
      if (message.text.trim()) {
        await sendMessage(message.text);
      }
    },
    [sendMessage]
  );

  const isConnected = status === "connected";

  if (!isConnected) {
    return (
      <div className={cn("flex h-full flex-col items-center justify-center p-8", className)}>
        <div className="text-center">
          <MessageCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">No Agent Connected</h3>
          <p className="text-sm text-muted-foreground">
            Connect to an A2A agent to start chatting directly.
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
            <Zap className="h-4 w-4 text-primary" />
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
            <Info className="mr-2 h-4 w-4" />
            Session
          </Button>

          {/* Clear Button */}
          <Button variant="ghost" size="sm" onClick={clearMessages} disabled={isStreaming}>
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

      {/* Messages - Scrollable area that fills remaining space */}
      <Conversation className="min-h-0 flex-1">
        <ConversationContent>
          {displayMode === "pretty" ? (
            <PrettyMessages messages={messages} agentName={agentCard?.name ?? undefined} />
          ) : (
            <RawEventsMessages rawEvents={rawEvents} messages={messages} />
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Input - Fixed at bottom */}
      <div className="shrink-0 border-t border-border bg-background p-4">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputTextarea
            placeholder={`Message ${agentCard?.name ?? "the agent"}...`}
            disabled={isStreaming}
          />
          <PromptInputFooter>
            <PromptInputTools />
            <PromptInputSubmit
              disabled={isStreaming}
              {...(isStreaming ? { status: "streaming" as const } : {})}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
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
        icon={<MessageCircle className="h-8 w-8" />}
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

                {/* Message content */}
                <MessageResponse>{message.content || "..."}</MessageResponse>

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

                {/* Event content */}
                {event.textContent ? (
                  <MessageResponse>{event.textContent}</MessageResponse>
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
