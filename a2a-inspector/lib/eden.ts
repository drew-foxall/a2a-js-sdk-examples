import { treaty } from "@elysiajs/eden";
import type { App } from "@/server";

/**
 * Eden Treaty client for type-safe API calls.
 *
 * The Elysia app has a /api prefix, so routes are accessed like:
 * - client.api.health.get()
 * - client.api["agent-card"].post({ url: "..." })
 *
 * Usage:
 * ```ts
 * const result = await client.api.health.get();
 * const agentCard = await client.api["agent-card"].post({ url: "http://localhost:8787" });
 * ```
 */

// Determine base URL based on environment
const getBaseUrl = () => {
  if (typeof window !== "undefined") {
    // Browser - use current origin
    return window.location.origin;
  }
  // Server-side - use localhost
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";
};

export const client = treaty<App>(getBaseUrl());

// Export the api namespace for convenience
export const api = client.api;

export type { App };
