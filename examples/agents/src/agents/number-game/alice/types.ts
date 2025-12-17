/**
 * Alice Agent Types
 *
 * Type definitions for the Number Guessing Game grader agent.
 * These types enable composable storage implementations.
 */

/**
 * Game state stored by the GameStore
 */
export interface GameState {
  /** The secret number to guess */
  secret: number;
  /** Number of attempts made */
  attempts: number;
  /** When the game started */
  createdAt: string;
  /** History of guesses */
  guesses: number[];
}

/**
 * Result of grading a guess
 */
export interface GradeResult {
  /** Message to display to the user */
  message: string;
  /** Whether the guess was correct */
  isCorrect: boolean;
  /** Current attempt count */
  attempts: number;
  /** All guesses made so far */
  guesses: number[];
}

/**
 * Abstract storage interface for game state
 *
 * Implementations can use:
 * - In-memory (for testing/local dev)
 * - Redis (for Cloudflare Workers)
 * - Durable Objects (for Cloudflare)
 * - Any other persistence layer
 */
export interface GameStore {
  /**
   * Get or create game state for a session
   * @param sessionId - Unique identifier for the game session
   * @returns The game state and whether it's a new game
   */
  getOrCreate(sessionId: string): Promise<{ state: GameState; isNew: boolean }>;

  /**
   * Update game state
   * @param sessionId - Unique identifier for the game session
   * @param state - The updated game state
   */
  update(sessionId: string, state: GameState): Promise<void>;

  /**
   * Delete game state (e.g., after winning)
   * @param sessionId - Unique identifier for the game session
   */
  delete(sessionId: string): Promise<void>;
}

