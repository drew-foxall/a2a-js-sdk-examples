/**
 * Alice Agent - Number Guessing Game (Grader)
 *
 * A simple A2A agent that:
 * - Picks a secret number between 1 and 100
 * - Grades guesses as "too low", "too high", or "correct"
 * - Tracks number of attempts
 *
 * NO LLM REQUIRED - demonstrates A2A with pure logic.
 *
 * Port: 8000
 */

import type { AgentCard, AgentSkill } from "@drew-foxall/a2a-js-sdk";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

// ============================================================================
// Configuration
// ============================================================================

const PORT = 8000;
const HOST = "0.0.0.0";
const BASE_URL = `http://localhost:${PORT}`;

// ============================================================================
// Alice Logic (No LLM)
// ============================================================================

class AliceAgent {
  private secret: number;
  private attempts: number = 0;

  constructor() {
    this.secret = Math.floor(Math.random() * 100) + 1;
    console.log(`🔒 Secret number: ${this.secret} (shhh!)`);
  }

  grade(guess: number): string {
    this.attempts++;

    if (Number.isNaN(guess)) {
      return "Please enter a valid number between 1 and 100";
    }

    if (guess < 1 || guess > 100) {
      return "Please guess a number between 1 and 100";
    }

    if (guess === this.secret) {
      const result = `🎉 Correct! The number was ${this.secret}. You got it in ${this.attempts} attempts!`;
      // Reset for next game
      this.secret = Math.floor(Math.random() * 100) + 1;
      this.attempts = 0;
      console.log(`🔒 New secret number: ${this.secret} (shhh!)`);
      return result;
    }

    return guess < this.secret
      ? "📉 Too low! Try a higher number."
      : "📈 Too high! Try a lower number.";
  }

  getAttempts(): number {
    return this.attempts;
  }
}

const alice = new AliceAgent();

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

const agentCard: AgentCard = {
  name: "Alice (Grader)",
  description: "Number guessing game grader - I pick a secret number and grade your guesses",
  url: BASE_URL,
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

// ============================================================================
// Hono App
// ============================================================================

const app = new Hono();

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
  return c.json(agentCard);
});

// Health check
app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    agent: "Alice (Grader)",
    attempts: alice.getAttempts(),
    runtime: "Node.js",
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
      const result = alice.grade(guess);

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

// ============================================================================
// Start Server
// ============================================================================

console.log(`
🎲 Alice (Grader) - Number Guessing Game

📍 Port: ${PORT}
🌐 URL: ${BASE_URL}
📋 Agent Card: ${BASE_URL}/.well-known/agent-card.json

🎮 How to play:
   Send me a number between 1 and 100, and I'll tell you if it's:
   - Too low
   - Too high
   - Correct!

📝 Example:
   curl -X POST ${BASE_URL}/ \\
     -H "Content-Type: application/json" \\
     -d '{"jsonrpc":"2.0","method":"message/send","id":"1","params":{"message":{"role":"user","parts":[{"kind":"text","text":"50"}]}}}'

🚀 Ready to play!
`);

serve({
  fetch: app.fetch,
  port: PORT,
  hostname: HOST,
});
