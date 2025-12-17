/**
 * Currency Agent
 *
 * An agent that converts currencies using real-time exchange rates.
 * This module exports ONLY the agent logic - no HTTP framework dependencies.
 */

export { createCurrencyAgent } from "./agent.js";
export { getCurrencyAgentPrompt } from "./prompt.js";
export {
  type ExchangeRateError,
  type ExchangeRateResponse,
  getExchangeRate,
  isExchangeRateError,
} from "./tools.js";
