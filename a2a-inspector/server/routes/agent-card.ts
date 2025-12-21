import {
  ClientFactory,
  ClientFactoryOptions,
  DefaultAgentCardResolver,
} from "@drew-foxall/a2a-js-sdk/client";
import { Elysia, t } from "elysia";
import { validateAgentCard } from "../services/validators";

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
 * Agent card routes for fetching and validating A2A agent cards.
 */
export const agentCardRoutes = new Elysia({ prefix: "/agent-card" }).post(
  "/",
  async ({ body }) => {
    const { url, headers } = body;

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

      const client = await clientFactory.createFromUrl(url);
      const card = await client.getAgentCard();

      // Validate the agent card
      const validationErrors = validateAgentCard(card);

      return {
        success: true as const,
        card,
        validationErrors,
      };
    } catch (error) {
      console.error("Agent card fetch error:", error);
      const message = error instanceof Error ? error.message : "Failed to fetch agent card";

      return {
        success: false as const,
        error: message,
        card: null,
        validationErrors: [],
      };
    }
  },
  {
    body: t.Object({
      url: t.String({ minLength: 1 }),
      headers: t.Optional(t.Record(t.String(), t.String())),
    }),
    response: t.Union([
      t.Object({
        success: t.Literal(true),
        card: t.Any(),
        validationErrors: t.Array(
          t.Object({
            field: t.String(),
            message: t.String(),
            severity: t.Union([t.Literal("error"), t.Literal("warning")]),
          })
        ),
      }),
      t.Object({
        success: t.Literal(false),
        error: t.String(),
        card: t.Null(),
        validationErrors: t.Array(
          t.Object({
            field: t.String(),
            message: t.String(),
            severity: t.Union([t.Literal("error"), t.Literal("warning")]),
          })
        ),
      }),
    ]),
  }
);
