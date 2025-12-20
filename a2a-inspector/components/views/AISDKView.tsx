"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { DefaultChatTransport, isTextUIPart } from "ai";
import { Bot, Loader2, MessageSquare, RotateCcw, Send, User } from "lucide-react";
import type { FormEvent } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { useConnection, useInspector } from "@/context";
import { cn } from "@/lib/utils";

interface AISDKViewProps {
  readonly className?: string;
}

/**
 * AI SDK View component that uses the useChat hook with the A2A provider.
 * This demonstrates the abstracted approach where AI SDK handles
 * the message state and streaming.
 */
export function AISDKView({ className }: AISDKViewProps): React.JSX.Element {
  const { agentUrl, status: connectionStatus } = useConnection();
  const { log } = useInspector();
  const contextIdRef = useRef<string | null>(null);
  const [inputValue, setInputValue] = useState("");

  // Create a transport with the API endpoint and dynamic body
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai-sdk-chat",
        body: () => ({
          agentUrl,
          contextId: contextIdRef.current,
        }),
      }),
    [agentUrl]
  );

  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport,
    onError: (err: Error) => {
      log("error", `AI SDK error: ${err.message}`, err);
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
      // ## Why This Works
      //
      // The A2A provider uses taskId to group related events. When "completed"
      // arrives after streaming, it emits the content with a different stream ID
      // (taskId-completed), creating a new text part. This last part contains
      // the authoritative response.
      //
      // ## Debugging Tips
      //
      // If you see duplicated/concatenated content:
      // 1. Check textPartsCount in the log - should be > 1 for streaming agents
      // 2. Verify the provider is emitting completed content as a new stream
      // 3. Check that lastTextPart contains the expected authoritative content
      //
      // See also: packages/a2a-ai-provider-v3/src/model.ts handleStatusUpdate()
      //
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
      // Single text part = non-streaming agent OR already deduplicated
      // No action needed - content is already correct
    },
  });

  const handleClear = useCallback(() => {
    setMessages([]);
    contextIdRef.current = null;
    setInputValue("");
    log("info", "AI SDK messages cleared, context reset");
  }, [setMessages, log]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!inputValue.trim() || status !== "ready") return;

      const text = inputValue.trim();
      setInputValue("");
      log("info", `Sending message via AI SDK: ${text}`, undefined, "outbound");
      await sendMessage({ text });
    },
    [inputValue, status, sendMessage, log]
  );

  const isConnected = connectionStatus === "connected";
  const isLoading = status === "submitted" || status === "streaming";

  if (!isConnected) {
    return (
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col items-center justify-center p-8 text-center",
          className
        )}
      >
        <MessageSquare className="h-12 w-12 text-zinc-600" />
        <h3 className="mt-4 text-lg font-medium text-zinc-300">Not Connected</h3>
        <p className="mt-2 text-sm text-zinc-500">
          Connect to an A2A agent to start chatting via AI SDK.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}>
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between border-b border-border bg-background px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
            <MessageSquare className="h-4 w-4 text-blue-500" />
          </div>
          <div>
            <h3 className="font-medium text-white">AI SDK View</h3>
            <p className="text-xs text-zinc-500">Using useChat hook</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleClear}
          disabled={messages.length === 0}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
            messages.length > 0
              ? "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              : "cursor-not-allowed text-zinc-600"
          )}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Clear
        </button>
      </div>

      {/* Messages - Scrollable area that fills remaining space */}
      <Conversation className="min-h-0 flex-1">
        {messages.length === 0 ? (
          <ConversationEmptyState
            icon={<MessageSquare className="h-8 w-8" />}
            title="AI SDK Chat"
            description="Send a message to communicate via the AI SDK abstraction layer."
          />
        ) : (
          <ConversationContent>
            {messages.map((message) => (
              <AISDKMessage key={message.id} message={message} />
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Agent is responding...</span>
              </div>
            )}
          </ConversationContent>
        )}
        <ConversationScrollButton />
      </Conversation>

      {/* Error Display */}
      {error && (
        <div className="shrink-0 border-t border-red-900/50 bg-red-900/20 px-4 py-2">
          <p className="text-sm text-red-400">Error: {error.message}</p>
        </div>
      )}

      {/* Input - Fixed at bottom */}
      <div className="shrink-0 border-t border-border bg-background p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type a message..."
            disabled={isLoading}
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              isLoading || !inputValue.trim()
                ? "cursor-not-allowed bg-zinc-700 text-zinc-500"
                : "bg-blue-600 text-white hover:bg-blue-700"
            )}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract text content from a UIMessage.
 */
function getMessageText(message: UIMessage): string {
  if (message.parts) {
    return message.parts
      .filter(isTextUIPart)
      .map((part) => part.text)
      .join("");
  }
  return "";
}

/**
 * Message component for AI SDK messages.
 */
function AISDKMessage({ message }: { readonly message: UIMessage }): React.JSX.Element {
  const isUser = message.role === "user";
  const textContent = getMessageText(message);

  return (
    <Message from={message.role}>
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            isUser ? "bg-zinc-700" : "bg-blue-500/10"
          )}
        >
          {isUser ? (
            <User className="h-4 w-4 text-zinc-300" />
          ) : (
            <Bot className="h-4 w-4 text-blue-500" />
          )}
        </div>
        <MessageContent>
          <MessageResponse>{textContent}</MessageResponse>
        </MessageContent>
      </div>
    </Message>
  );
}
