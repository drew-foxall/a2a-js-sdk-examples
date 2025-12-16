/**
 * Auth Agent
 *
 * An AI agent that demonstrates CIBA (Client-Initiated Backchannel Authentication)
 * patterns for headless agent authorization.
 *
 * This agent can:
 * 1. Access resources requiring client credentials (agent-to-agent auth)
 * 2. Request user consent for sensitive operations via CIBA
 * 3. Wait durably for user approval (survives restarts)
 * 4. Access protected resources after consent
 *
 * Key Patterns Demonstrated:
 * - OAuth2 Client Credentials flow
 * - CIBA polling with durable sleep
 * - User consent for sensitive operations
 * - Token management
 */

import { type LanguageModel, ToolLoopAgent } from "ai";
import { z } from "zod";
import type { AuthProvider, ProtectedResource } from "./types.js";
import { completeCIBAFlow, getClientToken } from "./steps.js";

// ============================================================================
// Tool Schemas
// ============================================================================

const lookupPublicInfoSchema = z.object({
  resourceType: z
    .enum(["company_directory", "public_policies", "org_chart"])
    .describe("Type of public information to look up"),
  query: z.string().describe("Search query"),
});

const accessSensitiveDataSchema = z.object({
  resourceType: z
    .enum(["employee_data", "financial_data", "personal_info"])
    .describe("Type of sensitive data to access"),
  resourceId: z.string().describe("ID of the specific resource"),
  userEmail: z.string().email().describe("Email of the user to request consent from"),
  reason: z.string().describe("Reason for accessing the data (shown to user)"),
});

const performAdminActionSchema = z.object({
  action: z
    .enum(["grant_access", "revoke_access", "modify_permissions", "delete_record"])
    .describe("Administrative action to perform"),
  targetId: z.string().describe("ID of the target entity"),
  userEmail: z.string().email().describe("Email of the admin user to authorize"),
  justification: z.string().describe("Justification for the action"),
});

// ============================================================================
// Agent Configuration
// ============================================================================

export interface AuthAgentConfig {
  /** Language model to use */
  model: LanguageModel;
  /** Auth provider for OAuth2/CIBA operations */
  authProvider: AuthProvider;
  /** Optional: Mock data fetcher for resources */
  resourceFetcher?: (resourceId: string, token: string) => Promise<unknown>;
}

// ============================================================================
// Agent Factory
// ============================================================================

/**
 * Create an Auth Agent
 *
 * This agent demonstrates enterprise authentication patterns:
 * - Client credentials for agent-to-agent auth
 * - CIBA for user consent on sensitive operations
 * - Durable polling that survives restarts
 *
 * @param config - Agent configuration including auth provider
 * @returns Configured ToolLoopAgent
 */
export function createAuthAgent(config: AuthAgentConfig) {
  const { model, authProvider, resourceFetcher = defaultResourceFetcher } = config;

  return new ToolLoopAgent({
    model,
    instructions: getAuthAgentPrompt(),
    tools: {
      /**
       * Look up public information (no user consent needed)
       * Uses client credentials for API access
       */
      lookupPublicInfo: {
        description:
          "Look up public company information that doesn't require user consent. " +
          "This includes company directory, public policies, and organizational structure.",
        inputSchema: lookupPublicInfoSchema,
        execute: async (params) => {
          try {
            // Get token via client credentials (agent-to-agent auth)
            const token = await getClientToken(authProvider, "read:public");

            // Simulate fetching public data
            const data = await resourceFetcher(`public/${params.resourceType}/${params.query}`, token.access_token);

            return {
              success: true,
              resourceType: params.resourceType,
              query: params.query,
              data,
              authMethod: "client_credentials",
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : "Failed to fetch public info",
            };
          }
        },
      },

      /**
       * Access sensitive data (requires user consent via CIBA)
       * Demonstrates the full CIBA polling flow
       */
      accessSensitiveData: {
        description:
          "Access sensitive employee, financial, or personal data. " +
          "This REQUIRES user consent via push notification approval. " +
          "The user will receive a notification and must approve the request.",
        inputSchema: accessSensitiveDataSchema,
        execute: async (params) => {
          const resource: ProtectedResource = {
            type: params.resourceType as ProtectedResource["type"],
            id: params.resourceId,
            requiredScope: `read:${params.resourceType}`,
            description: params.reason,
          };

          try {
            console.log(`[AuthAgent] Requesting consent from ${params.userEmail} for ${resource.type}`);

            // Initiate CIBA and wait for approval (durable polling)
            const cibaResult = await completeCIBAFlow(
              authProvider,
              {
                login_hint: params.userEmail,
                scope: resource.requiredScope,
                binding_message: `${resource.description} - ${resource.type}/${resource.id}`,
              },
              120 // Wait up to 2 minutes
            );

            if (cibaResult.status !== "approved" || !cibaResult.token) {
              return {
                success: false,
                consentRequired: true,
                consentStatus: cibaResult.status,
                error: cibaResult.error ?? `User consent ${cibaResult.status}`,
              };
            }

            console.log("[AuthAgent] Consent granted, accessing resource");

            // Access the protected resource with the user-authorized token
            const data = await resourceFetcher(
              `sensitive/${params.resourceType}/${params.resourceId}`,
              cibaResult.token.access_token
            );

            return {
              success: true,
              resourceType: params.resourceType,
              resourceId: params.resourceId,
              data,
              authMethod: "ciba",
              consentRequired: true,
              consentStatus: "approved",
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : "Failed to access sensitive data",
            };
          }
        },
      },

      /**
       * Perform administrative action (requires elevated consent)
       */
      performAdminAction: {
        description:
          "Perform an administrative action like granting access, revoking permissions, or modifying records. " +
          "This REQUIRES admin user consent via push notification. " +
          "The action and justification will be shown to the admin for approval.",
        inputSchema: performAdminActionSchema,
        execute: async (params) => {
          const resource: ProtectedResource = {
            type: "admin_action",
            id: `${params.action}:${params.targetId}`,
            requiredScope: `admin:${params.action}`,
            description: params.justification,
          };

          try {
            console.log(`[AuthAgent] Requesting admin consent from ${params.userEmail}`);

            // Initiate CIBA with admin scope
            const cibaResult = await completeCIBAFlow(
              authProvider,
              {
                login_hint: params.userEmail,
                scope: resource.requiredScope,
                binding_message: `Admin action: ${params.action} on ${params.targetId}\n\nJustification: ${params.justification}`,
              },
              180 // Admin actions get 3 minutes
            );

            if (cibaResult.status !== "approved" || !cibaResult.token) {
              return {
                success: false,
                action: params.action,
                targetId: params.targetId,
                consentRequired: true,
                consentStatus: cibaResult.status,
                error: cibaResult.error ?? `Admin consent ${cibaResult.status}`,
              };
            }

            console.log("[AuthAgent] Admin consent granted, performing action");

            // Perform the admin action
            // In a real system, this would call an admin API
            const result = {
              action: params.action,
              targetId: params.targetId,
              performedBy: params.userEmail,
              timestamp: new Date().toISOString(),
              status: "completed",
            };

            return {
              success: true,
              ...result,
              authMethod: "ciba",
              consentRequired: true,
              consentStatus: "approved",
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : "Failed to perform admin action",
            };
          }
        },
      },
    },
  });
}

