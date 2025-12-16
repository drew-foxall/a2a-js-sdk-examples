/**
 * Auth Agent Cloudflare Worker
 *
 * Demonstrates enterprise authentication patterns for A2A agents:
 * - OAuth2 Client Credentials (agent-to-agent auth)
 * - CIBA (Client-Initiated Backchannel Authentication)
 * - Durable polling for user consent
 *
 * This worker supports two modes:
 * 1. **Demo Mode** (default): Uses mock auth provider for testing
 * 2. **Production Mode**: Uses real OAuth2 provider (Auth0, Okta, etc.)
 *
 * Demo mode is active when AUTH_DOMAIN is not set.
 */

import { A2AAdapter } from "@drew-foxall/a2a-ai-sdk-adapter";
import {
  DefaultRequestHandler,
  InMemoryTaskStore,
  type TaskStore,
} from "@drew-foxall/a2a-js-sdk/server";
import { A2AHonoApp, ConsoleLogger, type Logger } from "@drew-foxall/a2a-js-sdk/server/hono";
import { UpstashRedisTaskStore } from "@drew-foxall/a2a-js-taskstore-upstash-redis";
import { Redis } from "@upstash/redis";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { getModel, getModelInfo } from "a2a-workers-shared";
import type { EnvWithRedis } from "a2a-workers-shared";
import { createAuthAgent, createDevAuthProvider, createMockAuthProvider, type AuthProvider } from "a2a-agents";

// ============================================================================
// Types
// ============================================================================

interface AuthAgentEnv extends EnvWithRedis {
  // Auth provider configuration
  AUTH_DOMAIN?: string;
  AUTH_CLIENT_ID?: string;
  AUTH_CLIENT_SECRET?: string;
  AUTH_AUDIENCE?: string;
  // Demo mode settings
  DEMO_APPROVAL_DELAY_SECONDS?: string;
}

// ============================================================================
// Factory Functions
// ============================================================================

function createTaskStore(env: AuthAgentEnv): TaskStore {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    const redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });

    return new UpstashRedisTaskStore({
      client: redis,
      prefix: "a2a:auth:",
      ttlSeconds: 86400 * 7, // 7 days
    });
  }

  console.warn("[AuthAgent] Redis not configured - using InMemoryTaskStore");
  return new InMemoryTaskStore();
}

function createAuthProvider(env: AuthAgentEnv): AuthProvider {
  // Check if real auth provider is configured
  if (env.AUTH_DOMAIN && env.AUTH_CLIENT_ID && env.AUTH_CLIENT_SECRET) {
    // TODO: Implement real OAuth2 provider (Auth0, Okta, etc.)
    // For now, fall back to mock with longer delay
    console.log("[AuthAgent] Real auth configured but not implemented - using mock with production delays");
    return createMockAuthProvider({
      domain: env.AUTH_DOMAIN,
      clientId: env.AUTH_CLIENT_ID,
      clientSecret: env.AUTH_CLIENT_SECRET,
      audience: env.AUTH_AUDIENCE,
      approvalDelaySeconds: 15, // Simulate real user approval time
      denialProbability: 0.1, // 10% chance of denial
    });
  }

  // Demo mode - fast approvals for testing
  console.log("[AuthAgent] Demo mode - using mock auth provider");
  return createDevAuthProvider();
}

/**
 * Create Agent Card following A2A Protocol Specification
 *
 * Security schemes follow Section 4.5 of the spec:
 * - 4.5.3 HTTPAuthSecurityScheme (Bearer tokens)
 * - 4.5.4 OAuth2SecurityScheme (OAuth2 flows)
 * - 4.5.9 ClientCredentialsOAuthFlow
 *
 * @see https://a2a-protocol.org/latest/specification/#45-security-objects
 */
