/**
 * Carol Agent - Number Guessing Game (Visualizer) - Cloudflare Worker
 *
 * A simple A2A agent that:
 * - Visualizes guess history
 * - Provides hints about the range
 * - Can shuffle/analyze guess patterns
 *
 * NO LLM REQUIRED - demonstrates A2A with pure logic on Workers.
 *
 * KEY ARCHITECTURE:
 * - Agent logic is imported from the shared `a2a-agents` package (no duplication!)
 * - Worker only handles deployment-specific concerns (env, routing)
 */

import type { AgentCard, AgentSkill } from "@drew-foxall/a2a-js-sdk";
import { createCarolAgent } from "a2a-agents";
import { Hono } from "hono";
import { cors } from "hono/cors";

// ============================================================================
// Types
// ============================================================================

interface Env {
  // No environment variables needed - Carol is stateless
}

// ============================================================================
// Agent Card
// ============================================================================

const visualizeSkill: AgentSkill = {
  id: "visualize_guesses",
  name: "Visualize Guesses",
  description: "Create a visual representation of guess history",
  tags: ["game", "visualization", "chart"],
  examples: ["visualize 50, 25, 37", "analyze 50, 75, 62", "shuffle 1, 2, 3, 4, 5"],
};

function createAgentCard(baseUrl: string): AgentCard {
  return {
    name: "Carol (Visualizer)",
    description: "Number guessing game visualizer - I create charts and analyze your guesses",
    url: baseUrl,
    version: "1.0.0",
    protocolVersion: "0.3.0",
    preferredTransport: "JSONRPC",
    defaultInputModes: ["text"],
    defaultOutputModes: ["text"],
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    skills: [visualizeSkill],
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
    allowHeaders: ["Content-Type"],
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
  return c.json({
    status: "healthy",
    agent: "Carol (Visualizer)",
    runtime: "Cloudflare Workers",
  });
});

// A2A message handler (no LLM needed)
app.post("/", async (c) => {
  try {
    const body = await c.req.json();

    // Handle JSON-RPC format
    if (body.jsonrpc === "2.0" && body.method === "message/send") {
      const message = body.params?.message;
      const text = message?.parts?.[0]?.text || message?.parts?.[0]?.content || "";

      // Create agent and process message
      const carol = createCarolAgent();
      const result = carol.processMessage(text);

      return c.json({
        jsonrpc: "2.0",
        id: body.id,
        result: {
          id: `task-${Date.now()}`,
          status: {
            state: "completed",
            message: {
              role: "agent",
              parts: [{ type: "text", text: result.text }],
            },
          },
          artifacts: [
            {
              parts: [
                {
                  type: "data",
                  data: {
                    command: result.command,
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
