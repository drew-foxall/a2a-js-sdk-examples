/**
 * Auth Agent - Durable Steps
 *
 * Durable step wrappers for authentication operations.
 * These steps provide:
 * - Automatic retry on network failures
 * - Result caching across workflow restarts
 * - Observability via Workflow DevKit traces
 *
 * The CIBA polling pattern is particularly valuable here because:
 * - User approval can take minutes
 * - Polling needs to survive worker restarts
 * - Results should be cached once obtained
 */

import type {
  AuthProvider,
  CIBAPollResult,
  CIBARequest,
  CIBAResponse,
  ProtectedResource,
  TokenResponse,
} from "./types.js";

// ============================================================================
// Durable Steps
// ============================================================================

/**
 * Durable step: Get client credentials token
 *
 * Wraps the OAuth2 client credentials flow with durability.
 * If the workflow restarts after obtaining a token, the cached
 * token is returned instead of re-requesting.
 *
 * @param provider - The auth provider to use
 * @param scope - Optional scope for the token
 * @returns Token response
 */
export async function getClientToken(
  provider: AuthProvider,
  scope?: string
): Promise<TokenResponse> {
  "use step";

  console.log(`[AuthStep] Getting client credentials token (scope: ${scope ?? "default"})`);
  const token = await provider.getClientCredentialsToken(scope);
  console.log(`[AuthStep] Token obtained, expires in ${token.expires_in}s`);

  return token;
}

/**
 * Durable step: Initiate CIBA flow
 *
 * Starts the backchannel authentication flow.
 * This step is durable so if the workflow restarts, we won't
 * re-initiate CIBA (which would send another push notification).
 *
 * @param provider - The auth provider to use
 * @param request - CIBA request parameters
 * @returns CIBA response with auth_req_id for polling
 */
export async function initiateCIBA(
  provider: AuthProvider,
  request: CIBARequest
): Promise<CIBAResponse> {
  "use step";

  console.log(`[AuthStep] Initiating CIBA for user: ${request.login_hint}`);
  const response = await provider.initiateCIBA(request);
  console.log(`[AuthStep] CIBA initiated, auth_req_id: ${response.auth_req_id}`);

  return response;
}

/**
 * Durable step: Poll CIBA status
 *
 * Single poll attempt - meant to be called in a loop with durable sleep.
 * Each poll is a separate durable step so results are cached.
 *
 * @param provider - The auth provider to use
 * @param authReqId - The auth request ID from initiateCIBA
 * @returns Poll result with status and optional token
 */
export async function pollCIBAOnce(
  provider: AuthProvider,
  authReqId: string
): Promise<CIBAPollResult> {
  "use step";

  console.log(`[AuthStep] Polling CIBA status for: ${authReqId}`);
  const result = await provider.pollCIBA(authReqId);
  console.log(`[AuthStep] Poll result: ${result.status}`);

  return result;
}

/**
 * Durable step: Access protected resource
 *
 * Wraps the actual resource access with durability.
 * This is called after obtaining user consent.
 *
 * @param resource - The protected resource to access
 * @param token - The access token
 * @param fetchFn - Function to fetch the resource (injected for testability)
 * @returns The fetched data
 */
export async function accessProtectedResource<T>(
  resource: ProtectedResource,
  token: string,
  fetchFn: (resourceId: string, token: string) => Promise<T>
): Promise<T> {
  "use step";

  console.log(`[AuthStep] Accessing protected resource: ${resource.type}/${resource.id}`);
  const data = await fetchFn(resource.id, token);
  console.log("[AuthStep] Resource accessed successfully");

  return data;
}

// ============================================================================
// Durable Sleep (from Workflow DevKit)
// ============================================================================

/**
 * Durable sleep that survives workflow restarts
 *
 * This is the key to the CIBA polling pattern - we can sleep for
 * extended periods without holding compute resources, and the
 * workflow will resume exactly where it left off.
 *
 * Note: In Workflow DevKit, this is provided by the framework.
 * This placeholder shows the pattern for non-workflow contexts.
 */
export async function durableSleep(seconds: number): Promise<void> {
  "use step";

  console.log(`[AuthStep] Sleeping for ${seconds} seconds (durable)`);

  // In Workflow DevKit, this is replaced with actual durable sleep
  // that persists the wakeup time and can resume after restart
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));

  console.log(`[AuthStep] Woke up after ${seconds} seconds`);
}

// ============================================================================
// Composite Operations
// ============================================================================

/**
 * Durable step: Complete CIBA flow with polling
 *
 * This combines CIBA initiation and polling into a single operation
 * that handles the full user consent flow.
 *
 * The polling loop uses durable sleep, so:
 * - Worker can restart without losing progress
 * - Compute is not held during wait periods
 * - Each poll attempt is cached
 *
 * @param provider - The auth provider to use
 * @param request - CIBA request parameters
 * @param maxWaitSeconds - Maximum time to wait for approval (default: 120)
 * @returns Final poll result with token or error
 */
export async function completeCIBAFlow(
  provider: AuthProvider,
  request: CIBARequest,
  maxWaitSeconds: number = 120
): Promise<CIBAPollResult> {
  "use step";

  // Step 1: Initiate CIBA
  const cibaResponse = await initiateCIBA(provider, request);

  // Step 2: Poll with backoff until approval, denial, or timeout
  const startTime = Date.now();
  const maxWaitMs = maxWaitSeconds * 1000;
  let pollCount = 0;
  const baseInterval = cibaResponse.interval || 5;

  while (Date.now() - startTime < maxWaitMs) {
    pollCount++;

    // Poll for status
    const result = await pollCIBAOnce(provider, cibaResponse.auth_req_id);

    // Terminal states - return immediately
    if (result.status === "approved" || result.status === "denied" || result.status === "error") {
      console.log(
        `[AuthStep] CIBA completed with status: ${result.status} after ${pollCount} polls`
      );
      return result;
    }

    // Still pending - wait before next poll
    // Use exponential backoff: 5s, 7s, 10s, 15s... up to 30s max
    const backoffMultiplier = Math.min(pollCount, 6);
    const sleepSeconds = Math.min(baseInterval * (1 + backoffMultiplier * 0.2), 30);

    await durableSleep(sleepSeconds);
  }

  // Timeout
  console.log(`[AuthStep] CIBA timed out after ${maxWaitSeconds}s and ${pollCount} polls`);
  return {
    status: "expired",
    error: `Authorization request timed out after ${maxWaitSeconds} seconds`,
  };
}
