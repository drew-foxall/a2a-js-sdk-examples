/**
 * Auth Agent
 *
 * An agent that demonstrates CIBA (Client-Initiated Backchannel Authentication) patterns.
 * This module exports ONLY the agent logic - no HTTP framework dependencies.
 */

export {
  type AuthAgentConfig,
  createAuthAgent,
} from "./agent.js";
export { getAuthAgentPrompt } from "./prompt.js";
export {
  createDevAuthProvider,
  createMockAuthProvider,
} from "./providers/mock.js";
export type {
  AuthProvider,
  CIBARequest,
  CIBAResponse,
  TokenResponse,
} from "./types.js";
