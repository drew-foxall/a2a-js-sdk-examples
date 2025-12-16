/**
 * Auth Agent
 *
 * An A2A agent demonstrating enterprise authentication patterns:
 * - OAuth2 Client Credentials (agent-to-agent auth)
 * - CIBA (Client-Initiated Backchannel Authentication)
 * - Durable polling with Workflow DevKit
 *
 * @example
 * ```typescript
 * import { createAuthAgent, createDevAuthProvider } from "a2a-agents";
 *
 * // Create with mock provider for development
 * const authProvider = createDevAuthProvider();
 * const agent = createAuthAgent({
 *   model: openai.chat("gpt-4o-mini"),
 *   authProvider,
 * });
 *
 * // Use in A2A server
 * const result = await agent.run({
 *   prompt: "What is John's salary?",
 * });
 * // User receives push notification for consent
 * ```
 *
 * @module auth-agent
 */

// ============================================================================
// Agent Exports
// ============================================================================

export { createAuthAgent, type AuthAgentConfig } from "./agent.js";
export { getAuthAgentPrompt, getDemoAuthAgentPrompt } from "./prompt.js";

// ============================================================================
// Step Exports (for durable workflows)
// ============================================================================

export {
  accessProtectedResource,
  completeCIBAFlow,
  durableSleep,
  getClientToken,
  initiateCIBA,
  pollCIBAOnce,
} from "./steps.js";

// ============================================================================
// Provider Exports
// ============================================================================

export {
  createDevAuthProvider,
  createMockAuthProvider,
  MockAuthProvider,
  type MockAuthProviderConfig,
} from "./providers/mock.js";

// ============================================================================
// Type Exports
// ============================================================================

export type {
  AuthenticatedOperationResult,
  AuthProvider,
  AuthProviderConfig,
  AuthRequestState,
  CIBAPollResult,
  CIBARequest,
  CIBAResponse,
  CIBAStatus,
  ProtectedResource,
  TokenClaims,
  TokenErrorResponse,
  TokenResponse,
} from "./types.js";

