/**
 * Travel Planner - Durable Steps
 *
 * Wrappers around sub-agent calls that add durability via Workflow DevKit.
 * These steps:
 * - Automatically retry on network/API failures
 * - Cache results if workflow restarts
 * - Provide observability via traces
 *
 * The travel planner orchestrates multiple agents, making durability
 * particularly valuable for:
 * - Long-running multi-step travel planning
 * - Expensive API calls (weather, accommodation search)
 * - Complex coordination that shouldn't restart from scratch
 */

import type { SendMessageOptions, SendMessageResult } from "./agent.js";

/**
 * Configuration for sub-agent communication
 */
export interface SubAgentConfig {
  /** URL of the sub-agent */
  url: string;
  /** Optional auth token */
  authToken?: string;
}

/**
 * Durable step: Call a sub-agent
 *
 * Wraps the A2A sendMessage call with Workflow DevKit durability.
 * If the workflow is interrupted and restarted, this step will
 * return the cached result instead of re-calling the sub-agent.
 *
 * This is particularly valuable because:
 * - Weather API calls may be rate-limited
 * - Accommodation searches can take several seconds
 * - Multi-agent coordination shouldn't restart from scratch
 *
 * @param agentUrl - URL of the sub-agent
 * @param task - The task description to send
 * @param options - SendMessage options (contextId, taskId, etc.)
 * @returns The rich result from the sub-agent
 */
export async function callSubAgent(
  agentUrl: string,
  task: string,
  options?: SendMessageOptions
): Promise<SendMessageResult> {
  "use step";

  // Import dynamically to avoid bundling issues
  const { generateText } = await import("ai");
  const { a2aV3, toJSONObject } = await import("@drew-foxall/a2a-ai-provider-v3");
  type A2aProviderMetadata = import("@drew-foxall/a2a-ai-provider-v3").A2aProviderMetadata;

  try {
    const result = await generateText({
      model: a2aV3(agentUrl),
      prompt: task,
      providerOptions: {
        a2a: {
          contextId: options?.contextId,
          taskId: options?.taskId,
          metadata: options?.metadata ? toJSONObject(options.metadata) : undefined,
        },
      },
    });

    // Extract V3 provider metadata
    const a2aMetadata = result.providerMetadata?.a2a as A2aProviderMetadata | undefined;

    // Build rich result with all V3 metadata
    return {
      text: result.text,
      taskId: (a2aMetadata as Record<string, unknown> | undefined)?.taskId as string | undefined,
      contextId: (a2aMetadata as Record<string, unknown> | undefined)?.contextId as
        | string
        | undefined,
      inputRequired:
        ((a2aMetadata as Record<string, unknown> | undefined)?.inputRequired as
          | boolean
          | undefined) ?? false,
      taskState: (a2aMetadata as Record<string, unknown> | undefined)?.taskState as
        | string
        | undefined,
      artifacts: extractArtifacts(a2aMetadata),
      metadata: (a2aMetadata as Record<string, unknown> | undefined)?.metadata as
        | Record<string, unknown>
        | undefined,
    };
  } catch (error) {
    // Return error result instead of throwing
    return {
      text: `Error calling agent at ${agentUrl}: ${error instanceof Error ? error.message : "Unknown error"}`,
      inputRequired: false,
      artifacts: [],
    };
  }
}

/**
 * Extract artifacts from V3 provider metadata
 */
function extractArtifacts(metadata: unknown): SendMessageResult["artifacts"] {
  if (!metadata || typeof metadata !== "object") return [];

  const a2aMeta = metadata as Record<string, unknown>;
  const artifacts = a2aMeta.artifacts;

  if (!Array.isArray(artifacts)) return [];

  return artifacts.map((artifact: unknown) => {
    const a = artifact as Record<string, unknown>;
    return {
      artifactId: (a.artifactId as string) ?? "",
      name: a.name as string | undefined,
      description: a.description as string | undefined,
      parts: Array.isArray(a.parts)
        ? a.parts.map((p: unknown) => {
            const part = p as Record<string, unknown>;
            return {
              kind: (part.kind as "text" | "file" | "data") ?? "text",
              text: part.text as string | undefined,
              data: part.data as Record<string, unknown> | undefined,
              file: part.file as
                | {
                    name?: string;
                    mimeType?: string;
                    bytes?: string;
                    uri?: string;
                  }
                | undefined,
            };
          })
        : [],
    };
  });
}

/**
 * Durable step: Discover an agent and get its capabilities
 *
 * Wraps the agent discovery call with Workflow DevKit durability.
 * Agent cards change infrequently, so caching is highly beneficial.
 *
 * @param url - Base URL of the agent to discover
 * @returns Agent card information
 */
export async function discoverSubAgent(url: string): Promise<{
  success: boolean;
  name?: string;
  description?: string;
  url?: string;
  supportsStreaming?: boolean;
  skills?: Array<{ id: string; name: string }>;
  error?: string;
}> {
  "use step";

  const { discoverAgent, supportsCapability } = await import("@drew-foxall/a2a-ai-provider-v3");

  try {
    const { agentUrl, agentCard } = await discoverAgent(url);

    return {
      success: true,
      name: agentCard.name,
      description: agentCard.description ?? `Agent at ${url}`,
      url: agentUrl,
      supportsStreaming: supportsCapability(agentCard, "streaming"),
      skills: agentCard.skills?.map((s) => ({ id: s.id, name: s.name })),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Discovery failed",
    };
  }
}
