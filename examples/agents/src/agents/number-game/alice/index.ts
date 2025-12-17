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
 * This module exports ONLY the agent logic - no HTTP framework dependencies.
 * For a standalone server, see the Node.js server in the examples directory.
 */

// ============================================================================
// Module Exports (for composability)
// ============================================================================

export { AliceAgent, type AliceAgentConfig, createAliceAgent } from "./agent.js";
export {
  createInMemoryGameStore,
  createRedisGameStore,
  InMemoryGameStore,
  type RedisClient,
  RedisGameStore,
  type RedisGameStoreConfig,
} from "./stores.js";
export type { GameState, GameStore, GradeResult } from "./types.js";
