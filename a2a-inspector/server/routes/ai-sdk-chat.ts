import { a2aV3 } from "@drew-foxall/a2a-ai-provider-v3";
import type { UIMessageStreamWriter } from "ai";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  smoothStream,
  streamText,
} from "ai";
import { Elysia, t } from "elysia";
import type { A2AEventData } from "../../schemas/a2a-events";

/**
 * Extract event metadata from a raw A2A event.
 */
function extractEventMetadata(event: unknown): Partial<A2AEventData> {
  if (!event || typeof event !== "object") return {};

  const e = event as Record<string, unknown>;

  // Extract common fields
  const taskId =
    typeof e.id === "string" ? e.id : typeof e.taskId === "string" ? e.taskId : undefined;
  const contextId = typeof e.contextId === "string" ? e.contextId : undefined;
  const messageId = typeof e.messageId === "string" ? e.messageId : undefined;

  // Extract text content from various event types
  let textContent: string | undefined;

  // For status-update events
  if (e.status && typeof e.status === "object") {
    const status = e.status as Record<string, unknown>;
    if (status.message && typeof status.message === "object") {
      const msg = status.message as Record<string, unknown>;
      if (Array.isArray(msg.parts)) {
        textContent = msg.parts
          .filter(
            (p: unknown) =>
              p && typeof p === "object" && (p as Record<string, unknown>).kind === "text"
          )
          .map((p: unknown) => ((p as Record<string, unknown>).text as string) || "")
          .join("");
      }
    }
  }

  // For message events
  if (Array.isArray(e.parts)) {
    textContent = e.parts
      .filter((p: unknown) => p && typeof p === "object" && (p as Record<string, unknown>).kind === "text")
      .map((p: unknown) => ((p as Record<string, unknown>).text as string) || "")
      .join("");
  }

  return {
    ...(taskId !== undefined && { taskId }),
    ...(contextId !== undefined && { contextId }),
    ...(messageId !== undefined && { messageId }),
    ...(textContent !== undefined && { textContent }),
  };
}

/**
 * Determine the kind of an A2A event.
 *
 * Uses the `kind` discriminator from A2A JS SDK types:
 * - Task.kind = "task"
 * - Message.kind = "message"
 * - TaskStatusUpdateEvent.kind = "status-update"
 * - TaskArtifactUpdateEvent.kind = "artifact-update"
 */
function getEventKind(event: unknown): A2AEventData["kind"] {
  if (!event || typeof event !== "object") return "message";

  const e = event as Record<string, unknown>;
  const kind = e.kind;

  if (kind === "task") return "task";
  if (kind === "message") return "message";
  if (kind === "status-update") return "status-update";
  if (kind === "artifact-update") return "artifact-update";

  if (e.code !== undefined && e.message !== undefined) {
    return "error";
  }

  if (e.status && typeof e.status === "object") {
    return "task";
  }

  return "message";
}

/**
 * Emit a raw A2A event as a data part to the UI message stream.
 */
function emitA2AEvent(writer: UIMessageStreamWriter, rawEvent: unknown): void {
  const kind = getEventKind(rawEvent);
  const metadata = extractEventMetadata(rawEvent);

  writer.write({
    type: "data-a2a-event",
    data: {
      kind,
      timestamp: Date.now(),
      event: rawEvent,
      ...metadata,
    },
  });
}

/**
 * AI SDK chat route that uses the A2A V3 provider.
 *
 * This route uses createUIMessageStream to emit both:
 * 1. Text stream parts from the A2A agent (via streamText)
 * 2. Raw A2A events as data parts (for the Raw/Pretty event view)
 *
 * The client can receive these via:
 * - messages: The accumulated text messages
 * - onData: Callback for raw A2A event data parts
 *
 * ## Data Flow
 *
 * ```
 * A2A Agent → streamText (with onChunk callback)
 *                  │
 *                  ├─── onChunk (raw events) ──→ writer.write(data-a2a-event)
 *                  │
 *                  └─── toUIMessageStream() ──→ writer.merge()
 *                                                    │
 *                                                    ↓
 *                                            createUIMessageStream
 *                                                    │
 *                                                    ↓
 *                                                useChat
 *                                           (messages + onData)
 * ```
 *
 * This is served via the Next.js catch-all route (`app/api/[[...slugs]]/route.ts`)
 * so **all** `/api/*` requests are handled by Elysia.
 */
export const aiSdkChatRoutes = new Elysia({ prefix: "/ai-sdk-chat" }).post(
  "/",
  async ({ body }) => {
    try {
      const { messages, agentUrl, contextId, smoothStream: smoothCfg, includeRawEvents = true } = body;

      if (!agentUrl) {
        return new Response(JSON.stringify({ error: "Agent URL is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (!messages || messages.length === 0) {
        return new Response(JSON.stringify({ error: "Messages are required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Create the A2A model using the provider
      const model = a2aV3(agentUrl);

      // Build provider options only if contextId is provided
      const providerOptions = contextId ? { a2a: { contextId } } : {};

      // Convert UIMessage[] (from useChat) to ModelMessage[] (for streamText)
      const modelMessages = convertToModelMessages(messages);

      // Use createUIMessageStream to have full control over what we emit
      return createUIMessageStreamResponse({
        stream: createUIMessageStream({
          execute: async ({ writer }) => {
            // Build streamText options
            // We conditionally add onChunk only when includeRawEvents is true
            // to satisfy exactOptionalPropertyTypes
            const streamOptions = {
              model,
              messages: modelMessages,
              providerOptions,
              // Enable raw chunks so onChunk receives them
              includeRawChunks: includeRawEvents,
              // Apply smooth streaming transform if enabled
              ...(smoothCfg?.enabled
                ? {
                    experimental_transform: smoothStream({
                      delayInMs: smoothCfg.delayInMs ?? 10,
                      chunking: smoothCfg.chunking ?? "word",
                    }),
                  }
                : {}),
            };

            // Start the streamText call
            // Use onChunk to capture raw A2A events and emit them as data parts
            const result = includeRawEvents
              ? streamText({
                  ...streamOptions,
                  onChunk: ({ chunk }) => {
                    if (chunk.type === "raw") {
                      emitA2AEvent(writer, chunk.rawValue);
                    }
                  },
                })
              : streamText(streamOptions);

            // Merge the UI message stream (text parts, reasoning, sources, etc.)
            const uiStream = result.toUIMessageStream({
              sendReasoning: true,
              sendSources: true,
            });

            writer.merge(uiStream);
          },
          originalMessages: messages,
        }),
      });
    } catch (error) {
      console.error("AI SDK chat error:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
  {
    body: t.Object({
      messages: t.Array(t.Any()),
      agentUrl: t.String({ minLength: 1 }),
      contextId: t.Optional(t.Union([t.String(), t.Null()])),
      smoothStream: t.Optional(
        t.Object({
          enabled: t.Optional(t.Boolean()),
          delayInMs: t.Optional(t.Union([t.Number(), t.Null()])),
          chunking: t.Optional(t.Union([t.Literal("word"), t.Literal("line")])),
        })
      ),
      includeRawEvents: t.Optional(t.Boolean()),
    }),
  }
);


