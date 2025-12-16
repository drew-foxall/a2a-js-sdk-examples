/**
 * A2A V3 Provider Factory
 *
 * Creates AI SDK `LanguageModelV3` instances that communicate with A2A protocol agents.
 *
 * ## Architecture
 *
 * The provider follows the AI SDK provider pattern:
 * 1. `createA2aV3()` creates a provider factory
 * 2. The factory creates `A2aV3LanguageModel` instances per agent URL
 * 3. Each model instance handles communication with one A2A agent
 *
 * ## A2A Concepts Mapped to AI SDK
 *
 * | A2A Concept | AI SDK Equivalent | Notes |
 * |-------------|-------------------|-------|
 * | Agent URL | `modelId` | The A2A agent endpoint |
 * | contextId | Settings/providerOptions | Groups related tasks |
 * | taskId | providerOptions | Resumes existing tasks |
 * | Message | Prompt message | Single communication turn |
 * | Task state | finishReason + metadata | completed → "stop", input-required → "stop" + flag |
 *
 * @module
 */

import type { ProviderV3 } from "@ai-sdk/provider";
import type { IdGenerator } from "@ai-sdk/provider-utils";
import { A2aV3LanguageModel } from "./model.js";

/**
 * Settings for configuring an A2A language model instance.
 *
 * These settings are applied at the model level and affect all requests
 * made through that model instance. For per-request configuration,
 * use `providerOptions.a2a` in `generateText()`/`streamText()` calls.
 *
 * ## A2A Protocol Context
 *
 * In A2A, a `contextId` groups related tasks into a conversation. The server
 * generates this ID, but you can pass it to continue an existing conversation.
 *
 * A `taskId` identifies a specific task within a context. Use this to send
 * follow-up messages to an `input-required` task.
 *
 * @example
 * ```typescript
 * // Continue an existing conversation
 * const model = a2aV3('http://localhost:3001', {
 *   contextId: 'ctx_abc123',  // From previous response
 * });
 *
 * // Resume a specific task that needs input
 * const model = a2aV3('http://localhost:3001', {
 *   contextId: 'ctx_abc123',
 *   taskId: 'task_xyz789',    // From input-required response
 * });
 * ```
 */
export type A2aV3ChatSettings = {
  /**
   * Context ID for conversation continuity.
   *
   * A2A servers generate this to group related tasks. Pass a previous
   * response's `contextId` to continue that conversation. If not provided,
   * the server creates a new context.
   *
   * @see https://a2a-protocol.org/latest/topics/key-concepts/#other-important-concepts
   */
  contextId?: string;

  /**
   * Task ID for resuming an existing task.
   *
   * Use this when responding to an `input-required` task state. The server
   * will route your message to the existing task instead of creating a new one.
   *
   * @see https://a2a-protocol.org/latest/topics/life-of-a-task/
   */
  taskId?: string;
};

/**
 * A2A V3 Provider interface.
 *
 * Extends AI SDK's `ProviderV3` to create A2A language models. The provider
 * is callable directly or via the `languageModel` method.
 *
 * @example
 * ```typescript
 * const provider = createA2aV3();
 *
 * // Direct call (shorthand)
 * const model1 = provider('http://localhost:3001');
 *
 * // Via languageModel method (AI SDK standard)
 * const model2 = provider.languageModel('http://localhost:3001');
 * ```
 */
export interface A2aV3Provider extends ProviderV3 {
  /**
   * Create a language model for an A2A agent.
   *
   * The `agentUrl` becomes the model's `modelId` and is used to send
   * A2A protocol messages via JSON-RPC over HTTP.
   *
   * @param agentUrl - The A2A agent's HTTP endpoint (e.g., 'http://localhost:3001')
   * @param settings - Optional conversation/task settings
   * @returns A `LanguageModelV3` instance for use with AI SDK functions
   */
  (agentUrl: string, settings?: A2aV3ChatSettings): A2aV3LanguageModel;

