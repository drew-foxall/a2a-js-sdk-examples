# Auth Agent - CIBA Authentication Patterns

This agent demonstrates enterprise authentication patterns for headless A2A agents:

- **OAuth2 Client Credentials** - Agent-to-agent authentication
- **CIBA (Client-Initiated Backchannel Authentication)** - User consent via push notification
- **Durable Polling** - Waiting for user approval survives worker restarts

## 🎯 What is CIBA?

CIBA (Client-Initiated Backchannel Authentication) is an OAuth2 extension that allows headless agents to request user authorization:

1. Agent needs to access sensitive data
2. Agent initiates CIBA request with user's email
3. User receives push notification on their device
4. User approves or denies the request
5. Agent receives access token (or denial)

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  A2A Client │────►│   Auth Agent    │────►│   OAuth2/CIBA   │
│             │◄────│                 │◄────│   (Auth0/Okta)  │
└─────────────┘     └─────────────────┘     └────────┬────────┘
                                                     │
                           ┌─────────────────────────┼─────────────────────────┐
                           │                         │                         │
                      ┌────▼────┐              ┌─────▼─────┐             ┌─────▼─────┐
                      │  Push   │              │   User    │             │ Protected │
                      │  Notif  │◄─────────────│  Approves │             │    API    │
                      └─────────┘              └───────────┘             └───────────┘
```

## 🚀 Quick Start

### Demo Mode (No Auth Provider Required)

```bash
# Start the agent locally
cd examples/workers/auth-agent
pnpm install
pnpm dev
```

In demo mode:
- Authentication is simulated
- Approvals happen automatically after ~5 seconds
- Perfect for testing the flow

### Test with A2A Inspector

1. Start the inspector: `pnpm inspector` (from repo root)
2. Connect to `http://localhost:8787`
3. Try these prompts:
   - "Who is in the engineering department?" → Public data (instant)
   - "What is John's salary?" → Sensitive data (waits for approval)
   - "Grant Alice access to finance" → Admin action (waits for admin approval)

## 📝 Example Interactions

### Public Information (No Consent)

```
User: "Who is in the engineering department?"

Agent: Here are the engineering team members:
- John Doe (john@company.com)
- Jane Smith (jane@company.com)
```

### Sensitive Data (User Consent Required)

```
User: "What is John's salary?"

Agent: I need to request John's consent to access his salary information.
Sending a push notification to john@company.com...

[5 seconds later - auto-approved in demo mode]

Agent: John approved the request. Here's the information:
- Name: John Doe
- Salary: $125,000
- Start Date: 2021-03-15
```

### Admin Action (Admin Consent Required)

```
User: "Grant Alice access to the finance dashboard"

Agent: This requires admin approval. Sending a request to the admin team...

[User receives push notification, approves]

Agent: The admin approved the request:
- Action: grant_access
- Target: Alice
- Performed by: admin@company.com
- Status: completed
```

## 🔐 Production Setup

### 1. Configure OAuth2 Provider

Set these secrets for your OAuth2 provider (Auth0, Okta, etc.):

```bash
wrangler secret put AUTH_DOMAIN      # e.g., your-tenant.auth0.com
wrangler secret put AUTH_CLIENT_ID   # OAuth2 client ID
wrangler secret put AUTH_CLIENT_SECRET  # OAuth2 client secret
wrangler secret put AUTH_AUDIENCE    # API identifier
```

### 2. Configure Redis (Optional but Recommended)

For persistent task state:

```bash
wrangler secret put UPSTASH_REDIS_REST_URL
wrangler secret put UPSTASH_REDIS_REST_TOKEN
```

### 3. Deploy

```bash
pnpm deploy
```

## 🏗️ Architecture

### Components

| Component | Purpose |
|-----------|---------|
| `AuthProvider` | Abstract interface for OAuth2/CIBA operations |
| `MockAuthProvider` | Simulated auth for development |
| Durable Steps | Polling survives worker restarts |
| Redis Task Store | Persistent conversation state |

### A2A Protocol Security Schemes

