/**
 * Response Type Routing Utilities
 *
 * Helpers for implementing agent-owned routing (AI SDK "Routing" pattern)
 * to decide whether to respond with A2A Message or Task.
 *
 * @module
 */

import type { Message, Task } from "@drew-foxall/a2a-js-sdk";
import type { LanguageModel } from "ai";
import { generateObject } from "ai";
import { z } from "zod";
import type { ResponseTypeSelectionContext } from "./adapter.js";

/**
 * A2A response type: "message" for stateless, "task" for stateful
 */
export type A2AResponseType = "message" | "task";

/**
 * Function signature for selectResponseType hook
 */
export type SelectResponseType = (
  context: ResponseTypeSelectionContext
) => A2AResponseType | Promise<A2AResponseType>;

/**
 * Options for createLLMResponseTypeRouter
 */
export interface LLMResponseTypeRouterOptions {
  /**
   * The language model to use for classification.
   * Recommend using a small/fast model for low latency.
   */
  model: LanguageModel;

  /**
   * Custom prompt builder for the classification.
   * If not provided, uses a default prompt.
   *
   * @param context - Contains userText and existingTask
   * @returns The prompt string for the LLM
   */
  buildPrompt?: (context: { userText: string; existingTask?: Task }) => string;

  /**
   * Default response type if classification fails.
   * @default "task"
   */
  fallback?: A2AResponseType;
}

/**
 * Extract text content from an A2A Message.
 *
 * @param message - The A2A message to extract text from
 * @returns Concatenated text from all TextParts
 */
export function extractTextFromA2AMessage(message: Message): string {
  return message.parts
    .filter((part): part is Extract<typeof part, { kind: "text" }> => part.kind === "text")
    .map((part) => ("text" in part ? part.text : ""))
    .join("\n");
}

/**
 * Check if this is a task continuation (existing task present).
 *
 * @param context - The response type selection context
 * @returns true if existingTask is defined
 */
export function isTaskContinuation(context: ResponseTypeSelectionContext): boolean {
  return context.existingTask !== undefined;
}

/**
 * Higher-order function: prefer "task" for continuations.
 *
 * Wraps a selectResponseType function to always return "task"
 * when there's an existing task (continuation scenario).
 *
 * @param selectFn - The inner selectResponseType function
 * @returns Wrapped function that prefers task for continuations
 *
 * @example
 * ```typescript
 * selectResponseType: preferTaskForContinuations(({ userMessage }) => {
 *   // Your routing logic here - only called for new requests
 *   return userMessage.parts.length > 3 ? "task" : "message";
 * })
 * ```
 */
export function preferTaskForContinuations(selectFn: SelectResponseType): SelectResponseType {
  return async (context) => {
    if (isTaskContinuation(context)) {
      return "task";
    }
    return selectFn(context);
  };
}

/**
 * Simple routing: always "message" unless it's a continuation.
 *
 * Use this for simple agents that don't need task lifecycle
 * tracking for new requests, but should continue tasks properly.
 *
 * @param context - The response type selection context
 * @returns "task" for continuations, "message" otherwise
 *
 * @example
 * ```typescript
 * selectResponseType: messageUnlessContinuation
 * ```
 */
export function messageUnlessContinuation(context: ResponseTypeSelectionContext): A2AResponseType {
  return isTaskContinuation(context) ? "task" : "message";
}

/**
 * Default prompt for LLM-based routing.
 */
function buildDefaultPrompt(context: { userText: string; existingTask?: Task }): string {
  if (context.existingTask) {
    return [
      "This is a continuation of an existing A2A Task.",
      'You should return responseType = "task" to continue the task lifecycle.',
      "",
      "User request:",
      context.userText,
    ].join("\n");
  }

  return [
    "You are classifying an A2A (Agent-to-Agent) request to determine the response type.",
    "",
    "A2A supports two response types:",
    '- "message": Stateless, immediate response. Use for simple queries, greetings, quick Q&A.',
    '- "task": Stateful, tracked operation. Use for multi-step workflows, long-running operations, tool usage.',
    "",
    "Guidelines:",
    '- Short greetings like "hi", "hello" → "message"',
    '- Simple questions with immediate answers → "message"',
    '- Requests involving tools, APIs, or external data → "task"',
    '- Multi-step or complex operations → "task"',
    '- Requests that may need progress tracking → "task"',
    "",
    "User request:",
    context.userText,
  ].join("\n");
}

/**
 * Schema for LLM response type classification
 */
const responseTypeSchema = z.object({
  responseType: z
    .enum(["message", "task"])
    .describe(
      'The response type: "message" for immediate stateless response, "task" for stateful tracked operation'
    ),
  reasoningText: z.string().optional().describe("Brief reasoning for the classification"),
});

/**
 * Create an LLM-based response type router.
 *
 * Uses a language model to classify requests and determine whether
 * to respond with a stateless Message or stateful Task.
 *
 * This implements the AI SDK "Routing" pattern for agent-owned routing.
 *
 * @param options - Router configuration
 * @returns A selectResponseType function
 *
 * @example Basic usage
 * ```typescript
 * import { createLLMResponseTypeRouter } from "@drew-foxall/a2a-ai-sdk-adapter";
 *
 * const adapter = new A2AAdapter(agent, {
 *   mode: "stream",
 *   selectResponseType: createLLMResponseTypeRouter({
 *     model: openai("gpt-4o-mini"), // Use a fast model
 *   }),
 * });
 * ```
 *
 * @example With custom prompt
 * ```typescript
 * selectResponseType: createLLMResponseTypeRouter({
 *   model,
 *   buildPrompt: ({ userText, existingTask }) => {
 *     if (existingTask) return 'Return "task" for continuations.';
 *     return `Classify this GitHub request: ${userText}`;
 *   },
 * })
 * ```
 */
export function createLLMResponseTypeRouter(
  options: LLMResponseTypeRouterOptions
): SelectResponseType {
  const { model, buildPrompt = buildDefaultPrompt, fallback = "task" } = options;

  return async (context: ResponseTypeSelectionContext): Promise<A2AResponseType> => {
    // Fast path: always use task for continuations
    if (isTaskContinuation(context)) {
      return "task";
    }

    const userText = extractTextFromA2AMessage(context.userMessage);

    if (!userText.trim()) {
      // Empty message - use fallback
      return fallback;
    }

    try {
      const prompt = buildPrompt({ userText, existingTask: context.existingTask });

      const result = await generateObject({
        model,
        schema: responseTypeSchema,
        prompt,
      });

      return result.object.responseType;
    } catch {
      // On error, fall back to default (task is safer - has full lifecycle)
      return fallback;
    }
  };
}
