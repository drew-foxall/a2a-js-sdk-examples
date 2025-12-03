/**
 * Carol Agent - Number Guessing Game (Visualizer)
 *
 * A simple A2A agent that:
 * - Visualizes guess history
 * - Provides hints about the range
 * - Can shuffle/analyze guess patterns
 *
 * NO LLM REQUIRED - demonstrates A2A with pure logic.
 *
 * Port: 8001
 */

import type { AgentCard, AgentSkill } from "@drew-foxall/a2a-js-sdk";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

// ============================================================================
// Configuration
// ============================================================================

const PORT = 8001;
const HOST = "0.0.0.0";
const BASE_URL = `http://localhost:${PORT}`;

// ============================================================================
// Carol Logic (No LLM)
// ============================================================================

class CarolAgent {
  /**
   * Visualize guess history as a bar chart
   */
  visualize(guesses: number[]): string {
    if (guesses.length === 0) {
      return "No guesses yet! Start playing with Alice.";
    }

    const maxGuess = Math.max(...guesses);
    const scale = 50 / maxGuess; // Scale to max 50 chars

    let viz = "📊 Guess History:\n";
    viz += `${"─".repeat(55)}\n`;

    guesses.forEach((guess, i) => {
      const bar = "█".repeat(Math.max(1, Math.round(guess * scale)));
      viz += `${String(i + 1).padStart(2)}. ${String(guess).padStart(3)} |${bar}\n`;
    });

    viz += `${"─".repeat(55)}\n`;
    viz += `Total guesses: ${guesses.length}\n`;
    viz += `Range: ${Math.min(...guesses)} - ${Math.max(...guesses)}\n`;

    return viz;
  }

  /**
   * Analyze guess pattern
   */
  analyze(guesses: number[]): string {
    if (guesses.length < 2) {
      return "Need at least 2 guesses to analyze pattern.";
    }

    const avg = guesses.reduce((a, b) => a + b, 0) / guesses.length;
    const sorted = [...guesses].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    const lowest = sorted[0] ?? 0;
    const highest = sorted[sorted.length - 1] ?? 0;

    let analysis = "🔍 Guess Analysis:\n";
    analysis += `• Average: ${avg.toFixed(1)}\n`;
    analysis += `• Median: ${median}\n`;
    analysis += `• Lowest: ${lowest}\n`;
    analysis += `• Highest: ${highest}\n`;

    // Check if using binary search pattern
    const isBinarySearch = guesses.every((g, i) => {
      if (i === 0) return g === 50;
      const prevGuess = guesses[i - 1];
      return prevGuess !== undefined && Math.abs(g - prevGuess) <= 25;
    });

    if (isBinarySearch) {
      analysis += "• Pattern: Looks like binary search! Smart strategy. 🧠\n";
    }

    return analysis;
  }

  /**
   * Shuffle guesses (for fun)
   */
  shuffle(guesses: number[]): number[] {
    const shuffled = [...guesses];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = shuffled[i];
      const swapVal = shuffled[j];
      if (temp !== undefined && swapVal !== undefined) {
        shuffled[i] = swapVal;
        shuffled[j] = temp;
      }
    }
    return shuffled;
  }

  /**
   * Process a command
   */
  process(input: string): string {
    const parts = input.trim().toLowerCase().split(/\s+/);
    const command = parts[0];

    // Parse guesses from remaining text (comma or space separated)
    const guessText = parts.slice(1).join(" ");
    const guesses = guessText
      .split(/[,\s]+/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n));

    switch (command) {
      case "visualize":
      case "viz":
      case "show":
        return this.visualize(guesses);

      case "analyze":
      case "analysis":
        return this.analyze(guesses);

      case "shuffle": {
        if (guesses.length === 0) {
          return "No guesses to shuffle!";
        }
        const shuffled = this.shuffle(guesses);
        return `🔀 Shuffled: ${shuffled.join(", ")}`;
      }

      default:
        return `🎨 Carol's Commands:
• visualize [guesses] - Show bar chart of guesses
• analyze [guesses] - Analyze guess pattern
• shuffle [guesses] - Randomly shuffle guesses

Example: "visualize 50, 25, 37, 31, 34"`;
    }
  }
}

const carol = new CarolAgent();

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

const agentCard: AgentCard = {
  name: "Carol (Visualizer)",
  description: "Number guessing game visualizer - I create charts and analyze your guesses",
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
  skills: [visualizeSkill],
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
    agent: "Carol (Visualizer)",
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
      const result = carol.process(text);

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
🎨 Carol (Visualizer) - Number Guessing Game

📍 Port: ${PORT}
🌐 URL: ${BASE_URL}
📋 Agent Card: ${BASE_URL}/.well-known/agent-card.json

🎮 Commands:
   • visualize [guesses] - Show bar chart
   • analyze [guesses] - Analyze pattern
   • shuffle [guesses] - Randomize order

📝 Example:
   curl -X POST ${BASE_URL}/ \\
     -H "Content-Type: application/json" \\
     -d '{"jsonrpc":"2.0","method":"message/send","id":"1","params":{"message":{"role":"user","parts":[{"kind":"text","text":"visualize 50, 25, 37, 31, 34"}]}}}'

🚀 Ready to visualize!
`);

serve({
  fetch: app.fetch,
  port: PORT,
  hostname: HOST,
});
