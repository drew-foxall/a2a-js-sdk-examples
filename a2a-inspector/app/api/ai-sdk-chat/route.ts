import { a2aV3 } from "@drew-foxall/a2a-ai-provider-v3";
import type { UIMessage } from "ai";
import { convertToModelMessages, smoothStream, streamText } from "ai";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * AI SDK chat route that uses the A2A V3 provider.
 * This demonstrates how to use the AI SDK abstraction layer
 * to communicate with A2A agents.
 *
 * The route expects:
 * - messages: UIMessage[] from useChat hook (with parts array format)
 * - agentUrl: The URL of the A2A agent to communicate with
 * - contextId: Optional context ID for conversation continuity
 *
 * Note: useChat sends UIMessage[] format, which must be converted to
 * ModelMessage[] format using convertToModelMessages() before passing
 * to streamText().
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = (await request.json()) as {
      messages: UIMessage[];
      agentUrl: string;
      contextId?: string;
      smoothStream?: {
        enabled?: boolean;
        delayInMs?: number | null;
        chunking?: "word" | "line";
      };
    };

    const { messages, agentUrl, contextId, smoothStream: smoothCfg } = body;

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
    const providerOptions = contextId
      ? {
          a2a: { contextId },
        }
      : {};

    // Convert UIMessage[] (from useChat) to ModelMessage[] (for streamText)
    // This is required because useChat sends messages in UIMessage format
    // with { parts: [...], role, id } structure, but streamText expects
    // ModelMessage format with { content: string | ContentPart[], role }
    const modelMessages = convertToModelMessages(messages);

    // Use streamText to get a streaming response
    const result = streamText({
      model,
      messages: modelMessages,
      providerOptions,
      ...(smoothCfg?.enabled
        ? {
            experimental_transform: smoothStream({
              delayInMs: smoothCfg.delayInMs ?? 10,
              chunking: smoothCfg.chunking ?? "word",
            }),
          }
        : {}),
    });

    // Return the stream as a UI message stream response
    // This format is compatible with useChat hook from @ai-sdk/react
    //
    // Pass originalMessages to enable "persistence mode" - this ensures
    // the response message has a consistent ID, allowing the client to
    // update/replace messages rather than creating duplicates when the
    // final "completed" message arrives with the same content as streamed deltas.
    return result.toUIMessageStreamResponse({
      originalMessages: messages,
    });
  } catch (error) {
    console.error("AI SDK chat error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
