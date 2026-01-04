"use client";

import type { Message, Task } from "@drew-foxall/a2a-js-sdk";
import { useCallback, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { authConfigToHeaders } from "@/components/connection/auth-config-panel";
import { getEventKind } from "@/components/message";
import { useAuthConfig, useInspector } from "@/context";
import {
  extractTextFromEvent,
  isTaskArtifactUpdateEvent,
  isTaskStatusUpdateEvent,
} from "@/lib/a2a-type-guards";
import { client } from "@/lib/eden";
import type { ValidationError } from "@/server/services/validators";
import type {
  A2AEventKind,
  A2AStreamEvent,
  ChatMessage,
  RawA2AEvent,
  SessionDetails,
} from "@/types";

/**
 * Represents a streamed event from the A2A SSE endpoint.
 */
interface StreamedA2AEvent {
  event: A2AStreamEvent;
  validationErrors: ValidationError[];
}

/**
 * SSE chunk format from Elysia's sse() helper.
 * When using sse({ event, data }), Eden Treaty receives chunks with this shape.
 */
interface SSEChunk {
  event: string;
  data: StreamedA2AEvent | { error: string };
}

/**
 * Type guard to check if a chunk is in SSE format.
 */
function isSSEChunk(chunk: unknown): chunk is SSEChunk {
  return (
    chunk !== null &&
    typeof chunk === "object" &&
    "event" in chunk &&
    typeof chunk.event === "string" &&
    "data" in chunk
  );
}

/**
 * Type guard to check if event data contains an error.
 * Guards against non-object values (e.g., raw SSE strings).
 */
function isErrorEventData(data: unknown): data is { error: string } {
  return data !== null && typeof data === "object" && "error" in data;
}

/**
 * Type guard to check if a value is an AsyncIterable.
 * Eden Treaty returns SSE streams as AsyncIterable at runtime.
 */
function isAsyncIterable<T>(value: unknown): value is AsyncIterable<T> {
  return value !== null && typeof value === "object" && Symbol.asyncIterator in value;
}

/**
 * Hook for direct A2A communication with streaming support.
 * Uses Eden Treaty to consume Elysia's SSE streaming endpoint.
 *
 * Tracks both aggregated messages (for "Pretty" mode) and raw events (for "Raw Events" mode).
 *
 * @see https://elysiajs.com/eden/treaty/response.html#stream-response
 */
export function useDirectA2A(
  agentUrl: string | null,
  options?: {
    readonly initialMessages?: ChatMessage[];
    readonly initialRawEvents?: RawA2AEvent[];
  }
): {
  messages: ChatMessage[];
  rawEvents: RawA2AEvent[];
  isStreaming: boolean;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  currentTask: Task | null;
  session: SessionDetails;
} {
  const { dispatch, log, state } = useInspector();
  const authConfig = useAuthConfig();
  const [messages, setMessages] = useState<ChatMessage[]>(() => options?.initialMessages ?? []);
  const [rawEvents, setRawEvents] = useState<RawA2AEvent[]>(() => options?.initialRawEvents ?? []);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState<Date | null>(null);
  const contextIdRef = useRef<string | null>(null);
  const taskIdRef = useRef<string | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!agentUrl) {
        log("error", "Cannot send message: No agent URL configured");
        return;
      }

      if (isStreaming) {
        log("warning", "Already streaming, please wait for the current response");
        return;
      }

      // Generate a new context ID if we don't have one
      if (!contextIdRef.current) {
        contextIdRef.current = uuidv4();
      }

      // Start session timer on first message
      if (!sessionStartedAt) {
        setSessionStartedAt(new Date());
      }

      const userMessageId = uuidv4();
      const userMessage: ChatMessage = {
        id: userMessageId,
        role: "user",
        content,
        timestamp: new Date(),
      };

      // Add user message to state
      setMessages((prev) => [...prev, userMessage]);
      log("info", `Sending message: ${content}`, { contextId: contextIdRef.current }, "outbound");

      // Create agent message placeholder
      const agentMessageId = uuidv4();
      const agentMessage: ChatMessage = {
        id: agentMessageId,
        role: "agent",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
        rawEvents: [],
        validationErrors: [],
      };
      setMessages((prev) => [...prev, agentMessage]);

      setIsStreaming(true);

      // Track events for this message
      const messageEvents: RawA2AEvent[] = [];
      let accumulatedContent = "";
      let aggregatedValidationErrors: ValidationError[] = [];
      let primaryKind: A2AEventKind = "message";
      // Streaming state based on A2A event type:
      // - Message: single payload, complete on arrival → false
      // - Task/status-update: streaming until state === "completed"
      let messageIsStreaming = true;

      try {
        // Convert auth config to headers
        const authHeaders = authConfigToHeaders(authConfig);
        const hasAuth = Object.keys(authHeaders).length > 0;

        log(
          "request",
          "Starting A2A stream",
          { agentUrl, message: content, authType: authConfig.type, hasAuth },
          "outbound"
        );

        // Use Eden Treaty to call the streaming endpoint
        const response = await client.api.stream.post(
          hasAuth
            ? {
                agentUrl,
                message: content,
                contextId: contextIdRef.current ?? undefined,
                headers: authHeaders,
              }
            : {
                agentUrl,
                message: content,
                contextId: contextIdRef.current ?? undefined,
              }
        );

        if (response.error) {
          throw new Error(
            typeof response.error.value === "string"
              ? response.error.value
              : `HTTP error: ${response.error.status}`
          );
        }

        const { data } = response;

        if (!data) {
          throw new Error("No response data");
        }

        // Eden Treaty returns SSE stream as AsyncIterable at runtime
        if (!isAsyncIterable<SSEChunk | StreamedA2AEvent | { error: string }>(data)) {
          throw new Error("Expected async iterable stream from Eden Treaty");
        }

        for await (const chunk of data) {
          log("event", "Received stream chunk", chunk, "inbound");

          // Handle SSE format (from sse() helper)
          let eventData: unknown;
          if (isSSEChunk(chunk)) {
            eventData = chunk.data;
          } else {
            eventData = chunk;
          }

          // Skip non-object chunks (e.g., raw SSE strings)
          if (eventData === null || typeof eventData !== "object") {
            log("warning", "Skipping non-object chunk", { chunk, type: typeof eventData });
            continue;
          }

          // Handle error events
          if (isErrorEventData(eventData)) {
            log("error", `Stream error: ${eventData.error}`);

            const errorId = uuidv4();

            // Create a proper Message object for the error
            const errorMessage: Message = {
              kind: "message",
              messageId: errorId,
              role: "agent",
              parts: [{ kind: "text", text: eventData.error }],
            };

            const errorEvent: RawA2AEvent = {
              id: uuidv4(),
              timestamp: new Date(),
              kind: "error",
              event: errorMessage,
              validationErrors: [],
              textContent: eventData.error,
            };
            messageEvents.push(errorEvent);
            setRawEvents((prev) => [...prev, errorEvent]);

            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === agentMessageId
                  ? {
                      ...msg,
                      content: `Error: ${eventData.error}`,
                      isStreaming: false,
                      kind: "error",
                      rawEvents: [...messageEvents],
                    }
                  : msg
              )
            );
            continue;
          }

          // Type guard: ensure we have a valid StreamedA2AEvent
          if (!("event" in eventData)) {
            log("warning", "Chunk missing 'event' property", eventData);
            continue;
          }

          const streamedEvent = eventData as StreamedA2AEvent;
          const { event, validationErrors } = streamedEvent;
          const kind = getEventKind(event);
          const textContent = extractTextFromEvent(event);

          log("event", `Received A2A event: ${event.kind}`, event, "inbound");

          // Create raw event record
          const rawEvent: RawA2AEvent = {
            id: uuidv4(),
            timestamp: new Date(),
            kind,
            event,
            validationErrors,
            ...(textContent ? { textContent } : {}),
          };
          messageEvents.push(rawEvent);
          setRawEvents((prev) => [...prev, rawEvent]);

          // Aggregate validation errors
          if (validationErrors.length > 0) {
            aggregatedValidationErrors = [...aggregatedValidationErrors, ...validationErrors];
            log("warning", "Validation issues in event", validationErrors);
          }

          // Process different event types
          switch (event.kind) {
            case "message": {
              // Message is a single complete payload - no streaming
              primaryKind = "message";
              messageIsStreaming = false;
              accumulatedContent += textContent;
              break;
            }

            case "task": {
              // Task streaming depends on status state
              primaryKind = "task";
              messageIsStreaming = event.status.state !== "completed";
              setCurrentTask(event);
              taskIdRef.current = event.id;
              dispatch({
                type: "UPDATE_TASK",
                payload: {
                  id: event.id,
                  status: event.status,
                  artifacts: event.artifacts,
                  lastUpdate: new Date(),
                },
              });

              // Extract content from task history
              if (textContent) {
                accumulatedContent += textContent;
              }
              break;
            }

            case "status-update": {
              if (!isTaskStatusUpdateEvent(event)) break;
              // Status-update streaming depends on status state
              if (!primaryKind || primaryKind === "message") {
                primaryKind = "status-update";
              }
              messageIsStreaming = event.status.state !== "completed";

              dispatch({
                type: "UPDATE_TASK",
                payload: {
                  id: event.taskId,
                  status: event.status,
                },
              });

              // For "completed" state, the message contains the full text
              // For "working" state, the message contains delta text
              if (textContent) {
                if (event.status.state === "completed") {
                  accumulatedContent = textContent;
                } else {
                  accumulatedContent += textContent;
                }
              }
              break;
            }

            case "artifact-update": {
              if (!isTaskArtifactUpdateEvent(event)) break;
              // Artifact updates mean task is still working
              if (!primaryKind || primaryKind === "message") {
                primaryKind = "artifact-update";
              }
              messageIsStreaming = true;

              dispatch({
                type: "UPDATE_TASK",
                payload: {
                  id: event.taskId,
                  status: { state: "working" },
                },
              });

              if (textContent) {
                accumulatedContent += textContent;
              }
              break;
            }
          }

          // Update the aggregated message with streaming state based on event type
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === agentMessageId
                ? {
                    ...msg,
                    content: accumulatedContent,
                    kind: primaryKind,
                    rawEvents: [...messageEvents],
                    validationErrors: aggregatedValidationErrors,
                    isStreaming: messageIsStreaming,
                  }
                : msg
            )
          );
        }

        // Ensure streaming is marked complete when stream ends
        // (handles edge case where stream closes without explicit completion event)
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === agentMessageId
              ? {
                  ...msg,
                  isStreaming: false,
                }
              : msg
          )
        );

        log("info", "Stream completed successfully");
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        log("error", `Stream error: ${errorMessage}`, error);

        // Update the agent message with error
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === agentMessageId
              ? {
                  ...msg,
                  content: `Error: ${errorMessage}`,
                  isStreaming: false,
                  kind: "error",
                  rawEvents: messageEvents,
                }
              : msg
          )
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [agentUrl, isStreaming, dispatch, log, sessionStartedAt, authConfig]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setRawEvents([]);
    setCurrentTask(null);
    contextIdRef.current = null;
    taskIdRef.current = null;
    setSessionStartedAt(null);
    log("info", "Messages cleared, context reset");
  }, [log]);

  // Build session details from current state
  const agentCard = state.connection.agentCard;
  const session: SessionDetails = {
    contextId: contextIdRef.current,
    taskId: taskIdRef.current,
    transport: agentCard?.capabilities?.streaming ? "sse" : "http",
    capabilities: {
      streaming: agentCard?.capabilities?.streaming ?? false,
      pushNotifications: agentCard?.capabilities?.pushNotifications ?? false,
      stateTransitionHistory: agentCard?.capabilities?.stateTransitionHistory ?? false,
    },
    startedAt: sessionStartedAt,
    messageCount: messages.filter((m) => m.role === "user").length,
    eventCount: rawEvents.length,
  };

  return {
    messages,
    rawEvents,
    isStreaming,
    sendMessage,
    clearMessages,
    currentTask,
    session,
  };
}
