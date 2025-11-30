/**
 * Alice Agent - Number Guessing Game (Grader) - Cloudflare Worker
 *
 * A simple A2A agent that:
 * - Picks a secret number between 1 and 100
 * - Grades guesses as "too low", "too high", or "correct"
 * - Tracks number of attempts
 *
 * NO LLM REQUIRED - demonstrates A2A with pure logic on Workers.
 */

import type { AgentCard, AgentSkill } from "@drew-foxall/a2a-js-sdk";
import { Hono } from "hono";
import { cors } from "hono/cors";

// ============================================================================
// Types
// ============================================================================

interface Env {
  // Durable Objects could be used for persistent state across requests
}

// ============================================================================
// Alice Logic (No LLM)
// Note: In Workers, state doesn't persist across requests without Durable Objects
// Each request gets a new random number for simplicity
// ============================================================================

function gradeGuess(guess: number, secret: number): string {
  if (Number.isNaN(guess)) {
    return "Please enter a valid number between 1 and 100";
  }

  if (guess < 1 || guess > 100) {
    return "Please guess a number between 1 and 100";
  }

  if (guess === secret) {
    return `🎉 Correct! The number was ${secret}!`;
  }

  return guess < secret ? "📉 Too low! Try a higher number." : "📈 Too high! Try a lower number.";
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
    description: "Number guessing game grader - I pick a secret number and grade your guesses",
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
    agent: "Alice (Grader)",
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
      const guess = parseInt(text.trim(), 10);

      // Generate a random secret for this request
      // In a real game, you'd use Durable Objects for persistent state
      const secret = Math.floor(Math.random() * 100) + 1;
      const result = gradeGuess(guess, secret);

      return c.json({
        jsonrpc: "2.0",
        id: body.id,
        result: {
          id: `task-${Date.now()}`,
          status: {
            state: "completed",
            message: {
              role: "agent",
              parts: [{ type: "text", text: result }],
            },
          },
          artifacts: [
            {
              parts: [{ type: "text", text: result }],
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

