/**
 * Carol Agent - Number Guessing Game (Visualizer) - Cloudflare Worker
 *
 * A simple A2A agent that:
 * - Visualizes guess history
 * - Provides hints about the range
 * - Can shuffle/analyze guess patterns
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
  // No environment variables needed
}

// ============================================================================
// Carol Logic (No LLM)
// ============================================================================

function visualize(guesses: number[]): string {
  if (guesses.length === 0) {
    return "No guesses provided! Use: visualize 50, 25, 37";
  }

  const maxGuess = Math.max(...guesses);
  const scale = 50 / maxGuess;

  let viz = "📊 Guess History:\n";
  viz += "─".repeat(55) + "\n";

  guesses.forEach((guess, i) => {
    const bar = "█".repeat(Math.max(1, Math.round(guess * scale)));
    viz += `${String(i + 1).padStart(2)}. ${String(guess).padStart(3)} |${bar}\n`;
  });

  viz += "─".repeat(55) + "\n";
  viz += `Total guesses: ${guesses.length}\n`;
  viz += `Range: ${Math.min(...guesses)} - ${Math.max(...guesses)}\n`;

  return viz;
}

function analyze(guesses: number[]): string {
  if (guesses.length < 2) {
    return "Need at least 2 guesses to analyze pattern.";
  }

  const avg = guesses.reduce((a, b) => a + b, 0) / guesses.length;
  const sorted = [...guesses].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  let analysis = "🔍 Guess Analysis:\n";
  analysis += `• Average: ${avg.toFixed(1)}\n`;
  analysis += `• Median: ${median}\n`;
  analysis += `• Lowest: ${sorted[0]}\n`;
  analysis += `• Highest: ${sorted[sorted.length - 1]}\n`;

  return analysis;
}

function shuffle(guesses: number[]): number[] {
  const shuffled = [...guesses];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function processCommand(input: string): string {
  const parts = input.trim().toLowerCase().split(/\s+/);
  const command = parts[0];

  const guessText = parts.slice(1).join(" ");
  const guesses = guessText
    .split(/[,\s]+/)
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n));

  switch (command) {
    case "visualize":
    case "viz":
    case "show":
      return visualize(guesses);

    case "analyze":
    case "analysis":
      return analyze(guesses);

    case "shuffle":
      if (guesses.length === 0) {
        return "No guesses to shuffle!";
      }
      const shuffled = shuffle(guesses);
      return `🔀 Shuffled: ${shuffled.join(", ")}`;

    case "help":
    default:
      return `🎨 Carol's Commands:
• visualize [guesses] - Show bar chart of guesses
• analyze [guesses] - Analyze guess pattern
• shuffle [guesses] - Randomly shuffle guesses

Example: "visualize 50, 25, 37, 31, 34"`;
  }
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
      const result = processCommand(text);

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

