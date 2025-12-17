/**
 * Alice Agent - Number Guessing Game (Grader) - Cloudflare Worker
 *
 * A simple A2A agent that:
 * - Picks a secret number between 1 and 100
 * - Grades guesses as "too low", "too high", or "correct"
 * - Tracks number of attempts
 * - Persists game state via Redis (Upstash)
 *
 * NO LLM REQUIRED - demonstrates A2A with pure logic on Workers.
 *
 * KEY ARCHITECTURE:
 * - Agent logic is imported from the shared `a2a-agents` package (no duplication!)
 * - Worker only handles deployment-specific concerns (env, routing, storage)
 * - Storage is composable via GameStore interface
 */

import type { AgentCard, AgentSkill } from "@drew-foxall/a2a-js-sdk";
import { Redis } from "@upstash/redis/cloudflare";
import {
  createAliceAgent,
  createInMemoryGameStore,
  createRedisGameStore,
  type GameStore,
} from "a2a-agents";
import { Hono } from "hono";
import { cors } from "hono/cors";

// ============================================================================
// Types
// ============================================================================

interface Env {
  // Upstash Redis for game state persistence
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
}

// ============================================================================
// Storage Factory
// ============================================================================

/**
 * Create the appropriate game store based on environment configuration
 */
function createGameStore(env: Env): { store: GameStore; isPersistent: boolean } {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    const redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });

    return {
      store: createRedisGameStore(redis, {
        prefix: "a2a:number-game:",
        ttlSeconds: 3600, // 1 hour
      }),
      isPersistent: true,
    };
}

  // Fall back to in-memory for local development
  return {
    store: createInMemoryGameStore(),
    isPersistent: false,
  };
}

// ============================================================================
// Session ID Extraction
// ============================================================================

/**
 * Extract session ID from request
 *
 * Priority:
 * 1. contextId from A2A params
 * 2. X-Session-ID header
 * 3. Generate new UUID
 */
function getSessionId(body: Record<string, unknown>, headers: Headers): string {
  // Try contextId from A2A params
  const params = body.params as Record<string, unknown> | undefined;
  if (params?.contextId && typeof params.contextId === "string") {
    return params.contextId;
  }

  // Try X-Session-ID header
  const headerSessionId = headers.get("X-Session-ID");
  if (headerSessionId) {
    return headerSessionId;
  }

  // Generate new session ID
  return crypto.randomUUID();
}

// ============================================================================
// Agent Card
// ============================================================================

const graderSkill: AgentSkill = {
  id: "grade_guess",
  name: "Grade Guess",
  description: "Grade a number guess and tell if it's too low, too high, or correct",
  tags: ["game", "number", "guess"],
  examples: ["50", "25", "75"],
};

function createAgentCard(baseUrl: string): AgentCard {
  return {
    name: "Alice (Grader)",
    description:
      "Number guessing game grader - I pick a secret number and grade your guesses. Use contextId or X-Session-ID header to maintain game state.",
    url: baseUrl,
    version: "1.1.0",
    protocolVersion: "0.3.0",
    preferredTransport: "JSONRPC",
    defaultInputModes: ["text"],
    defaultOutputModes: ["text"],
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    skills: [graderSkill],
  };
}

// ============================================================================
// Hono App
// ============================================================================

const app = new Hono<{ Bindings: Env }>();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "X-Session-ID"],
  })
);

// Agent Card endpoint
app.get("/.well-known/agent-card.json", (c) => {
  const url = new URL(c.req.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  return c.json(createAgentCard(baseUrl));
});

// Health check
app.get("/health", (c) => {
  const { isPersistent } = createGameStore(c.env);
  return c.json({
    status: "healthy",
    agent: "Alice (Grader)",
    version: "1.1.0",
    runtime: "Cloudflare Workers",
    persistence: isPersistent ? "redis" : "none (each request gets new game)",
  });
});

// A2A message handler
app.post("/", async (c) => {
  try {
    const body = await c.req.json();

    // Handle JSON-RPC format
    if (body.jsonrpc === "2.0" && body.method === "message/send") {
      const message = body.params?.message;
      const text = message?.parts?.[0]?.text || message?.parts?.[0]?.content || "";

      // Get session and create agent with appropriate store
      const sessionId = getSessionId(body, c.req.raw.headers);
      const { store, isPersistent } = createGameStore(c.env);
      const alice = createAliceAgent({ gameStore: store });

      // Process the message
      const result = await alice.processMessage(sessionId, text);

      // Build response
      let responseText = result.message;
      if (!isPersistent && !result.isCorrect) {
        responseText += "\n\n⚠️ Note: No Redis configured - use contextId to maintain game state.";
      }

      return c.json({
        jsonrpc: "2.0",
        id: body.id,
        result: {
          id: `task-${Date.now()}`,
          contextId: sessionId,
          status: {
            state: "completed",
            message: {
              role: "agent",
              parts: [{ type: "text", text: responseText }],
            },
          },
          artifacts: [
            {
              parts: [
                {
                  type: "data",
                  data: {
                    attempts: result.attempts,
                    isCorrect: result.isCorrect,
                    guesses: result.guesses,
                  },
                },
              ],
            },
          ],
        },
      });
    }

    return c.json({ error: "Invalid request format" }, 400);
  } catch (error) {
    console.error("Error processing request:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

app.notFound((c) => {
  return c.json(
    {
      error: "Not Found",
      message: "Use /.well-known/agent-card.json to discover this agent",
    },
    404
  );
});

// ============================================================================
// Export for Cloudflare Workers
// ============================================================================

export default app;
