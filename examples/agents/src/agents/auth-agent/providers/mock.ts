/**
 * Mock Auth Provider
 *
 * A simulated authentication provider for development and testing.
 * Demonstrates the CIBA flow without requiring a real OAuth2 server.
 *
 * Behavior:
 * - Client credentials: Always succeeds
 * - CIBA: Simulates user approval after a configurable delay
 * - Token verification: Basic JWT structure validation
 *
 * Use this for:
 * - Local development
 * - Testing the polling workflow
 * - Understanding the auth flow
 */

import type {
  AuthProvider,
  AuthProviderConfig,
  CIBAPollResult,
  CIBARequest,
  CIBAResponse,
  TokenClaims,
  TokenResponse,
} from "../types.js";

// ============================================================================
// Configuration
// ============================================================================

export interface MockAuthProviderConfig extends AuthProviderConfig {
  /** Simulate approval delay in seconds (default: 10) */
  approvalDelaySeconds?: number;
  /** Probability of denial (0-1, default: 0.1) */
  denialProbability?: number;
  /** Token expiration in seconds (default: 3600) */
  tokenExpiresIn?: number;
}

// ============================================================================
// In-Memory State (simulates auth server state)
// ============================================================================

interface PendingCIBARequest {
  authReqId: string;
  userHint: string;
  scope: string;
  createdAt: number;
  expiresAt: number;
  status: "pending" | "approved" | "denied";
  approveAt?: number; // Timestamp when auto-approve kicks in
}

const pendingRequests = new Map<string, PendingCIBARequest>();

// ============================================================================
// Mock Auth Provider
// ============================================================================

/**
 * Mock Auth Provider
 *
 * Simulates an OAuth2/OIDC provider with CIBA support.
 * Perfect for development and testing without external dependencies.
 */
export class MockAuthProvider implements AuthProvider {
  readonly name = "mock";

  private config: Required<MockAuthProviderConfig>;

  constructor(config: MockAuthProviderConfig) {
    this.config = {
      approvalDelaySeconds: 10,
      denialProbability: 0.1,
      tokenExpiresIn: 3600,
      audience: "https://api.example.com",
      ...config,
    };
  }

  /**
   * Client Credentials flow
   * Always succeeds in mock mode
   */
  async getClientCredentialsToken(scope?: string): Promise<TokenResponse> {
    // Simulate network delay
    await delay(100);

    return {
      access_token: this.generateMockToken("client_credentials", scope),
      token_type: "Bearer",
      expires_in: this.config.tokenExpiresIn,
      scope: scope ?? "read:api",
    };
  }

  /**
   * Initiate CIBA flow
   * Schedules auto-approval after configured delay
   */
  async initiateCIBA(request: CIBARequest): Promise<CIBAResponse> {
    // Simulate network delay
    await delay(200);

    const authReqId = `ciba_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = Date.now();
    const expiresIn = 120; // 2 minutes
    const interval = 5; // Poll every 5 seconds

    // Determine if this request will be denied
    const willBeDenied = Math.random() < this.config.denialProbability;

    // Schedule approval/denial
    const approveAt = willBeDenied
      ? undefined
      : now + this.config.approvalDelaySeconds * 1000;

    const pendingRequest: PendingCIBARequest = {
      authReqId,
      userHint: request.login_hint,
      scope: request.scope,
      createdAt: now,
      expiresAt: now + expiresIn * 1000,
      status: willBeDenied ? "denied" : "pending",
      approveAt,
    };

    pendingRequests.set(authReqId, pendingRequest);

    console.log(`[MockAuth] CIBA initiated for ${request.login_hint}`);
    console.log(
      `[MockAuth] Will ${willBeDenied ? "deny" : `approve in ${this.config.approvalDelaySeconds}s`}`
    );

    return {
      auth_req_id: authReqId,
      interval,
      expires_in: expiresIn,
    };
  }

  /**
   * Poll for CIBA completion
   * Checks if user has approved/denied, or if request expired
   */
  async pollCIBA(authReqId: string): Promise<CIBAPollResult> {
    // Simulate network delay
    await delay(100);

    const request = pendingRequests.get(authReqId);

    if (!request) {
      return {
        status: "error",
        error: "Invalid auth_req_id",
      };
    }

    const now = Date.now();

    // Check if expired
    if (now > request.expiresAt) {
      pendingRequests.delete(authReqId);
      return {
        status: "expired",
        error: "Authorization request expired",
      };
    }

    // Check if denied
    if (request.status === "denied") {
      pendingRequests.delete(authReqId);
      return {
        status: "denied",
        error: "User denied the authorization request",
      };
    }

    // Check if should auto-approve
    if (request.approveAt && now >= request.approveAt) {
      request.status = "approved";
      pendingRequests.delete(authReqId);

      console.log(`[MockAuth] CIBA approved for ${request.userHint}`);

      return {
        status: "approved",
        token: {
          access_token: this.generateMockToken("ciba", request.scope, request.userHint),
          token_type: "Bearer",
          expires_in: this.config.tokenExpiresIn,
          scope: request.scope,
        },
      };
    }

    // Still pending
    const approveAt = request.approveAt ?? now + 30000; // Default fallback
    const remainingSeconds = Math.ceil((approveAt - now) / 1000);
    console.log(`[MockAuth] CIBA pending, ~${remainingSeconds}s until approval`);

    return {
      status: "pending",
    };
  }

  /**
   * Verify a mock token
   * In real implementation, this would verify JWT signature
   */
  async verifyToken(token: string): Promise<TokenClaims> {
    // Simulate network delay
    await delay(50);

    // Mock tokens are base64 encoded JSON
    try {
      const parts = token.split(".");
      if (parts.length !== 3) {
        throw new Error("Invalid token format");
      }

      const payload = JSON.parse(atob(parts[1]));

      // Check expiration
      if (payload.exp && payload.exp < Date.now() / 1000) {
        throw new Error("Token expired");
      }

      return payload as TokenClaims;
    } catch (error) {
      throw new Error(`Token verification failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Refresh a token
   * In mock mode, just generates a new token
   */
  async refreshToken(_refreshToken: string): Promise<TokenResponse> {
    // Simulate network delay
    await delay(100);

    return {
      access_token: this.generateMockToken("refresh"),
      token_type: "Bearer",
      expires_in: this.config.tokenExpiresIn,
    };
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private generateMockToken(grantType: string, scope?: string, subject?: string): string {
    const now = Math.floor(Date.now() / 1000);
    const payload: TokenClaims = {
      sub: subject ?? `client:${this.config.clientId}`,
      iss: `https://${this.config.domain}/`,
      aud: this.config.audience ?? "https://api.example.com",
      exp: now + this.config.tokenExpiresIn,
      iat: now,
      scope: scope ?? "read:api",
      grant_type: grantType,
    };

    // Create a mock JWT structure (header.payload.signature)
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payloadStr = btoa(JSON.stringify(payload));
    const signature = btoa("mock_signature"); // Not a real signature

    return `${header}.${payloadStr}.${signature}`;
  }
}

// ============================================================================
// Utility
// ============================================================================

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a mock auth provider
 */
export function createMockAuthProvider(config: MockAuthProviderConfig): AuthProvider {
  return new MockAuthProvider(config);
}

/**
 * Quick mock provider for development
 */
export function createDevAuthProvider(): AuthProvider {
  return new MockAuthProvider({
    domain: "mock.auth0.com",
    clientId: "dev-client",
    clientSecret: "dev-secret",
    approvalDelaySeconds: 5, // Fast approval for dev
    denialProbability: 0, // Never deny in dev
  });
}