// ============================================================================
// Prompt
// ============================================================================

function getAuthAgentPrompt(): string {
  return `You are an HR Assistant with access to company information systems.

YOUR CAPABILITIES:
1. **Public Information** (no consent needed):
   - Company directory
   - Public policies
   - Organizational structure
   
2. **Sensitive Data** (requires user consent):
   - Employee personal data
   - Financial records
   - Performance reviews
   
3. **Admin Actions** (requires admin consent):
   - Access grants
   - Permission changes
   - Record modifications

AUTHENTICATION:
- Public info: Automatically authorized via system credentials
- Sensitive data: User receives push notification for approval
- Admin actions: Admin receives push notification for approval

BEHAVIOR:
1. For public queries, proceed immediately
2. For sensitive data, explain that the user will receive a push notification
3. For admin actions, explain the authorization requirement and wait for approval
4. Always explain what consent is being requested and why

EXAMPLES:
User: "Who is in the engineering department?"
→ Use lookupPublicInfo (no consent needed)

User: "What is John's salary?"
→ Use accessSensitiveData (John needs to approve)

User: "Grant Alice access to the finance dashboard"
→ Use performAdminAction (admin needs to approve)

Be helpful and transparent about the authorization process!`;
}

// ============================================================================
// Default Resource Fetcher
// ============================================================================

async function defaultResourceFetcher(resourcePath: string, _token: string): Promise<unknown> {
  // Mock data for demonstration
  const [category, type, id] = resourcePath.split("/");

  if (category === "public") {
    return getMockPublicData(type, id);
  }

  if (category === "sensitive") {
    return getMockSensitiveData(type, id);
  }

  return { error: "Unknown resource type" };
}

function getMockPublicData(type: string, query: string): unknown {
  switch (type) {
    case "company_directory":
      return {
        results: [
          { name: "John Doe", department: "Engineering", email: "john@company.com" },
          { name: "Jane Smith", department: "Engineering", email: "jane@company.com" },
        ].filter((e) => e.name.toLowerCase().includes(query.toLowerCase())),
      };
    case "public_policies":
      return {
        policies: [
          { title: "Remote Work Policy", lastUpdated: "2024-01-15" },
          { title: "Code of Conduct", lastUpdated: "2024-03-01" },
        ],
      };
    case "org_chart":
      return {
        departments: ["Engineering", "Sales", "HR", "Finance"],
        headcount: 150,
      };
    default:
      return { message: `No data for type: ${type}` };
  }
}

function getMockSensitiveData(type: string, id: string): unknown {
  switch (type) {
    case "employee_data":
      return {
        id,
        name: "John Doe",
        ssn: "***-**-1234",
        salary: 125000,
        startDate: "2021-03-15",
        manager: "Jane Smith",
      };
    case "financial_data":
      return {
        id,
        accountBalance: 50000,
        recentTransactions: [
          { date: "2024-12-01", amount: -1500, description: "Office supplies" },
          { date: "2024-12-10", amount: -3200, description: "Travel expenses" },
        ],
      };
    case "personal_info":
      return {
        id,
        address: "123 Main St, City, ST 12345",
        phone: "555-123-4567",
        emergencyContact: "Jane Doe (spouse)",
      };
    default:
      return { message: `No data for type: ${type}` };
  }
}

