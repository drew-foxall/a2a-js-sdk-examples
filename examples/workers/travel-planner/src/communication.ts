/**
 * Travel Planner Worker - Agent Communication
 *
 * Worker-specific communication functions for calling specialist agents.
 * Uses Service Bindings when available, falls back to HTTP with a2a-ai-provider-v3.
 *
 * V3 PROVIDER CAPABILITIES LEVERAGED:
 * - providerOptions.a2a for contextId/taskId continuity
 * - providerMetadata.a2a for rich response metadata
 * - inputRequired flag for multi-turn handling
 * - Artifact extraction from responses
 * - Task state mapping
 *
 * NOTE: Uses non-streaming request/response pattern for agent-to-agent communication.
 * This matches the Python reference implementation (routing_agent.py lines 266-282).
 * The orchestrator needs the complete response to decide what to do next.
 */

import type { A2aProviderMetadata } from "@drew-foxall/a2a-ai-provider-v3";
import { a2aV3, toJSONObject } from "@drew-foxall/a2a-ai-provider-v3";
import type {
  AgentArtifact,
  SendMessageFn,
  SendMessageOptions,
  SendMessageResult,
} from "a2a-agents";
import { generateText } from "ai";
import { z } from "zod";
import type { WorkerAgentRegistry } from "./registry.js";

// ============================================================================
// Zod Schemas for Service Binding Response Parsing
// ============================================================================

/**
 * Zod schema for A2A JSON-RPC response parts
 */
const textPartSchema = z
  .object({
    kind: z.string().optional(),
    text: z.string().optional(),
  })
  .catchall(z.unknown());

const filePartSchema = z
  .object({
    kind: z.literal("file"),
    file: z
      .object({
        name: z.string().optional(),
        mimeType: z.string().optional(),
        bytes: z.string().optional(),
        uri: z.string().optional(),
      })
      .optional(),
  })
  .catchall(z.unknown());

