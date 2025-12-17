/**
 * Dice Agent
 *
 * An agent that can roll arbitrary dice and check if numbers are prime.
 * This module exports ONLY the agent logic - no HTTP framework dependencies.
 */

// Non-durable exports (standard ToolLoopAgent)
export { createDiceAgent } from "./agent.js";
export { createInstrumentedDiceAgent, createInstrumentedMessageProcessor } from "./instrumented.js";
export { getDiceAgentPrompt } from "./prompt.js";
export * as diceAgentSteps from "./steps.js";
export { checkPrime, rollDice } from "./tools.js";
// Durable exports (Workflow DevKit)
export {
  type DiceAgentWorkflowParams,
  type DiceAgentWorkflowResult,
  diceAgentWorkflow,
} from "./workflow.js";
