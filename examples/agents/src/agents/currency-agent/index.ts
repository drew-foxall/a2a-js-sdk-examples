/**
 * Currency Agent
 *
 * An agent that converts currencies using real-time exchange rates.
 * This module exports ONLY the agent logic - no HTTP framework dependencies.
 */

export { createCurrencyAgent } from "./agent.js";
export { getCurrencyAgentPrompt } from "./prompt.js";
export {
  getExchangeRate,
  isExchangeRateError,
  type ExchangeRateError,
  type ExchangeRateResponse,
} from "./tools.js";