function createAgentCard(baseUrl: string, isDemoMode: boolean, env?: AuthAgentEnv) {
  // Build security schemes per A2A Protocol Spec Section 4.5
  const securitySchemes: Record<string, unknown> = {};

  if (!isDemoMode && env?.AUTH_DOMAIN) {
    // OAuth2SecurityScheme (Section 4.5.4) with ClientCredentialsOAuthFlow (Section 4.5.9)
    securitySchemes["oauth2"] = {
      type: "oauth2",
      description: "OAuth2 authentication for agent-to-agent communication",
      flows: {
        // ClientCredentialsOAuthFlow (Section 4.5.9)
        clientCredentials: {
          tokenUrl: `https://${env.AUTH_DOMAIN}/oauth/token`,
          scopes: {
            "read:public": "Access public company information",
            "read:employee": "Access employee data (requires user consent)",
            "read:financial": "Access financial data (requires user consent)",
            "admin:access": "Perform administrative actions (requires admin consent)",
          },
        },
      },
    };

    // HTTPAuthSecurityScheme (Section 4.5.3) for Bearer tokens
    securitySchemes["bearerAuth"] = {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      description: "JWT Bearer token obtained via OAuth2",
    };

    // OpenIdConnectSecurityScheme (Section 4.5.5) for CIBA/OIDC
    securitySchemes["openIdConnect"] = {
      type: "openIdConnect",
      openIdConnectUrl: `https://${env.AUTH_DOMAIN}/.well-known/openid-configuration`,
      description: "OpenID Connect with CIBA support for user consent flows",
    };
  }

  return {
    name: "Auth Agent",
    description: isDemoMode
      ? "Demo HR Assistant showing CIBA authentication patterns (mock auth)"
      : "Secure HR Assistant with OAuth2 and CIBA authentication",
    url: baseUrl,
    version: "1.0.0",
    protocolVersion: "0.3.0",
    preferredTransport: "JSONRPC",
    defaultInputModes: ["text"],
    defaultOutputModes: ["text"],
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: true,
    },
    // Security schemes per A2A Protocol Spec Section 4.5
    securitySchemes: Object.keys(securitySchemes).length > 0 ? securitySchemes : undefined,
    // Security requirements - which schemes are needed for this agent
    security: !isDemoMode
      ? [
          { oauth2: ["read:public"] }, // Minimum: client credentials for public access
          { bearerAuth: [] }, // Alternative: pre-obtained JWT
        ]
      : undefined,
    skills: [
      {
        id: "public_info",
        name: "Public Information",
        description: "Look up public company information (no consent needed)",
        tags: ["directory", "policies", "org-chart"],
        examples: [
          "Who is in the engineering department?",
          "What is the remote work policy?",
        ],
      },
      {
        id: "sensitive_data",
        name: "Sensitive Data Access",
        description: "Access employee data, financials, or personal info (requires user consent via push notification)",
        tags: ["employee", "financial", "personal", "consent"],
        examples: [
          "What is John's salary?",
          "Show me the recent expense reports",
        ],
      },
      {
        id: "admin_actions",
        name: "Administrative Actions",
        description: "Perform admin actions like granting access or modifying permissions (requires admin consent)",
        tags: ["admin", "access", "permissions"],
        examples: [
          "Grant Alice access to the finance dashboard",
          "Revoke Bob's admin privileges",
        ],
      },
    ],
  };
}

// ============================================================================
// Hono App
// ============================================================================

const app = new Hono<{ Bindings: AuthAgentEnv }>();

// CORS for A2A Inspector and external clients
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

// Health check endpoint
app.get("/health", (c) => {
  const isDemoMode = !c.env.AUTH_DOMAIN;
  const { provider, model } = getModelInfo(c.env);

  return c.json({
    status: "healthy",
    agent: "Auth Agent",
    mode: isDemoMode ? "demo" : "production",
    features: {
      ciba: true,
      clientCredentials: true,
      persistentStorage: !!(c.env.UPSTASH_REDIS_REST_URL && c.env.UPSTASH_REDIS_REST_TOKEN),
      storageType: c.env.UPSTASH_REDIS_REST_URL ? "upstash-redis" : "in-memory",
    },
    model: { provider, model },
    authentication: isDemoMode ? "mock" : "oauth2",
  });
});

// A2A Protocol handler
app.all("/*", async (c) => {
  const env = c.env;
  const url = new URL(c.req.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  const isDemoMode = !env.AUTH_DOMAIN;
  const model = getModel(env);
  const taskStore = createTaskStore(env);
  const authProvider = createAuthProvider(env);

  const agentCard = createAgentCard(baseUrl, isDemoMode, env);

  const agent = createAuthAgent({
    model,
    authProvider,
  });

  const agentExecutor = new A2AAdapter(agent, {
    mode: "stream",
    workingMessage: isDemoMode
      ? "Processing request (demo mode)..."
      : "Processing request...",
    includeHistory: true,
    debug: isDemoMode,
  });

  const requestHandler = new DefaultRequestHandler(agentCard, taskStore, agentExecutor);
  const logger: Logger = ConsoleLogger.create();
  const a2aApp = new A2AHonoApp(requestHandler, { logger });

  const subApp = new Hono();
  a2aApp.setupRoutes(subApp);

  const response = await subApp.fetch(c.req.raw, c.env);

  if (response.status !== 404) {
    return response;
  }

  // Fallback for unhandled routes
  return c.json(
    {
      error: "Not Found",
      message: "Use /.well-known/agent-card.json to discover this agent",
      mode: isDemoMode ? "demo" : "production",
      endpoints: {
        agentCard: "/.well-known/agent-card.json",
        sendMessage: "/message/send",
        health: "/health",
      },
    },
    404
  );
});

export default app;