const dataPartSchema = z
  .object({
    kind: z.literal("data"),
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .catchall(z.unknown());

const partSchema = z.union([textPartSchema, filePartSchema, dataPartSchema]);

/**
 * Zod schema for A2A JSON-RPC response message
 */
const messageSchema = z
  .object({
    parts: z.array(partSchema).optional(),
  })
  .catchall(z.unknown());

/**
 * Zod schema for A2A JSON-RPC response artifact
 */
const artifactSchema = z
  .object({
    artifactId: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    parts: z.array(partSchema).optional(),
  })
  .catchall(z.unknown());

/**
 * Zod schema for A2A JSON-RPC response task status
 */
const statusSchema = z
  .object({
    state: z.string().optional(),
    message: messageSchema.optional(),
  })
  .catchall(z.unknown());

/**
 * Zod schema for A2A JSON-RPC response task result
 */
const taskResultSchema = z
  .object({
    id: z.string().optional(),
    contextId: z.string().optional(),
    status: statusSchema.optional(),
    artifacts: z.array(artifactSchema).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .catchall(z.unknown());

/**
 * Zod schema for A2A JSON-RPC response
 */
const a2aResponseSchema = z
  .object({
    result: taskResultSchema.optional(),
  })
  .catchall(z.unknown());

// ============================================================================
// Response Extraction Helpers
// ============================================================================

/**
 * Extract text from a validated A2A response
 */
function extractTextFromResponse(response: z.infer<typeof a2aResponseSchema>): string {
  // Try status message first
  const statusParts = response.result?.status?.message?.parts;
  if (statusParts && statusParts.length > 0) {
    const statusText = statusParts
      .filter((p) => p.kind === "text" || !p.kind)
      .map((p) => p.text ?? "")
      .filter(Boolean)
      .join("\n");
    if (statusText) return statusText;
  }

  // Try artifacts
  const artifacts = response.result?.artifacts;
  if (artifacts && artifacts.length > 0) {
    const artifactText = artifacts
      .flatMap((a) => a.parts || [])
      .filter((p) => p.kind === "text" || !p.kind)
      .map((p) => p.text ?? "")
      .filter(Boolean)
      .join("\n");
    if (artifactText) return artifactText;
  }

  return "No response from agent";
}

/**
 * Extract artifacts from A2A response
 */
function extractArtifactsFromResponse(
  response: z.infer<typeof a2aResponseSchema>
): AgentArtifact[] {
  const artifacts = response.result?.artifacts;
  if (!artifacts) return [];

  return artifacts.map((a) => ({
    artifactId: a.artifactId ?? "unknown",
    name: a.name ?? undefined,
    description: a.description ?? undefined,
    parts:
      a.parts?.map((p) => ({
        kind: (p.kind ?? "text") as "text" | "file" | "data",
        text: "text" in p && typeof p.text === "string" ? p.text : undefined,
        data: "data" in p ? (p.data as Record<string, unknown>) : undefined,
        file: "file" in p ? (p.file as AgentArtifact["parts"][0]["file"]) : undefined,
      })) ?? [],
  }));
}

/**
 * Build rich result from A2A JSON-RPC response
 */
function buildResultFromResponse(response: z.infer<typeof a2aResponseSchema>): SendMessageResult {
  const taskState = response.result?.status?.state;
  const inputRequired = taskState === "input-required";

  return {
    text: extractTextFromResponse(response),
    taskId: response.result?.id ?? undefined,
    contextId: response.result?.contextId ?? undefined,
    inputRequired,
    taskState: taskState ?? undefined,
    artifacts: extractArtifactsFromResponse(response),
    metadata: response.result?.metadata as Record<string, unknown> | undefined,
  };
}

// ============================================================================
// Service Binding Communication
// ============================================================================

/**
 * Call agent via Cloudflare Service Binding (raw JSON-RPC)
 *
 * Service Bindings use Cloudflare's internal network for low-latency,
 * private communication between workers.
 *
 * Enhanced to support V3 options (contextId, taskId, metadata)
 */
async function callAgentViaBinding(
  binding: Fetcher,
  task: string,
  options?: SendMessageOptions
): Promise<SendMessageResult> {
  // Build A2A JSON-RPC request with V3 options
  const request = {
    jsonrpc: "2.0",
    method: "message/send",
    id: crypto.randomUUID(),
    params: {
      message: {
        role: "user",
        messageId: crypto.randomUUID(),
        parts: [{ kind: "text", text: task }],
        // Include metadata if provided
        ...(options?.metadata && { metadata: options.metadata }),
      },
      // Include contextId/taskId for conversation continuity
      ...(options?.contextId && { contextId: options.contextId }),
      ...(options?.taskId && { taskId: options.taskId }),
    },
  };

  // Service Bindings require a full URL but it's ignored - the binding routes internally
  const response = await binding.fetch("https://internal/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    return {
      text: `Service Binding call failed: ${response.status}`,
      inputRequired: false,
      artifacts: [],
      taskState: "failed",
    };
  }

  const data: unknown = await response.json();

  // Validate response with Zod
  const parseResult = a2aResponseSchema.safeParse(data);
  if (!parseResult.success) {
    return {
      text: "Invalid response format from agent",
      inputRequired: false,
      artifacts: [],
      taskState: "failed",
    };
  }

  return buildResultFromResponse(parseResult.data);
}

// ============================================================================
// HTTP Communication with V3 Provider
// ============================================================================

/**
 * Extract artifacts from V3 provider metadata
 */
function extractArtifactsFromMetadata(metadata: A2aProviderMetadata | undefined): AgentArtifact[] {
  if (!metadata?.artifacts) return [];

  return metadata.artifacts.map((artifact) => ({
    artifactId: artifact.artifactId ?? "unknown",
    name: artifact.name ?? undefined,
    description: artifact.description ?? undefined,
    parts:
      artifact.parts?.map((part) => ({
        kind: part.kind as "text" | "file" | "data",
        text: part.text ?? undefined,
        data: part.data ?? undefined,
        file: part.file ?? undefined,
      })) ?? [],
  }));
}

/**
 * Call agent via HTTP using a2a-ai-provider-v3
 *
 * LEVERAGES V3 CAPABILITIES:
 * - providerOptions.a2a for contextId/taskId continuity
 * - providerMetadata.a2a for rich response metadata
 * - inputRequired flag for multi-turn handling
 * - Artifact extraction
 * - Task state mapping
 */
async function callAgentViaHttp(
  url: string,
  task: string,
  options?: SendMessageOptions
): Promise<SendMessageResult> {
  // Use a2a-ai-provider-v3 with full providerOptions support
  const result = await generateText({
    model: a2aV3(url),
    prompt: task,
    // V3 Provider Options for context continuity
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
    taskId: a2aMetadata?.taskId ?? undefined,
    contextId: a2aMetadata?.contextId ?? undefined,
    inputRequired: a2aMetadata?.inputRequired ?? false,
    taskState: a2aMetadata?.taskState ?? undefined,
    artifacts: extractArtifactsFromMetadata(a2aMetadata),
    metadata: a2aMetadata?.metadata ?? undefined,
  };
}

// ============================================================================
// Exported sendMessage Factory
// ============================================================================

/**
 * Create a worker-specific sendMessage function
 *
 * Tries Service Binding first (if available), then falls back to HTTP.
 * Both paths now return rich V3 metadata:
 * - Context continuity (taskId, contextId)
 * - Input-required detection
 * - Artifact access
 * - Task state
 */
export function createWorkerSendMessage(registry: WorkerAgentRegistry): SendMessageFn {
  return async (agentName, task, options): Promise<SendMessageResult> => {
    const agent = registry.getAgent(agentName);
    if (!agent) {
      return {
        text: `Error: Agent "${agentName}" not found. Available: ${registry.getAgentNames().join(", ")}`,
        inputRequired: false,
        artifacts: [],
      };
    }

    try {
      // Try Service Binding first (faster, private)
      if (agent.binding) {
        try {
          return await callAgentViaBinding(agent.binding, task, options);
        } catch (bindingError) {
          // Fall through to HTTP
          console.warn(`Service Binding failed for ${agentName}, trying HTTP:`, bindingError);
        }
      }

      // HTTP fallback with V3 provider
      return await callAgentViaHttp(agent.url, task, options);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        text: `Error communicating with ${agent.name}: ${errorMessage}`,
        inputRequired: false,
        artifacts: [],
        taskState: "failed",
      };
    }
  };
}
