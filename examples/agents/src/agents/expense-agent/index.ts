/**
 * Expense Agent
 *
 * An agent that helps track and categorize expenses.
 * This module exports ONLY the agent logic - no HTTP framework dependencies.
 */

export { createExpenseAgent } from "./agent.js";
export { getExpenseAgentPrompt } from "./prompt.js";
