import type { Message, MessageSendParams } from "@drew-foxall/a2a-js-sdk";
import {
  ClientFactory,
  ClientFactoryOptions,
  DefaultAgentCardResolver,
} from "@drew-foxall/a2a-js-sdk/client";
import { Elysia, sse, t } from "elysia";
import { validateA2AEvent } from "../services/validators";

/**
 * Creates a custom fetch function that includes auth headers.
 * Preserves all static properties from the original fetch to satisfy typeof fetch.
 */
function createAuthFetch(authHeaders: Record<string, string>): typeof fetch {
  const authFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const mergedHeaders = {
      ...authHeaders,
      ...(init?.headers || {}),
    };
    return fetch(input, {
      ...init,
      headers: mergedHeaders,
    });
  };

  // Copy all static properties from the original fetch
  return Object.assign(authFetch, fetch);
}

/**
 * Streaming route for A2A message exchange.
 *
 * Uses Elysia's SSE (Server-Sent Events) pattern with the `sse()` helper.
 * When a value is wrapped in `sse()`, Elysia automatically:
 * - Sets response headers to `text/event-stream`
 * - Formats the data as proper SSE events
 *
 * Eden Treaty interprets SSE responses as AsyncGenerator, allowing
 * clients to use `for await (const chunk of data)` to consume the stream.
 *
 * @see https://elysiajs.com/essential/handler.html#server-sent-events-sse
 */
export const streamRoutes = new Elysia({ prefix: "/stream" }).post(
  "/",
  async function* ({ body }) {
    const { agentUrl, message, contextId, taskId, headers } = body;

    try {
      // Create ClientFactory with custom card resolver if auth headers are provided
      let clientFactory: ClientFactory;

      if (headers && Object.keys(headers).length > 0) {
        // Create a custom card resolver with auth-enabled fetch
        const authFetch = createAuthFetch(headers);
        const customCardResolver = new DefaultAgentCardResolver({ fetchImpl: authFetch });

        // Create factory options with the custom card resolver
        const options = ClientFactoryOptions.createFrom(ClientFactoryOptions.default, {
          cardResolver: customCardResolver,
        });

        clientFactory = new ClientFactory(options);
      } else {
        clientFactory = new ClientFactory();
      }

      const client = await clientFactory.createFromUrl(agentUrl);

      // Build the A2A message
      const a2aMessage: Message = {
        kind: "message",
        role: "user",
        messageId: crypto.randomUUID(),
        parts: [{ kind: "text", text: message }],
      };

      if (contextId) {
        a2aMessage.contextId = contextId;
      }

      if (taskId) {
        a2aMessage.taskId = taskId;
      }

      const sendParams: MessageSendParams = {
        message: a2aMessage,
      };

      // Stream events from the agent
      const stream = client.sendMessageStream(sendParams);

      for await (const event of stream) {
        // Validate each event
        const validationErrors = validateA2AEvent(event);

        // Use Elysia's sse() helper for proper SSE formatting
        // This ensures each event is properly delimited
        yield sse({
          event: "a2a",
          data: {
            event,
            validationErrors,
          },
        });
      }
    } catch (error) {
      // Yield error as a special SSE event
      yield sse({
        event: "error",
        data: {
          error: error instanceof Error ? error.message : "Unknown streaming error",
        },
      });
    }
  },
  {
    body: t.Object({
      agentUrl: t.String({ minLength: 1 }),
      message: t.String({ minLength: 1 }),
      contextId: t.Optional(t.String()),
      taskId: t.Optional(t.String()),
      headers: t.Optional(t.Record(t.String(), t.String())),
    }),
  }
);
