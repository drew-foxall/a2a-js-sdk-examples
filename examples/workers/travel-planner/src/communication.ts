/**
 * Travel Planner Worker - Agent Communication
 *
 * Worker-specific communication functions for calling specialist agents.
 * Uses Service Bindings when available, falls back to HTTP.
 *
 * NOTE: Uses non-streaming request/response pattern for agent-to-agent communication.
 * This matches the Python reference implementation (routing_agent.py lines 266-282).
 * The orchestrator needs the complete response to decide what to do next.
 */

import type { SendMessageFn } from "a2a-agents";
import { a2a } from "a2a-ai-provider";
import { generateText } from "ai";
import { z } from "zod";
import type { WorkerAgentRegistry } from "./registry.js";

/**
 * Zod schema for A2A JSON-RPC response parts
 */
const textPartSchema = z
  .object({
    text: z.string(),
  })
  .passthrough();

/**
 * Zod schema for A2A JSON-RPC response message
 */
const messageSchema = z
  .object({
    parts: z.array(textPartSchema).optional(),
  })
  .passthrough();

/**
 * Zod schema for A2A JSON-RPC response artifact
 */
const artifactSchema = z
  .object({
    parts: z.array(textPartSchema).optional(),
  })
  .passthrough();

/**
 * Zod schema for A2A JSON-RPC response task result
 */
const taskResultSchema = z
  .object({
    status: z
      .object({
        message: messageSchema.optional(),
      })
      .passthrough()
      .optional(),
    artifacts: z.array(artifactSchema).optional(),
  })
  .passthrough();

/**
 * Zod schema for A2A JSON-RPC response
 */
const a2aResponseSchema = z
  .object({
    result: taskResultSchema.optional(),
  })
  .passthrough();

/**
 * Extract text from a validated A2A response
 */
function extractTextFromResponse(response: z.infer<typeof a2aResponseSchema>): string {
  // Try status message first
  const statusParts = response.result?.status?.message?.parts;
  if (statusParts && statusParts.length > 0) {
    const statusText = statusParts.map((p) => p.text).join("\n");
    if (statusText) return statusText;
  }

  // Try artifacts
  const artifacts = response.result?.artifacts;
  if (artifacts && artifacts.length > 0) {
    const artifactText = artifacts
      .flatMap((a) => a.parts || [])
      .map((p) => p.text)
      .join("\n");
    if (artifactText) return artifactText;
  }

  return "No response from agent";
}

/**
 * Call agent via Cloudflare Service Binding (raw JSON-RPC)
 *
 * Service Bindings use Cloudflare's internal network for low-latency,
 * private communication between workers.
 */
async function callAgentViaBinding(binding: Fetcher, task: string): Promise<string> {
  // Build A2A JSON-RPC request
  const request = {
    jsonrpc: "2.0",
    method: "message/send",
    id: crypto.randomUUID(),
    params: {
      message: {
        role: "user",
        messageId: crypto.randomUUID(),
        parts: [{ kind: "text", text: task }],
      },
    },
  };

  // Service Bindings require a full URL but it's ignored - the binding routes internally
  const response = await binding.fetch("https://internal/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Service Binding call failed: ${response.status}`);
  }

  const data: unknown = await response.json();

  // Validate response with Zod
  const parseResult = a2aResponseSchema.safeParse(data);
  if (!parseResult.success) {
    return "Invalid response format from agent";
  }

  return extractTextFromResponse(parseResult.data);
}

/**
 * Call agent via HTTP using a2a-ai-provider
 *
 * This is the fallback when Service Bindings are not available.
 * Uses the same pattern as the local Node.js server.
 */
async function callAgentViaHttp(url: string, task: string): Promise<string> {
  // Use a2a-ai-provider to call the agent as an AI SDK model
  // generateText is correct here - we need the full response for tool execution
  const result = await generateText({
    model: a2a(url),
    prompt: task,
  });

  return result.text;
}

/**
 * Create a worker-specific sendMessage function
 *
 * Tries Service Binding first (if available), then falls back to HTTP.
 * This provides the best of both worlds:
 * - Low latency via Service Bindings in production
 * - HTTP fallback for local development or when bindings aren't configured
 */
export function createWorkerSendMessage(registry: WorkerAgentRegistry): SendMessageFn {
  return async (agentName, task, _options) => {
    const agent = registry.getAgent(agentName);
    if (!agent) {
      return `Error: Agent "${agentName}" not found. Available: ${registry.getAgentNames().join(", ")}`;
    }

    try {
      // Try Service Binding first (faster, private)
      if (agent.binding) {
        try {
          return await callAgentViaBinding(agent.binding, task);
        } catch (bindingError) {
          // Fall through to HTTP
          console.warn(`Service Binding failed for ${agentName}, trying HTTP:`, bindingError);
        }
      }

      // HTTP fallback
      return await callAgentViaHttp(agent.url, task);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return `Error communicating with ${agent.name}: ${errorMessage}`;
    }
  };
}