  /**
   * Create a language model for an A2A agent (AI SDK standard method).
   *
   * Equivalent to calling the provider directly. Provided for compatibility
   * with AI SDK patterns that expect a `languageModel` method.
   *
   * @param agentUrl - The A2A agent's HTTP endpoint
   * @param settings - Optional conversation/task settings
   * @returns A `LanguageModelV3` instance for use with AI SDK functions
   */
  languageModel(agentUrl: string, settings?: A2aV3ChatSettings): A2aV3LanguageModel;
}

/**
 * Settings for creating an A2A V3 provider factory.
 *
 * These settings affect all models created by the provider.
 *
 * @example
 * ```typescript
 * // Custom ID generator for deterministic testing
 * let counter = 0;
 * const provider = createA2aV3({
 *   generateId: () => `msg_${++counter}`,
 * });
 * ```
 */
export interface A2aV3ProviderSettings {
  /**
   * Custom ID generator for A2A message IDs.
   *
   * A2A messages require unique `messageId` values. By default, UUID v4 is used.
   * Override this for deterministic testing or custom ID schemes.
   *
   * @default generateId from @ai-sdk/provider-utils (UUID v4)
   */
  generateId?: IdGenerator;
}

/**
 * Create an A2A V3 provider factory.
 *
 * The provider creates `LanguageModelV3` instances that communicate with
 * A2A protocol agents. Each model instance is bound to a specific agent URL.
 *
 * ## Usage with AI SDK
 *
 * ```typescript
 * import { createA2aV3 } from '@drew-foxall/a2a-ai-provider-v3';
 * import { generateText, streamText } from 'ai';
 *
 * const provider = createA2aV3();
 * const model = provider('http://travel-agent.example.com');
 *
 * // Non-streaming
 * const result = await generateText({ model, prompt: 'Plan a trip' });
 *
 * // Streaming
 * const stream = await streamText({ model, prompt: 'Plan a trip' });
 * for await (const chunk of stream.textStream) {
 *   console.log(chunk);
 * }
 * ```
 *
 * ## A2A Protocol Flow
 *
 * 1. AI SDK calls `model.doGenerate()` or `model.doStream()`
 * 2. Provider converts prompt to A2A `Message` format
 * 3. Message sent to agent via `ClientFactory.sendMessage()`
 * 4. A2A response (Task or Message) converted to AI SDK format
 * 5. A2A metadata exposed via `result.providerMetadata.a2a`
 *
 * @param options - Provider factory settings
 * @returns A provider that creates A2A language models
 *
 * @see https://a2a-protocol.org/ - A2A Protocol specification
 * @see https://sdk.vercel.ai/docs/ai-sdk-core/providers - AI SDK provider docs
 */
export function createA2aV3(options: A2aV3ProviderSettings = {}): A2aV3Provider {
  const { generateId } = options;

  const createModel = (agentUrl: string, settings: A2aV3ChatSettings = {}): A2aV3LanguageModel => {
    return new A2aV3LanguageModel(agentUrl, settings, {
      provider: "a2a-v3",
      generateId,
    });
  };

  const provider = ((agentUrl: string, settings?: A2aV3ChatSettings) => {
    return createModel(agentUrl, settings);
  }) as A2aV3Provider;

  // Set required ProviderV3 properties
  (provider as { specificationVersion: "v3" }).specificationVersion = "v3";
  provider.languageModel = createModel;

  return provider;
}

/**
 * Default A2A V3 provider instance
 *
 * @example
 * ```typescript
 * import { a2aV3 } from '@drew-foxall/a2a-ai-provider-v3';
 * import { generateText } from 'ai';
 *
 * const result = await generateText({
 *   model: a2aV3('http://localhost:3001'),
 *   prompt: 'Hello!',
 * });
 * ```
 */
export const a2aV3 = createA2aV3();
