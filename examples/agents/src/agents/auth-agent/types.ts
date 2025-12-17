/**
 * Auth Agent - Type Definitions
 *
 * Types for the authentication agent that demonstrates:
 * - CIBA (Client-Initiated Backchannel Authentication) patterns
 * - Durable polling with Workflow DevKit
 * - OAuth2 token management
 */

// ============================================================================
// OAuth2 Types
// ============================================================================

/**
 * OAuth2 Token Response
 */
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

/**
 * OAuth2 Error Response
 */
export interface TokenErrorResponse {
  error: string;
  error_description?: string;
}

/**
 * CIBA (Client-Initiated Backchannel Authentication) Request
 */
export interface CIBARequest {
  /** User identifier (email, phone, etc.) */
  login_hint: string;
  /** Requested scopes */
  scope: string;
  /** Human-readable binding message shown to user */
  binding_message?: string;
  /** Client notification token for push notifications */
  client_notification_token?: string;
}

/**
 * CIBA Initiation Response
 */
export interface CIBAResponse {
  /** Unique identifier for this auth request */
  auth_req_id: string;
  /** Recommended polling interval in seconds */
  interval: number;
  /** Expiration time in seconds */
  expires_in: number;
}

/**
 * CIBA Polling Status
 */
export type CIBAStatus =
  | "pending" // User hasn't responded yet
  | "approved" // User approved, token available
  | "denied" // User denied the request
  | "expired" // Request expired
  | "error"; // Error occurred

/**
 * CIBA Polling Result
 */
export interface CIBAPollResult {
  status: CIBAStatus;
  token?: TokenResponse;
  error?: string;
}

// ============================================================================
// Auth Provider Interface (Provider-Agnostic)
// ============================================================================

/**
 * Configuration for the auth provider
 */
export interface AuthProviderConfig {
  /** OAuth2 authorization server domain/URL */
  domain: string;
  /** Client ID for the agent */
  clientId: string;
  /** Client secret for the agent */
  clientSecret: string;
  /** Audience for the token (API identifier) */
  audience?: string;
}

/**
 * Auth Provider Interface
 *
 * Implement this interface to support different OAuth2/OIDC providers:
 * - Auth0
 * - Okta
 * - Azure AD
 * - Keycloak
 * - Custom OAuth2 server
 */
export interface AuthProvider {
  /** Provider name for logging */
  readonly name: string;

  /**
   * Get a token using Client Credentials flow
   * Used for agent-to-agent authentication
   */
  getClientCredentialsToken(scope?: string): Promise<TokenResponse>;

  /**
   * Initiate CIBA flow
   * Starts backchannel authentication, sends push notification to user
   */
  initiateCIBA(request: CIBARequest): Promise<CIBAResponse>;

  /**
   * Poll for CIBA completion
   * Check if user has approved/denied the request
   */
  pollCIBA(authReqId: string): Promise<CIBAPollResult>;

  /**
   * Verify and decode a JWT token
   */
  verifyToken(token: string): Promise<TokenClaims>;

  /**
   * Refresh an access token
   */
  refreshToken(refreshToken: string): Promise<TokenResponse>;
}

/**
 * Decoded JWT claims
 */
export interface TokenClaims {
  /** Subject (user ID) */
  sub: string;
  /** Issuer */
  iss: string;
  /** Audience */
  aud: string | string[];
  /** Expiration timestamp */
  exp: number;
  /** Issued at timestamp */
  iat: number;
  /** Scopes */
  scope?: string;
  /** Additional claims */
  [key: string]: unknown;
}

// ============================================================================
// Auth Agent Types
// ============================================================================

/**
 * Protected resource that requires user consent
 */
export interface ProtectedResource {
  /** Resource type */
  type: "employee_data" | "financial_data" | "personal_info" | "admin_action";
  /** Resource identifier */
  id: string;
  /** Required scope to access */
  requiredScope: string;
  /** Description shown to user */
  description: string;
}

/**
 * Auth request state (persisted in workflow)
 */
export interface AuthRequestState {
  /** Unique request ID */
  requestId: string;
  /** User being authenticated */
  userHint: string;
  /** Resource being accessed */
  resource: ProtectedResource;
  /** CIBA auth request ID */
  authReqId?: string;
  /** Current status */
  status: CIBAStatus | "initiating";
  /** Number of poll attempts */
  pollCount: number;
  /** Created timestamp */
  createdAt: string;
  /** Last updated timestamp */
  updatedAt: string;
}

/**
 * Result of an authenticated operation
 */
export interface AuthenticatedOperationResult {
  success: boolean;
  data?: unknown;
  error?: string;
  /** Whether user consent was required */
  consentRequired: boolean;
  /** Time spent waiting for consent (if any) */
  consentWaitMs?: number;
}
