/**
 * A2A Agent Discovery
 *
 * Helpers for discovering A2A agents via well-known URIs and direct URLs.
 *
 * ## Discovery Strategies
 *
 * The A2A protocol defines three discovery strategies:
 *
 * 1. **Well-Known URI** (implemented here): Agents serve their card at
 *    `/.well-known/agent-card.json` per RFC 8615. This is the default.
 *
 * 2. **Curated Registries**: For enterprise/marketplace scenarios with
 *    capability-based search. Not implemented here.
 *
 * 3. **Direct Configuration**: For tightly-coupled systems where URLs
 *    are known ahead of time. Use `fetchAgentCard()` for this.
 *
 * ## Agent Card Contents
 *
 * An Agent Card contains:
 * - **Identity**: name, description, provider info
 * - **Endpoint**: service URL for A2A communication
 * - **Capabilities**: streaming, pushNotifications, etc.
 * - **Authentication**: supported auth schemes (Bearer, OAuth2, etc.)
 * - **Skills**: AgentSkill objects describing what the agent can do
 *
 * @see https://a2a-protocol.org/latest/topics/agent-discovery/
 * @module
 */

import type { AgentCard } from "@drew-foxall/a2a-js-sdk";

/**
 * Options for agent discovery requests.
 *
 * These options control how discovery requests are made, including
 * authentication headers and timeout handling.
 */
export interface DiscoveryOptions {
  /**
   * Custom fetch implementation.
   *
   * Useful for testing (mock fetch) or custom auth (adding interceptors).
   * Defaults to `globalThis.fetch`.
   */
  fetch?: typeof globalThis.fetch;

  /**
   * Additional headers to include in the discovery request.
   *
   * Use this for authentication when discovering protected agents:
   *
   * ```typescript
   * await discoverAgent('internal.example.com', {
   *   headers: { 'Authorization': 'Bearer token' }
   * });
   * ```
   */
  headers?: Record<string, string>;

  /**
   * Request timeout in milliseconds.
   *
   * Discovery will abort and throw `AgentDiscoveryError` if the request
   * doesn't complete within this time.
   *
   * @default 10000
   */
  timeout?: number;
}

/**
 * Result of successful agent discovery.
 *
 * Contains both the agent's service URL (for making A2A requests) and
 * the full Agent Card (for capability inspection).
 */
export interface DiscoveryResult {
  /**
   * The agent's A2A service endpoint URL.
   *
   * This is the URL to pass to `a2aV3()` for communication:
   *
   * ```typescript
   * const { agentUrl } = await discoverAgent('agent.example.com');
   * const model = a2aV3(agentUrl);
   * ```
   *
   * If the Agent Card includes a `url` field, that value is used.
   * Otherwise, the discovery URL's origin is used.
   */
  agentUrl: string;

  /**
   * The full A2A Agent Card.
   *
   * Contains agent metadata including:
   * - `name`, `description`, `provider`
   * - `capabilities` (streaming, pushNotifications, etc.)
   * - `securitySchemes` (authentication requirements)
   * - `skills` (what the agent can do)
   */
  agentCard: AgentCard;
}

/**
 * Error thrown when agent discovery fails.
 *
 * Captures the URL that failed and the underlying cause for debugging.
 */
export class AgentDiscoveryError extends Error {
  /** The URL that was being fetched when discovery failed */
  public readonly url: string;
  /** The underlying error that caused the failure (if any) */
  public readonly originalCause?: Error;

  constructor(message: string, url: string, cause?: Error) {
    super(message, { cause });
    this.name = "AgentDiscoveryError";
    this.url = url;
    this.originalCause = cause;
  }
}

/**
 * Discover an A2A agent using the well-known URI convention.
 *
 * This implements the A2A protocol's standard discovery mechanism where
 * agent cards are served at `/.well-known/agent-card.json` (RFC 8615).
 *
 * @param domain - The domain or base URL to discover from
 * @param options - Discovery options
 * @returns Discovery result with agent URL and card
 *
 * @example
 * ```typescript
 * // Discover agent from domain
 * const { agentUrl, agentCard } = await discoverAgent('travel-agent.example.com');
 * console.log(`Found agent: ${agentCard.name}`);
 *
 * // Use with a2aV3
 * const result = await generateText({
 *   model: a2aV3(agentUrl),
 *   prompt: 'Plan a trip to Paris',
 * });
 * ```
 *
 * @example
 * ```typescript
 * // With authentication
 * const { agentUrl } = await discoverAgent('internal-agent.corp.example.com', {
 *   headers: {
 *     'Authorization': 'Bearer your-token',
 *   },
 * });
 * ```
 *
 * @see https://a2a-protocol.org/latest/topics/agent-discovery/
 */
