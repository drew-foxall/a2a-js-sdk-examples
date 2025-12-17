/**
 * Code Review Agent
 *
 * An agent that reviews code and provides feedback.
 * This module exports ONLY the agent logic - no HTTP framework dependencies.
 */

export { createCodeReviewAgent } from "./agent.js";
export { getCodeReviewPrompt } from "./prompt.js";
