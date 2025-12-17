/**
 * Carol Agent - Number Guessing Game (Visualizer)
 *
 * A composable agent that:
 * - Visualizes guess history as bar charts
 * - Analyzes guess patterns
 * - Can shuffle/analyze guess patterns
 *
 * NO LLM REQUIRED - demonstrates A2A with pure logic.
 *
 * This agent is stateless and can be deployed on any platform.
 */

/**
 * Result of a Carol command
 */
export interface CarolResult {
  /** The text response to display */
  text: string;
  /** The command that was processed */
  command: string;
  /** The guesses that were processed (if any) */
  guesses: number[];
}

/**
 * Carol Agent - Number Guessing Game Visualizer
 *
 * Pure logic agent that visualizes and analyzes guesses.
 */
export class CarolAgent {
  /**
   * Visualize guess history as a bar chart
   */
  visualize(guesses: number[]): string {
    if (guesses.length === 0) {
      return "No guesses provided! Use: visualize 50, 25, 37";
    }

    const maxGuess = Math.max(...guesses);
    const scale = 50 / maxGuess; // Scale to max 50 chars

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
   * Get help text
   */
  getHelp(): string {
    return `🎨 Carol's Commands:
• visualize [guesses] - Show bar chart of guesses
• analyze [guesses] - Analyze guess pattern
• shuffle [guesses] - Randomly shuffle guesses

Example: "visualize 50, 25, 37, 31, 34"`;
  }

  /**
   * Process a text command
   *
   * @param input - The text input from the user
   * @returns The result of processing the command
   */
  processMessage(input: string): CarolResult {
    const parts = input.trim().toLowerCase().split(/\s+/);
    const command = parts[0] ?? "help";

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
        return {
          text: this.visualize(guesses),
          command: "visualize",
          guesses,
        };

      case "analyze":
      case "analysis":
        return {
          text: this.analyze(guesses),
          command: "analyze",
          guesses,
        };

      case "shuffle": {
        if (guesses.length === 0) {
          return {
            text: "No guesses to shuffle!",
            command: "shuffle",
            guesses: [],
          };
        }
        const shuffled = this.shuffle(guesses);
        return {
          text: `🔀 Shuffled: ${shuffled.join(", ")}`,
          command: "shuffle",
          guesses: shuffled,
        };
      }

      case "help":
      default:
        return {
          text: this.getHelp(),
          command: "help",
          guesses: [],
        };
    }
  }
}

/**
 * Create a Carol agent
 *
 * @returns A configured Carol agent
 *
 * @example
 * ```typescript
 * const carol = createCarolAgent();
 * const result = carol.processMessage("visualize 50, 25, 37");
 * console.log(result.text);
 * ```
 */
export function createCarolAgent(): CarolAgent {
  return new CarolAgent();
}

