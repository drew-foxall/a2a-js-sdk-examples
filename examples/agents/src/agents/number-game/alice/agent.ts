/**
 * Alice Agent - Number Guessing Game (Grader)
 *
 * A composable agent that:
 * - Picks a secret number between 1 and 100
 * - Grades guesses as "too low", "too high", or "correct"
 * - Tracks number of attempts
 *
 * NO LLM REQUIRED - demonstrates A2A with pure logic.
 *
 * This agent is designed for composability:
 * - Storage is injected via GameStore interface
 * - Can be deployed on any platform (Node.js, Workers, Vercel, etc.)
 * - Session management is handled by the caller
 */

import type { GameState, GameStore, GradeResult } from "./types.js";

/**
 * Configuration for creating an Alice agent
 */
export interface AliceAgentConfig {
  /** Storage implementation for game state */
  gameStore: GameStore;
}

/**
 * Alice Agent - Number Guessing Game Grader
 *
 * Pure logic agent that grades guesses. Storage is injected for composability.
 */
export class AliceAgent {
  private gameStore: GameStore;

  constructor(config: AliceAgentConfig) {
    this.gameStore = config.gameStore;
  }

  /**
   * Grade a guess for a specific session
   *
   * @param sessionId - Unique identifier for the game session
   * @param guess - The number guessed by the player
   * @returns The result of grading the guess
   */
  async grade(sessionId: string, guess: number): Promise<GradeResult> {
    const { state } = await this.gameStore.getOrCreate(sessionId);

    // Handle invalid input
    if (Number.isNaN(guess)) {
      return {
        message: "Please enter a valid number between 1 and 100",
        isCorrect: false,
        attempts: state.attempts,
        guesses: state.guesses,
      };
    }

    if (guess < 1 || guess > 100) {
      return {
        message: "Please guess a number between 1 and 100",
        isCorrect: false,
        attempts: state.attempts,
        guesses: state.guesses,
      };
    }

    // Record the guess
    state.attempts++;
    state.guesses.push(guess);

    // Check if correct
    if (guess === state.secret) {
      const result: GradeResult = {
        message: `🎉 Correct! The number was ${state.secret}. You got it in ${state.attempts} attempt${state.attempts === 1 ? "" : "s"}!`,
        isCorrect: true,
        attempts: state.attempts,
        guesses: [...state.guesses],
      };

      // Delete the game state on win
      await this.gameStore.delete(sessionId);
      return result;
    }

    // Update state for incorrect guess
    await this.gameStore.update(sessionId, state);

    const hint =
      guess < state.secret
        ? "📉 Too low! Try a higher number."
        : "📈 Too high! Try a lower number.";

    return {
      message: `${hint} (Attempt ${state.attempts})`,
      isCorrect: false,
      attempts: state.attempts,
      guesses: [...state.guesses],
    };
  }

  /**
   * Start a new game for a session
   *
   * @param sessionId - Unique identifier for the game session
   * @returns Message confirming new game started
   */
  async newGame(sessionId: string): Promise<string> {
    await this.gameStore.delete(sessionId);
    await this.gameStore.getOrCreate(sessionId);
    return "🎲 New game started! I'm thinking of a number between 1 and 100. Make your first guess!";
  }

  /**
   * Get the status of a game session
   *
   * @param sessionId - Unique identifier for the game session
   * @returns Status message about the current game
   */
  async getStatus(sessionId: string): Promise<{ message: string; state: GameState | null }> {
    const { state, isNew } = await this.gameStore.getOrCreate(sessionId);

    if (isNew) {
      return {
        message: "🎲 New game! I'm thinking of a number between 1 and 100. Make your first guess!",
        state,
      };
    }

    return {
      message: `📊 Game Status:\n• Attempts: ${state.attempts}\n• Guesses: ${state.guesses.join(", ") || "none yet"}\n• Started: ${state.createdAt}`,
      state,
    };
  }

  /**
   * Process a text command (for A2A message handling)
   *
   * @param sessionId - Unique identifier for the game session
   * @param text - The text input from the user
   * @returns The result to send back
   */
  async processMessage(
    sessionId: string,
    text: string
  ): Promise<{ message: string; isCorrect: boolean; attempts: number; guesses: number[] }> {
    const trimmedText = text.trim().toLowerCase();

    // Handle special commands
    if (trimmedText === "new" || trimmedText === "new game" || trimmedText === "reset") {
      const message = await this.newGame(sessionId);
      return { message, isCorrect: false, attempts: 0, guesses: [] };
    }

    if (trimmedText === "status" || trimmedText === "info") {
      const { message, state } = await this.getStatus(sessionId);
      return {
        message,
        isCorrect: false,
        attempts: state?.attempts ?? 0,
        guesses: state?.guesses ?? [],
      };
    }

    // Parse as a guess
    const guess = parseInt(trimmedText, 10);
    const result = await this.grade(sessionId, guess);

    return {
      message: result.message,
      isCorrect: result.isCorrect,
      attempts: result.attempts,
      guesses: result.guesses,
    };
  }
}

/**
 * Create an Alice agent with the given configuration
 *
 * @param config - Configuration including the game store
 * @returns A configured Alice agent
 *
 * @example
 * ```typescript
 * // In-memory for local development
 * const store = createInMemoryGameStore();
 * const alice = createAliceAgent({ gameStore: store });
 *
 * // Redis for production
 * const redis = new Redis({ url, token });
 * const store = createRedisGameStore(redis);
 * const alice = createAliceAgent({ gameStore: store });
 * ```
 */
export function createAliceAgent(config: AliceAgentConfig): AliceAgent {
  return new AliceAgent(config);
}
