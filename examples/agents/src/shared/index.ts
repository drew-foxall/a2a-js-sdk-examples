/**
 * Shared Utilities for A2A Agents
 *
 * This module provides common utilities for building A2A agents with AI SDK.
 */

// ============================================================================
// Agent Factory Functions
// ============================================================================

// Simple agents
export { createHelloWorldAgent } from "../agents/hello-world/agent.js";
export { createDiceAgent } from "../agents/dice-agent/agent.js";
export { createCurrencyAgent } from "../agents/currency-agent/agent.js";

// Content agents
export { createCoderAgent } from "../agents/coder/agent.js";
export { createContentEditorAgent } from "../agents/content-editor/agent.js";

// API-integrated agents
export { createMovieAgent } from "../agents/movie-agent/agent.js";
export { createGitHubAgent } from "../agents/github-agent/agent.js";
export { createAnalyticsAgent } from "../agents/analytics-agent/agent.js";

// Multi-agent system
export { createWeatherAgent } from "../agents/travel-planner-multiagent/weather-agent/agent.js";
export {
  createPlannerAgent,
  createTravelPlannerAgent,
  type PlannerAgentConfig,
} from "../agents/travel-planner-multiagent/planner/agent.js";

// ============================================================================
// Agent Card Configurations (for Workers)
// ============================================================================

export { getHelloWorldPrompt } from "../agents/hello-world/prompt.js";
export { getDiceAgentPrompt } from "../agents/dice-agent/prompt.js";
export { getCurrencyAgentPrompt } from "../agents/currency-agent/prompt.js";
export { getWeatherAgentPrompt } from "../agents/travel-planner-multiagent/weather-agent/prompt.js";

// ============================================================================
// Tool Functions (for Workers that need them)
// ============================================================================

// Dice tools (pure functions, no external deps)
export { rollDice, checkPrime } from "../agents/dice-agent/tools.js";

// Currency tools (external API)
export {
  getExchangeRate,
  isExchangeRateError,
  type ExchangeRateResponse,
  type ExchangeRateError,
} from "../agents/currency-agent/tools.js";

// Weather tools (external API)
export {
  getWeatherForecast,
  getWeatherDescription,
  isWeatherError,
  geocodeLocation,
  type WeatherForecast,
  type GeocodeResult,
} from "../agents/travel-planner-multiagent/weather-agent/tools.js";

// ============================================================================
// A2A Adapter (re-exported for convenience)
// ============================================================================

export {
  A2AAdapter,
  type A2AAdapterConfig,
  type A2ALogger,
  type AIGenerateResult,
  type AIStreamResult,
  ConsoleLogger,
  NoOpLogger,
  type ParsedArtifact,
  type ParsedArtifacts,
} from "./a2a-adapter.js";

// ============================================================================
// Utilities
// ============================================================================

export { extractText, getModel, getModelInfo } from "./utils.js";
