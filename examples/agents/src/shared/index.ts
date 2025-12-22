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
// Auth agent (CIBA patterns)
export {
  type AuthAgentConfig,
  type AuthProvider,
  type CIBARequest,
  type CIBAResponse,
  createAuthAgent,
  createDevAuthProvider,
  createMockAuthProvider,
  type TokenResponse,
} from "../agents/auth-agent/index.js";
// Code review agent
export { createCodeReviewAgent } from "../agents/code-review/agent.js";
// Content agents
export { createCoderAgent } from "../agents/coder/agent.js";
export { createContactExtractorAgent } from "../agents/contact-extractor/agent.js";
export { createContentEditorAgent } from "../agents/content-editor/agent.js";
export { createContentPlannerAgent } from "../agents/content-planner/agent.js";
export { createCurrencyAgent } from "../agents/currency-agent/agent.js";
export { createDiceAgent } from "../agents/dice-agent/agent.js";
export {
  createInstrumentedDiceAgent,
  createInstrumentedMessageProcessor,
} from "../agents/dice-agent/instrumented.js";
export { createExpenseAgent } from "../agents/expense-agent/agent.js";
export {
  createGitHubAgent,
  type GitHubAgentConfig,
} from "../agents/github-agent/agent.js";
export {
  createGitHubClientFromOctokit,
  createGitHubTools,
  type GitHubApiResult,
  type GitHubClient,
  type GitHubCommit,
  type GitHubRepository,
  type GitHubTools,
  type OctokitLike,
} from "../agents/github-agent/tools.js";
// Simple agents
export { createHelloWorldAgent } from "../agents/hello-world/agent.js";
export { createImageGeneratorAgent } from "../agents/image-generator/agent.js";
export { createLocalLLMChatAgent } from "../agents/local-llm-chat/agent.js";
// API-integrated agents
export { createMovieAgent } from "../agents/movie-agent/agent.js";
// Number game agents (no LLM required)
export {
  AliceAgent,
  type AliceAgentConfig,
  createAliceAgent,
  createInMemoryGameStore,
  createRedisGameStore,
  type GameState,
  type GameStore,
  type GradeResult,
  InMemoryGameStore,
  type RedisClient,
  RedisGameStore,
  type RedisGameStoreConfig,
} from "../agents/number-game/alice/index.js";
export {
  CarolAgent,
  type CarolResult,
  createCarolAgent,
} from "../agents/number-game/carol/index.js";
// Airbnb agent (HTTP MCP for Workers)
export {
  type AirbnbAgentHttpConfig,
  createAirbnbAgentHttp,
} from "../agents/travel-planner-multiagent/airbnb-agent/agent-http.js";
export {
  type AirbnbSearchParams,
  type AirbnbTools,
  type CloudflareFetcher,
  createAirbnbMCPTools,
  createMCPHttpClient,
  type ListingDetailsParams,
  type MCPClient,
  MCPHttpClient,
  type MCPHttpClientConfig,
} from "../agents/travel-planner-multiagent/airbnb-agent/mcp-client-http.js";
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
  // Routing helpers (agent-owned routing step)
  type A2AResponseType,
  type ArtifactGenerationContext,
  ConsoleLogger,
  createLLMResponseTypeRouter,
  extractTextFromA2AMessage,
  isTaskContinuation,
  type LLMResponseTypeRouterOptions,
  messageUnlessContinuation,
  NoOpLogger,
  type ParsedArtifact,
  type ParsedArtifacts,
  preferTaskForContinuations,
  type ResponseTypeSelectionContext,
  type SelectResponseType,
} from "@drew-foxall/a2a-ai-sdk-adapter";

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
  // Helpers
  createApiKeyScheme,
  createBearerScheme,
  createClientCredentialsScheme,
  createOpenIdConnectScheme,
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
} from "./security-schemes.js";

// ============================================================================
// Telemetry (Pluggable Observability)
// ============================================================================

export {
  // Semantic Conventions
  AgentAttributes,
  type Attributes,
  // Types
  type AttributeValue,
  type ConsoleProviderConfig,
  // Providers
  ConsoleTelemetryProvider,
  type CreateTelemetryOptions,
  createConsoleTelemetry,
  createNoOpTelemetry,
  createOpenTelemetry,
  // Factory functions
  createTelemetry,
  getDefaultTelemetry,
  instrument,
  type LogSeverity,
  NoOpTelemetryProvider,
  OpenTelemetryProvider,
  type OpenTelemetryProviderConfig,
  type Span,
  SpanNames,
  type SpanOptions,
  type SpanStatus,
  type TelemetryConfig,
  type TelemetryProvider,
  type TelemetryProviderFactory,
  type TelemetryProviderType,
} from "./telemetry/index.js";
