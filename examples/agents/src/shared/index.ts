/**
 * Shared Utilities for A2A Agents
 *
 * This module provides common utilities for building A2A agents with AI SDK.
 */

// ============================================================================
// Agent Factory Functions
// ============================================================================

// Adversarial agents
export { createAttackerAgent } from "../agents/adversarial/attacker.js";
export { createDefenderAgent } from "../agents/adversarial/defender.js";
export { createAnalyticsAgent } from "../agents/analytics-agent/agent.js";
// Code review agent
export { createCodeReviewAgent } from "../agents/code-review/agent.js";
// Content agents
export { createCoderAgent } from "../agents/coder/agent.js";
export { createContactExtractorAgent } from "../agents/contact-extractor/agent.js";
export { createContentEditorAgent } from "../agents/content-editor/agent.js";
export { createContentPlannerAgent } from "../agents/content-planner/agent.js";
export { createCurrencyAgent } from "../agents/currency-agent/agent.js";
export { createDiceAgent } from "../agents/dice-agent/agent.js";
// Auth agent (CIBA patterns)
export {
  createAuthAgent,
  type AuthAgentConfig,
  createDevAuthProvider,
  createMockAuthProvider,
  type AuthProvider,
  type CIBARequest,
  type CIBAResponse,
  type TokenResponse,
} from "../agents/auth-agent/index.js";
export {
  createInstrumentedDiceAgent,
  createInstrumentedMessageProcessor,
} from "../agents/dice-agent/instrumented.js";
export { createExpenseAgent } from "../agents/expense-agent/agent.js";
export { createGitHubAgent } from "../agents/github-agent/agent.js";
// Simple agents
export { createHelloWorldAgent } from "../agents/hello-world/agent.js";
export { createImageGeneratorAgent } from "../agents/image-generator/agent.js";
export { createLocalLLMChatAgent } from "../agents/local-llm-chat/agent.js";
// API-integrated agents
export { createMovieAgent } from "../agents/movie-agent/agent.js";
export {
  type AgentArtifact,
  type AgentArtifactPart,
  type AgentContext,
  createPlannerAgent,
  type PlannerAgentConfig,
  type SendMessageFn,
  type SendMessageOptions,
  type SendMessageResult,
} from "../agents/travel-planner-multiagent/planner/agent.js";
// Agent discovery URLs (discovery is handled by @drew-foxall/a2a-ai-provider-v3)
export {
  DEFAULT_LOCAL_AGENT_URLS,
  DEFAULT_WORKER_AGENT_URLS,
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

export { getContentPlannerPrompt } from "../agents/content-planner/prompt.js";
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

// ============================================================================
// Security Schemes (A2A Protocol Spec Section 4.5)
// ============================================================================

export {
  // Types
  type APIKeySecurityScheme,
  type AuthorizationCodeOAuthFlow,
  type ClientCredentialsOAuthFlow,
  type HTTPAuthSecurityScheme,
  type ImplicitOAuthFlow,
  type MutualTLSSecurityScheme,
  type OAuth2SecurityScheme,
  type OAuthFlows,
  type OpenIdConnectSecurityScheme,
  type PasswordOAuthFlow,
  type SecurityRequirement,
  type SecurityScheme,
  type SecuritySchemeBase,
  // Helpers
  createApiKeyScheme,
  createBearerScheme,
  createClientCredentialsScheme,
  createOpenIdConnectScheme,
} from "./security-schemes.js";

// ============================================================================
// Telemetry (Pluggable Observability)
// ============================================================================

export {
  // Factory functions
  createTelemetry,
  getDefaultTelemetry,
  instrument,
  // Providers
  ConsoleTelemetryProvider,
  createConsoleTelemetry,
  createNoOpTelemetry,
  createOpenTelemetry,
  NoOpTelemetryProvider,
  OpenTelemetryProvider,
  // Types
  type AttributeValue,
  type Attributes,
  type ConsoleProviderConfig,
  type CreateTelemetryOptions,
  type LogSeverity,
  type OpenTelemetryProviderConfig,
  type Span,
  type SpanOptions,
  type SpanStatus,
  type TelemetryConfig,
  type TelemetryProvider,
  type TelemetryProviderFactory,
  type TelemetryProviderType,
  // Semantic Conventions
  AgentAttributes,
  SpanNames,
} from "./telemetry/index.js";
