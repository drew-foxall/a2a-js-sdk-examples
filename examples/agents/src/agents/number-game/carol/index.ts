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
 * This module exports ONLY the agent logic - no HTTP framework dependencies.
 * For a standalone server, see the Node.js server in the examples directory.
 */

// ============================================================================
// Module Exports (for composability)
// ============================================================================

export { CarolAgent, createCarolAgent, type CarolResult } from "./agent.js";
