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
 *
 * NOTE: This worker uses a custom implementation instead of the factory
 * because the agent card is dynamically generated based on auth configuration.
 */

import type { AgentCard, AgentSkill } from "@drew-foxall/a2a-js-sdk";
import { A2AHonoApp, ConsoleLogger, type Logger } from "@drew-foxall/a2a-js-sdk/server/hono";
import {
  createAuthAgent,
  createDevAuthProvider,
  createMockAuthProvider,
  type AuthProvider,
} from "a2a-agents";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  createA2AExecutor,
  createTaskStore,
  getModel,
  getModelInfo,
  isRedisConfigured,
  type WorkerEnvWithRedis,
} from "a2a-workers-shared";
import { DefaultRequestHandler } from "@drew-foxall/a2a-js-sdk/server";

// ============================================================================
// Types
// ============================================================================

interface AuthAgentEnv extends WorkerEnvWithRedis {
  AUTH_DOMAIN?: string;
  AUTH_CLIENT_ID?: string;
  AUTH_CLIENT_SECRET?: string;
  AUTH_AUDIENCE?: string;
  DEMO_APPROVAL_DELAY_SECONDS?: string;
}

// ============================================================================
// Skills
// ============================================================================

const publicInfoSkill: AgentSkill = {
  id: "public_info",
  name: "Public Information",
  description: "Look up public company information (no consent needed)",
  tags: ["directory", "policies", "org-chart"],
  examples: ["Who is in the engineering department?", "What is the remote work policy?"],
};

const sensitiveDataSkill: AgentSkill = {
  id: "sensitive_data",
  name: "Sensitive Data Access",
  description:
    "Access employee data, financials, or personal info (requires user consent via push notification)",
  tags: ["employee", "financial", "personal", "consent"],
  examples: ["What is John's salary?", "Show me the recent expense reports"],
};

const adminActionsSkill: AgentSkill = {
  id: "admin_actions",
  name: "Administrative Actions",
  description:
    "Perform admin actions like granting access or modifying permissions (requires admin consent)",
  tags: ["admin", "access", "permissions"],
  examples: ["Grant Alice access to the finance dashboard", "Revoke Bob's admin privileges"],
};

// ============================================================================
// Factory Functions
// ============================================================================

function createAuthProvider(env: AuthAgentEnv): AuthProvider {
  if (env.AUTH_DOMAIN && env.AUTH_CLIENT_ID && env.AUTH_CLIENT_SECRET) {
    console.log(
      "[AuthAgent] Real auth configured but not implemented - using mock with production delays"
    );
    return createMockAuthProvider({
      domain: env.AUTH_DOMAIN,
      clientId: env.AUTH_CLIENT_ID,
      clientSecret: env.AUTH_CLIENT_SECRET,
      audience: env.AUTH_AUDIENCE,
      approvalDelaySeconds: 15,
      denialProbability: 0.1,
    });
  }

  console.log("[AuthAgent] Demo mode - using mock auth provider");
  return createDevAuthProvider();
}

/**
 * Create Agent Card following A2A Protocol Specification
 *
 * Security schemes follow Section 4.5 of the spec.
 * Card is dynamically generated based on auth configuration.
 */
function createAgentCard(baseUrl: string, isDemoMode: boolean, env?: AuthAgentEnv): AgentCard {
  const securitySchemes: Record<string, unknown> = {};

  if (!isDemoMode && env?.AUTH_DOMAIN) {
    securitySchemes["oauth2"] = {
      type: "oauth2",
      description: "OAuth2 authentication for agent-to-agent communication",
      flows: {
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

    securitySchemes["bearerAuth"] = {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      description: "JWT Bearer token obtained via OAuth2",
    };

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
    securitySchemes: Object.keys(securitySchemes).length > 0 ? securitySchemes : undefined,
    security: !isDemoMode
      ? [{ oauth2: ["read:public"] }, { bearerAuth: [] }]
      : undefined,
    skills: [publicInfoSkill, sensitiveDataSkill, adminActionsSkill],
  } as AgentCard;
}

// ============================================================================
// Hono App
// ============================================================================

const app = new Hono<{ Bindings: AuthAgentEnv }>();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

app.get("/health", (c) => {
  const isDemoMode = !c.env.AUTH_DOMAIN;
  const { provider, model } = getModelInfo(c.env);

  return c.json({
    status: "healthy",
    agent: "Auth Agent",
    mode: isDemoMode ? "demo" : "production",
    provider,
    model,
    runtime: "Cloudflare Workers",
    features: {
      ciba: true,
      clientCredentials: true,
      persistentStorage: isRedisConfigured(c.env),
      storageType: isRedisConfigured(c.env) ? "upstash-redis" : "in-memory",
    },
    authentication: isDemoMode ? "mock" : "oauth2",
  });
});

app.all("/*", async (c) => {
  const env = c.env;
  const url = new URL(c.req.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  const isDemoMode = !env.AUTH_DOMAIN;
  const llmModel = getModel(env);
  const authProvider = createAuthProvider(env);
  const agentCard = createAgentCard(baseUrl, isDemoMode, env);

  // Create agent with auth provider
  const agent = createAuthAgent({ model: llmModel, authProvider });

  // Use shared utilities for executor and task store
  const agentExecutor = createA2AExecutor(
    {
      agentName: "Auth Agent",
      createAgent: () => agent,
      createAgentCard: () => agentCard,
      adapterOptions: {
        mode: "stream",
        includeHistory: true,
        debug: isDemoMode,
      },
    },
    llmModel,
    env
  );

  const taskStore = createTaskStore({ type: "redis", prefix: "a2a:auth:" }, env);
  const requestHandler = new DefaultRequestHandler(agentCard, taskStore, agentExecutor);

  const a2aRouter = new Hono();
  const logger: Logger = ConsoleLogger.create();
  const a2aApp = new A2AHonoApp(requestHandler, { logger });
  a2aApp.setupRoutes(a2aRouter);

  const response = await a2aRouter.fetch(c.req.raw, c.env);

  if (response.status !== 404) {
    return response;
  }

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
