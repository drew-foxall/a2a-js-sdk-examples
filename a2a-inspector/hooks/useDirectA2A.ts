"use client";

import type { Task, TaskArtifactUpdateEvent, TaskStatusUpdateEvent } from "@drew-foxall/a2a-js-sdk";
import { useCallback, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { authConfigToHeaders } from "@/components/connection/AuthConfigPanel";
import { getEventKind } from "@/components/message";
import { useAuthConfig, useInspector } from "@/context";
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
 * Extract text content from an A2A event.
 */
function extractTextFromEvent(event: A2AStreamEvent): string {
  switch (event.kind) {
    case "message": {
      return event.parts
        .filter((part): part is { kind: "text"; text: string } => part.kind === "text")
        .map((part) => part.text)
        .join("");
    }
    case "status-update": {
      const statusEvent = event as TaskStatusUpdateEvent;
      if (statusEvent.status.message && typeof statusEvent.status.message === "object") {
        const msg = statusEvent.status.message as {
          parts?: Array<{ kind: string; text?: string }>;
        };
        if (msg.parts) {
          return msg.parts
            .filter((part): part is { kind: "text"; text: string } => part.kind === "text")
            .map((part) => part.text)
            .join("");
        }
      }
      return "";
    }
    case "task": {
      // Extract from history if available
      const task = event as Task;
      if (task.history) {
        return task.history
          .filter((msg) => msg.role === "agent")
          .flatMap((msg) =>
            msg.parts
              .filter((part): part is { kind: "text"; text: string } => part.kind === "text")
              .map((part) => part.text)
          )
          .join("");
      }
      return "";
    }
    case "artifact-update": {
      const artifactEvent = event as TaskArtifactUpdateEvent;
      if (artifactEvent.artifact?.parts) {
        return artifactEvent.artifact.parts
          .filter((part): part is { kind: "text"; text: string } => part.kind === "text")
          .map((part) => part.text)
          .join("");
      }
      return "";
    }
    default:
      return "";
  }
}

/**
 * Hook for direct A2A communication with streaming support.
 * Uses Eden Treaty to consume Elysia's SSE streaming endpoint.
 *
 * Tracks both aggregated messages (for "Pretty" mode) and raw events (for "Raw Events" mode).
 *
 * @see https://elysiajs.com/eden/treaty/response.html#stream-response
 */
export function useDirectA2A(agentUrl: string | null): {
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [rawEvents, setRawEvents] = useState<RawA2AEvent[]>([]);
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

        // Eden Treaty returns SSE stream as AsyncGenerator
        for await (const chunk of data as AsyncIterable<
          SSEChunk | StreamedA2AEvent | { error: string }
        >) {
          log("event", "Received stream chunk", chunk, "inbound");

          // Handle SSE format (from sse() helper)
          let eventData: StreamedA2AEvent | { error: string };
          if ("event" in chunk && "data" in chunk && typeof chunk.event === "string") {
            eventData = chunk.data as StreamedA2AEvent | { error: string };
          } else {
            eventData = chunk as StreamedA2AEvent | { error: string };
          }

          // Handle error events
          if ("error" in eventData) {
            log("error", `Stream error: ${eventData.error}`);

            const errorEvent: RawA2AEvent = {
              id: uuidv4(),
              timestamp: new Date(),
              kind: "error",
              event: {
                kind: "message",
                role: "agent",
                parts: [{ kind: "text", text: eventData.error }],
              } as A2AStreamEvent,
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

          const { event, validationErrors } = eventData;
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
              primaryKind = "message";
              accumulatedContent += textContent;
              break;
            }

            case "task": {
              primaryKind = "task";
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
              const statusEvent = event as TaskStatusUpdateEvent;
              if (!primaryKind || primaryKind === "message") {
                primaryKind = "status-update";
              }

              dispatch({
                type: "UPDATE_TASK",
                payload: {
                  id: statusEvent.taskId,
                  status: statusEvent.status,
                },
              });

              // For "completed" state, the message contains the full text
              // For "working" state, the message contains delta text
              if (textContent) {
                if (statusEvent.status.state === "completed") {
                  accumulatedContent = textContent;
                } else {
                  accumulatedContent += textContent;
                }
              }
              break;
            }

            case "artifact-update": {
              const artifactEvent = event as TaskArtifactUpdateEvent;
              if (!primaryKind || primaryKind === "message") {
                primaryKind = "artifact-update";
              }

              dispatch({
                type: "UPDATE_TASK",
                payload: {
                  id: artifactEvent.taskId,
                  status: { state: "working" },
                },
              });

              if (textContent) {
                accumulatedContent += textContent;
              }
              break;
            }
          }

          // Update the aggregated message
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === agentMessageId
                ? {
                    ...msg,
                    content: accumulatedContent,
                    kind: primaryKind,
                    rawEvents: [...messageEvents],
                    validationErrors: aggregatedValidationErrors,
                  }
                : msg
            )
          );
        }

        // Mark streaming as complete
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