export async function discoverAgent(
  domain: string,
  options: DiscoveryOptions = {}
): Promise<DiscoveryResult> {
  const { fetch: customFetch = globalThis.fetch, headers = {}, timeout = 10000 } = options;

  // Normalize domain to URL
  const baseUrl = normalizeToUrl(domain);
  const cardUrl = `${baseUrl}/.well-known/agent-card.json`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await customFetch(cardUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...headers,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new AgentDiscoveryError(
        `Agent card not found at ${cardUrl} (HTTP ${response.status})`,
        cardUrl
      );
    }

    const agentCard = (await response.json()) as AgentCard;

    // Validate required fields
    if (!agentCard.name) {
      throw new AgentDiscoveryError(`Invalid agent card: missing 'name' field`, cardUrl);
    }

    // Use the URL from the agent card if available, otherwise use the base URL
    const agentUrl = agentCard.url ?? baseUrl;

    return { agentUrl, agentCard };
  } catch (error) {
    if (error instanceof AgentDiscoveryError) {
      throw error;
    }

    const message =
      error instanceof Error && error.name === "AbortError"
        ? `Discovery timed out after ${timeout}ms`
        : `Failed to discover agent at ${cardUrl}`;

    throw new AgentDiscoveryError(message, cardUrl, error instanceof Error ? error : undefined);
  }
}

/**
 * Fetch an agent card from a direct URL.
 *
 * Use this when you already know the agent card URL or when the agent
 * doesn't follow the well-known URI convention.
 *
 * @param cardUrl - Direct URL to the agent card JSON
 * @param options - Discovery options
 * @returns Discovery result with agent URL and card
 *
 * @example
 * ```typescript
 * const { agentUrl, agentCard } = await fetchAgentCard(
 *   'https://api.example.com/agents/travel/card.json'
 * );
 * ```
 */
export async function fetchAgentCard(
  cardUrl: string,
  options: DiscoveryOptions = {}
): Promise<DiscoveryResult> {
  const { fetch: customFetch = globalThis.fetch, headers = {}, timeout = 10000 } = options;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await customFetch(cardUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...headers,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new AgentDiscoveryError(
        `Failed to fetch agent card (HTTP ${response.status})`,
        cardUrl
      );
    }

    const agentCard = (await response.json()) as AgentCard;

    if (!agentCard.name) {
      throw new AgentDiscoveryError(`Invalid agent card: missing 'name' field`, cardUrl);
    }

    // Derive agent URL from card or from the card URL's origin
    const agentUrl = agentCard.url ?? new URL(cardUrl).origin;

    return { agentUrl, agentCard };
  } catch (error) {
    if (error instanceof AgentDiscoveryError) {
      throw error;
    }

    throw new AgentDiscoveryError(
      `Failed to fetch agent card from ${cardUrl}`,
      cardUrl,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Check if an agent supports a specific capability.
 *
 * A2A agents advertise their capabilities in the Agent Card. Use this
 * to adapt your integration based on what the agent supports:
 *
 * ## Capabilities
 *
 * | Capability | Description |
 * |------------|-------------|
 * | `streaming` | Agent supports SSE streaming responses |
 * | `pushNotifications` | Agent can send webhook notifications |
 * | `stateTransitionHistory` | Agent tracks task state history |
 *
 * ```typescript
 * const { agentCard, agentUrl } = await discoverAgent('agent.example.com');
 *
 * // Decide streaming vs polling based on capability
 * if (supportsCapability(agentCard, 'streaming')) {
 *   const stream = await streamText({ model: a2aV3(agentUrl), prompt });
 * } else {
 *   const result = await generateText({ model: a2aV3(agentUrl), prompt });
 * }
 * ```
 *
 * @param agentCard - The Agent Card to inspect
 * @param capability - The capability to check
 * @returns True if the agent explicitly supports this capability
 */
export function supportsCapability(
  agentCard: AgentCard,
  capability: "streaming" | "pushNotifications" | "stateTransitionHistory"
): boolean {
  return agentCard.capabilities?.[capability] === true;
}

/**
 * Get the authentication schemes supported by an agent.
 *
 * A2A agents declare their authentication requirements in `securitySchemes`.
 * Common schemes include:
 *
 * | Scheme | Description |
 * |--------|-------------|
 * | `bearer` | Bearer token (API key or JWT) |
 * | `oauth2` | OAuth 2.0 flow |
 * | `apiKey` | API key in header |
 *
 * ```typescript
 * const { agentCard } = await discoverAgent('agent.example.com');
 * const schemes = getAuthSchemes(agentCard);
 *
 * if (schemes.includes('bearer')) {
 *   // Configure bearer token auth for requests
 *   const headers = { 'Authorization': `Bearer ${apiKey}` };
 * }
 *
 * if (schemes.includes('oauth2')) {
 *   // Initiate OAuth flow using agentCard.securitySchemes.oauth2
 *   const oauthConfig = agentCard.securitySchemes?.oauth2;
 * }
 * ```
 *
 * @param agentCard - The Agent Card to inspect
 * @returns Array of scheme identifiers (keys from securitySchemes)
 */
export function getAuthSchemes(agentCard: AgentCard): string[] {
  if (!agentCard.securitySchemes) {
    return [];
  }

  return Object.entries(agentCard.securitySchemes)
    .filter(([_, scheme]) => scheme != null)
    .map(([key]) => key);
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Normalize a domain or URL string to a proper URL
 */
function normalizeToUrl(input: string): string {
  // Already a full URL
  if (input.startsWith("http://") || input.startsWith("https://")) {
    // Remove trailing slash
    return input.replace(/\/$/, "");
  }

  // Treat as domain, default to HTTPS
  return `https://${input}`.replace(/\/$/, "");
}
