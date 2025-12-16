/**
 * A2A Protocol Security Scheme Types
 *
 * Type definitions following A2A Protocol Specification Section 4.5
 * @see https://a2a-protocol.org/latest/specification/#45-security-objects
 */

// ============================================================================
// Base Security Scheme (Section 4.5.1)
// ============================================================================

/**
 * Base interface for all security schemes
 */
export interface SecuritySchemeBase {
  /** Type of security scheme */
  type: string;
  /** Human-readable description */
  description?: string;
}

// ============================================================================
// API Key Security Scheme (Section 4.5.2)
// ============================================================================

/**
 * API Key security scheme
 * @see https://a2a-protocol.org/latest/specification/#452-apikeysecurityscheme
 */
export interface APIKeySecurityScheme extends SecuritySchemeBase {
  type: "apiKey";
  /** Name of the header, query, or cookie parameter */
  name: string;
  /** Location of the API key */
  in: "header" | "query" | "cookie";
}

// ============================================================================
// HTTP Auth Security Scheme (Section 4.5.3)
// ============================================================================

/**
 * HTTP authentication security scheme (Bearer, Basic, etc.)
 * @see https://a2a-protocol.org/latest/specification/#453-httpauthsecurityscheme
 */
export interface HTTPAuthSecurityScheme extends SecuritySchemeBase {
  type: "http";
  /** HTTP auth scheme (bearer, basic, digest, etc.) */
  scheme: "bearer" | "basic" | "digest" | string;
  /** Format hint for bearer tokens (e.g., "JWT") */
  bearerFormat?: string;
}

// ============================================================================
// OAuth2 Security Scheme (Section 4.5.4)
// ============================================================================

/**
 * OAuth2 security scheme
 * @see https://a2a-protocol.org/latest/specification/#454-oauth2securityscheme
 */
export interface OAuth2SecurityScheme extends SecuritySchemeBase {
  type: "oauth2";
  /** OAuth2 flows configuration */
  flows: OAuthFlows;
}

/**
 * OAuth2 flows configuration
 * @see https://a2a-protocol.org/latest/specification/#457-oauthflows
 */
export interface OAuthFlows {
  /** Authorization Code flow (Section 4.5.8) */
  authorizationCode?: AuthorizationCodeOAuthFlow;
  /** Client Credentials flow (Section 4.5.9) - for agent-to-agent auth */
  clientCredentials?: ClientCredentialsOAuthFlow;
  /** Implicit flow (Section 4.5.10) - not recommended */
  implicit?: ImplicitOAuthFlow;
  /** Password flow (Section 4.5.11) - not recommended */
  password?: PasswordOAuthFlow;
}

/**
 * Authorization Code OAuth flow
 * @see https://a2a-protocol.org/latest/specification/#458-authorizationcodeoauthflow
 */
export interface AuthorizationCodeOAuthFlow {
  /** Authorization endpoint URL */
  authorizationUrl: string;
  /** Token endpoint URL */
  tokenUrl: string;
  /** Refresh token URL (optional) */
  refreshUrl?: string;
  /** Available scopes */
  scopes: Record<string, string>;
}

/**
 * Client Credentials OAuth flow - commonly used for agent-to-agent auth
 * @see https://a2a-protocol.org/latest/specification/#459-clientcredentialsoauthflow
 */
export interface ClientCredentialsOAuthFlow {
  /** Token endpoint URL */
  tokenUrl: string;
  /** Refresh token URL (optional) */
  refreshUrl?: string;
  /** Available scopes */
  scopes: Record<string, string>;
}

/**
 * Implicit OAuth flow (not recommended for new implementations)
 * @see https://a2a-protocol.org/latest/specification/#4510-implicitoauthflow
 */
export interface ImplicitOAuthFlow {
  /** Authorization endpoint URL */
  authorizationUrl: string;
  /** Available scopes */
  scopes: Record<string, string>;
}

/**
 * Password OAuth flow (not recommended)
 * @see https://a2a-protocol.org/latest/specification/#4511-passwordoauthflow
 */
export interface PasswordOAuthFlow {
  /** Token endpoint URL */
  tokenUrl: string;
  /** Refresh token URL (optional) */
  refreshUrl?: string;
  /** Available scopes */
  scopes: Record<string, string>;
}

// ============================================================================
// OpenID Connect Security Scheme (Section 4.5.5)
// ============================================================================

/**
 * OpenID Connect security scheme - supports CIBA for headless auth
 * @see https://a2a-protocol.org/latest/specification/#455-openidconnectsecurityscheme
 */
export interface OpenIdConnectSecurityScheme extends SecuritySchemeBase {
  type: "openIdConnect";
  /** OpenID Connect discovery document URL */
  openIdConnectUrl: string;
}

// ============================================================================
// Mutual TLS Security Scheme (Section 4.5.6)
// ============================================================================

/**
 * Mutual TLS (mTLS) security scheme
 * @see https://a2a-protocol.org/latest/specification/#456-mutualtlssecurityscheme
 */
export interface MutualTLSSecurityScheme extends SecuritySchemeBase {
  type: "mutualTLS";
}

// ============================================================================
// Union Type
// ============================================================================

/**
 * Any valid A2A Protocol security scheme
 */
export type SecurityScheme =
  | APIKeySecurityScheme
  | HTTPAuthSecurityScheme
  | OAuth2SecurityScheme
  | OpenIdConnectSecurityScheme
  | MutualTLSSecurityScheme;

// ============================================================================
// Security Requirement
// ============================================================================

/**
 * Security requirement for an agent
 *
 * Each key is a security scheme name, and the value is an array of scopes
 * required for that scheme (empty array for schemes without scopes).
 *
 * @example
 * ```typescript
 * // Require OAuth2 with specific scopes
 * const requirement: SecurityRequirement = {
 *   oauth2: ["read:public", "read:employee"]
 * };
 *
 * // Require bearer token (no scopes)
 * const bearerReq: SecurityRequirement = {
 *   bearerAuth: []
 * };
 * ```
 */
export type SecurityRequirement = Record<string, string[]>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create an OAuth2 security scheme with Client Credentials flow
 * Common for agent-to-agent authentication
 */
export function createClientCredentialsScheme(
  tokenUrl: string,
  scopes: Record<string, string>,
  description?: string
): OAuth2SecurityScheme {
  return {
    type: "oauth2",
    description: description ?? "OAuth2 Client Credentials for agent-to-agent authentication",
    flows: {
      clientCredentials: {
        tokenUrl,
        scopes,
      },
    },
  };
}

/**
 * Create a Bearer token HTTP auth scheme
 */
export function createBearerScheme(
  bearerFormat?: string,
  description?: string
): HTTPAuthSecurityScheme {
  return {
    type: "http",
    scheme: "bearer",
    bearerFormat,
    description: description ?? "Bearer token authentication",
  };
}

/**
 * Create an OpenID Connect scheme with CIBA support
 */
export function createOpenIdConnectScheme(
  discoveryUrl: string,
  description?: string
): OpenIdConnectSecurityScheme {
  return {
    type: "openIdConnect",
    openIdConnectUrl: discoveryUrl,
    description: description ?? "OpenID Connect authentication",
  };
}

/**
 * Create an API Key scheme
 */
export function createApiKeyScheme(
  name: string,
  location: "header" | "query" | "cookie" = "header",
  description?: string
): APIKeySecurityScheme {
  return {
    type: "apiKey",
    name,
    in: location,
    description: description ?? `API key in ${location}`,
  };
}

