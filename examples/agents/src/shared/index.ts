/**
 * Shared Utilities for A2A Agents
 *
 * This module provides common utilities for building A2A agents with AI SDK.
 */

// ============================================================================
// Agent Factory Functions
// ============================================================================

export { createAnalyticsAgent } from "../agents/analytics-agent/agent.js";
// Content agents
export { createCoderAgent } from "../agents/coder/agent.js";
export { createContentEditorAgent } from "../agents/content-editor/agent.js";
export { createCurrencyAgent } from "../agents/currency-agent/agent.js";
export { createDiceAgent } from "../agents/dice-agent/agent.js";
export { createGitHubAgent } from "../agents/github-agent/agent.js";
// Simple agents
export { createHelloWorldAgent } from "../agents/hello-world/agent.js";
// API-integrated agents
export { createMovieAgent } from "../agents/movie-agent/agent.js";
export {
  createPlannerAgent,
  type PlannerAgentConfig,
  type SendMessageFn,
  type SendMessageOptions,
} from "../agents/travel-planner-multiagent/planner/agent.js";
// Agent discovery (for building registries)
export {
  type AgentDiscoveryConfig,
  AgentRegistry,
  DEFAULT_LOCAL_AGENT_URLS,
  DEFAULT_WORKER_AGENT_URLS,
  fetchAgentCard,
  type RegisteredAgent,
} from "../agents/travel-planner-multiagent/planner/agent-discovery.js";
// Multi-agent system
export { createWeatherAgent } from "../agents/travel-planner-multiagent/weather-agent/agent.js";

// ============================================================================
// Agent Cards (for Workers)
// ============================================================================

export {
  createTravelPlannerCard,
  travelPlanningSkill,
} from "../agents/travel-planner-multiagent/planner/card.js";

// ============================================================================
// Prompts (for Workers)
// ============================================================================

export { getCurrencyAgentPrompt } from "../agents/currency-agent/prompt.js";
export { getDiceAgentPrompt } from "../agents/dice-agent/prompt.js";
export { getHelloWorldPrompt } from "../agents/hello-world/prompt.js";
export {
  getSimplePlannerPrompt,
  getTravelPlannerPrompt,
  type PlannerPromptConfig,
} from "../agents/travel-planner-multiagent/planner/prompt.js";
export { getWeatherAgentPrompt } from "../agents/travel-planner-multiagent/weather-agent/prompt.js";

// ============================================================================
// Tool Functions (for Workers that need them)
// ============================================================================

// Currency tools (external API)
export {
  type ExchangeRateError,
  type ExchangeRateResponse,
  getExchangeRate,
  isExchangeRateError,
} from "../agents/currency-agent/tools.js";
// Dice tools (pure functions, no external deps)
export { checkPrime, rollDice } from "../agents/dice-agent/tools.js";

// Weather tools (external API)
export {
  type GeocodeResult,
  geocodeLocation,
  getWeatherDescription,
  getWeatherForecast,
  isWeatherError,
  type WeatherForecast,
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