The Agent Card declares security schemes following [A2A Protocol Specification Section 4.5](https://a2a-protocol.org/latest/specification/#45-security-objects):

| Scheme | Spec Section | Purpose |
|--------|--------------|---------|
| `OAuth2SecurityScheme` | 4.5.4 | OAuth2 with Client Credentials flow |
| `HTTPAuthSecurityScheme` | 4.5.3 | Bearer token authentication |
| `OpenIdConnectSecurityScheme` | 4.5.5 | OIDC with CIBA support |

**Agent Card Example (Production Mode):**

```json
{
  "securitySchemes": {
    "oauth2": {
      "type": "oauth2",
      "description": "OAuth2 authentication for agent-to-agent communication",
      "flows": {
        "clientCredentials": {
          "tokenUrl": "https://your-tenant.auth0.com/oauth/token",
          "scopes": {
            "read:public": "Access public company information",
            "read:employee": "Access employee data (requires user consent)",
            "admin:access": "Perform administrative actions"
          }
        }
      }
    },
    "bearerAuth": {
      "type": "http",
      "scheme": "bearer",
      "bearerFormat": "JWT"
    },
    "openIdConnect": {
      "type": "openIdConnect",
      "openIdConnectUrl": "https://your-tenant.auth0.com/.well-known/openid-configuration"
    }
  },
  "security": [
    { "oauth2": ["read:public"] },
    { "bearerAuth": [] }
  ]
}
```

### Auth Provider Interface

The agent uses a pluggable auth provider interface:

```typescript
interface AuthProvider {
  // Agent-to-agent authentication
  getClientCredentialsToken(scope?: string): Promise<TokenResponse>;
  
  // Initiate user consent flow
  initiateCIBA(request: CIBARequest): Promise<CIBAResponse>;
  
  // Poll for user approval
  pollCIBA(authReqId: string): Promise<CIBAPollResult>;
  
  // Verify incoming tokens
  verifyToken(token: string): Promise<TokenClaims>;
}
```

### Durable Polling Pattern

The CIBA polling uses durable steps:

```typescript
// This survives worker restarts!
export async function completeCIBAFlow(provider, request) {
  "use step";
  
  // Step 1: Initiate CIBA (cached on restart)
  const cibaResponse = await initiateCIBA(provider, request);
  
  // Step 2: Poll with durable sleep
  while (true) {
    const result = await pollCIBAOnce(provider, cibaResponse.auth_req_id);
    
    if (result.status !== "pending") {
      return result;
    }
    
    // Durable sleep - doesn't hold compute
    await durableSleep(5);
  }
}
```

## 🧪 Testing

### Manual Testing

```bash
# Health check
curl http://localhost:8787/health

# Get agent card
curl http://localhost:8787/.well-known/agent-card.json

# Send message
curl -X POST http://localhost:8787/message/send \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "id": "1",
    "params": {
      "message": {
        "role": "user",
        "messageId": "m1",
        "parts": [{"kind": "text", "text": "Who is in engineering?"}]
      }
    }
  }'
```

## 🤝 Auth0 + Google Cloud Partnership

Auth0 has [partnered with Google Cloud](https://auth0.com/blog/auth0-google-a2a/) to define A2A authentication specs. Our implementation aligns with their approach:

> "We are working with Google Cloud to define A2A auth specs based on secure standards... This will include how to integrate A2A with Auth0 and our new product Auth0 for AI Agents."

Key authentication patterns they recommend:

1. **Client Credentials** - For agent-to-agent (M2M) communication
2. **CIBA** - For headless agents that need user consent without a UI
3. **Fine-grained Authorization** - Scoped tokens with minimal permissions

Their example Agent Card uses the same security scheme structure we've implemented:

```python
# From Auth0's A2A sample
securitySchemes={
    'oauth2_m2m_client': OAuth2SecurityScheme(
        flows=OAuthFlows(
            clientCredentials=ClientCredentialsOAuthFlow(
                tokenUrl='https://your-tenant.auth0.com/oauth/token',
                scopes={
                    'read:employee_status': 'Allows confirming whether a person is an active employee.',
                },
            ),
        ),
    ),
},
```

## 📚 Related

- [Auth0 + Google Cloud A2A Partnership](https://auth0.com/blog/auth0-google-a2a/) - Official announcement
- [A2A Protocol Security Specification](https://a2a-protocol.org/latest/specification/#45-security-objects) - Section 4.5
- [Python Reference: Headless Agent Auth](../../docs/python-examples-reference/18-headless-agent-auth.md)
- [OAuth2 CIBA Specification](https://openid.net/specs/openid-client-initiated-backchannel-authentication-core-1_0.html)
- [Auth0 CIBA Guide](https://auth0.com/docs/authenticate/login/oidc-conformant-authentication/oidc-adoption-ciba)
- [Auth0 for AI Agents](https://auth0.com/ai) - Auth0's AI agent identity product

