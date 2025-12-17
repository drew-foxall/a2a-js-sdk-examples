/**
 * Test Utilities for A2A Workers
 *
 * Provides mock models, environment factories, and request builders for testing
 * A2A workers without making real AI API calls.
 *
 * ## Testing Approaches
 *
 * 1. **AI SDK Mocks** - Replace the model entirely with MockLanguageModelV3
 * 2. **Network Mocks** - Intercept HTTP requests to AI providers (MSW)
 * 3. **Hybrid** - Combine both for comprehensive coverage
 *
 * @example Unit tests with AI SDK mocks
 * ```typescript
 * import { createMockModel, createMockEnv } from "a2a-workers-shared/test-utils";
 *
 * const model = createMockModel({ response: "Hello!" });
 * const env = createMockEnv();
 * ```
 *
 * @example E2E tests with network mocks
 * ```typescript
 * import { createOpenAIMockHandlers } from "a2a-workers-shared/test-utils";
 * import { setupServer } from "msw/node";
 *
 * const server = setupServer(...createOpenAIMockHandlers());
 * ```
 */

import type { LanguageModel } from "ai";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import type { BaseWorkerEnv } from "./worker-config.js";

// ============================================================================
// Mock Model Configuration
// ============================================================================

/**
 * Options for creating a mock language model
 */
export interface MockModelOptions {
  /**
   * The text response the model should return
   * @default "This is a mock response from the AI model."
   */
  response?: string;

  /**
   * Whether to simulate streaming mode
   * @default false
   */
  streaming?: boolean;

  /**
   * Simulated tool calls the model should make
   * When provided, the model will simulate calling these tools
   */
  toolCalls?: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
  }>;

  /**
   * Token usage statistics
   */
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };

  /**
   * Simulate an error response
   */
  error?: Error;

  /**
   * Delay in milliseconds before responding (useful for testing loading states)
   * @default 0
   */
  delay?: number;
}

/**
 * Create a mock language model for testing
 *
 * This uses AI SDK's official MockLanguageModelV3 to create a deterministic
 * model that returns predictable responses without making API calls.
 *
 * @param options - Configuration for the mock model
 * @returns A LanguageModel instance suitable for testing
 *
 * @example Basic usage
 * ```typescript
 * const model = createMockModel({ response: "Hello, world!" });
 * const agent = createHelloWorldAgent(model);
 * ```
 *
 * @example Streaming mode
 * ```typescript
 * const model = createMockModel({
 *   response: "Streaming response",
 *   streaming: true,
 * });
 * ```
 *
 * @example With tool calls
 * ```typescript
 * const model = createMockModel({
 *   response: "I rolled a 6!",
 *   toolCalls: [{ id: "call-1", name: "rollDice", args: { sides: 6 } }],
 * });
 * ```
 */
export function createMockModel(options: MockModelOptions = {}): LanguageModel {
  const {
    response = "This is a mock response from the AI model.",
    streaming = false,
    toolCalls,
    usage = { inputTokens: 10, outputTokens: 20 },
    error,
    delay = 0,
  } = options;

  const applyDelay = async () => {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  };

  if (error) {
    return new MockLanguageModelV3({
      doGenerate: async () => {
        await applyDelay();
        throw error;
      },
      doStream: async () => {
        await applyDelay();
        throw error;
      },
    }) as LanguageModel;
  }

  if (streaming) {
    return new MockLanguageModelV3({
      doStream: async () => {
        await applyDelay();

        // Build chunks for streaming (AI SDK v6 format)
        const chunks: Array<
          | { type: "text-start"; id: string }
          | { type: "text-delta"; id: string; delta: string }
          | { type: "text-end"; id: string }
          | { type: "tool-call"; toolCallId: string; toolName: string; input: string }
          | {
              type: "finish";
              finishReason: "stop" | "tool-calls";
              logprobs: undefined;
              usage: { inputTokens: number; outputTokens: number; totalTokens: number };
            }
        > = [];

        // Add tool calls if provided (AI SDK v6 format)
        if (toolCalls && toolCalls.length > 0) {
          for (const toolCall of toolCalls) {
            chunks.push({
              type: "tool-call",
              toolCallId: toolCall.id,
              toolName: toolCall.name,
              input: JSON.stringify(toolCall.args),
            });
          }
        }

        // Add text response
        chunks.push({ type: "text-start", id: "text-1" });

        // Split response into chunks for realistic streaming
        const words = response.split(" ");
        for (let i = 0; i < words.length; i++) {
          const word = i === 0 ? words[i] : ` ${words[i]}`;
          chunks.push({ type: "text-delta", id: "text-1", delta: word ?? "" });
        }

        chunks.push({ type: "text-end", id: "text-1" });
        chunks.push({
          type: "finish",
          finishReason: toolCalls && toolCalls.length > 0 ? "tool-calls" : "stop",
          logprobs: undefined,
          usage: {
            inputTokens: usage.inputTokens ?? 10,
            outputTokens: usage.outputTokens ?? 20,
            totalTokens: (usage.inputTokens ?? 10) + (usage.outputTokens ?? 20),
          },
        });

        return {
          stream: simulateReadableStream({ chunks }),
        };
      },
    }) as LanguageModel;
  }

  // Generate mode (non-streaming) - AI SDK v6 format
  return new MockLanguageModelV3({
    doGenerate: async () => {
      await applyDelay();

      const content: Array<
        | { type: "text"; text: string }
        | { type: "tool-call"; toolCallId: string; toolName: string; input: string }
      > = [];

      // Add tool calls if provided (AI SDK v6 format uses 'input' as JSON string)
      if (toolCalls && toolCalls.length > 0) {
        for (const toolCall of toolCalls) {
          content.push({
            type: "tool-call",
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            input: JSON.stringify(toolCall.args),
          });
        }
      }

      // Add text response
      content.push({ type: "text", text: response });

      return {
        finishReason: toolCalls && toolCalls.length > 0 ? "tool-calls" : "stop",
        usage: {
          inputTokens: usage.inputTokens ?? 10,
          outputTokens: usage.outputTokens ?? 20,
          totalTokens: (usage.inputTokens ?? 10) + (usage.outputTokens ?? 20),
        },
        content,
        warnings: [],
      };
    },
  }) as LanguageModel;
}

// ============================================================================
// Mock Environment
// ============================================================================

/**
 * Options for creating a mock environment
 */
export interface MockEnvOptions {
  /**
   * AI provider to use
   * @default "openai"
   */
  provider?: "openai" | "anthropic" | "google";

  /**
   * Model name to use
   * @default "gpt-4o-mini"
   */
  model?: string;

  /**
   * Additional environment variables
   */
  extras?: Record<string, string>;
}

/**
 * Create a mock environment for testing workers
 *
 * @param options - Configuration for the mock environment
 * @returns A BaseWorkerEnv compatible object
 *
 * @example Basic usage
 * ```typescript
 * const env = createMockEnv();
 * const response = await app.fetch(request, env);
 * ```
 *
 * @example With Anthropic
 * ```typescript
 * const env = createMockEnv({
 *   provider: "anthropic",
 *   model: "claude-3-5-sonnet-20241022",
 * });
 * ```
 */
export function createMockEnv(options: MockEnvOptions = {}): BaseWorkerEnv {
  const { provider = "openai", model, extras = {} } = options;

  const baseEnv: BaseWorkerEnv = {
    AI_PROVIDER: provider,
    AI_MODEL: model ?? getDefaultModel(provider),
    OPENAI_API_KEY: "sk-test-mock-key-for-testing", // Always provide default
    ...extras,
  };

  // Add provider-specific API key
  switch (provider) {
    case "anthropic":
      baseEnv.ANTHROPIC_API_KEY = "sk-ant-test-mock-key-for-testing";
      break;
    case "google":
      baseEnv.GOOGLE_API_KEY = "test-google-api-key-for-testing";
      break;
  }

  return baseEnv;
}

function getDefaultModel(provider: string): string {
  switch (provider) {
    case "anthropic":
      return "claude-3-5-sonnet-20241022";
    case "google":
      return "gemini-2.0-flash-exp";
    default:
      return "gpt-4o-mini";
  }
}

// ============================================================================
// A2A Request Builders
// ============================================================================

/**
 * Create a JSON-RPC 2.0 request for A2A protocol
 *
 * @param method - The A2A method to call
 * @param params - Parameters for the method
 * @param id - Request ID (auto-generated if not provided)
 * @returns A Request object ready to send to a worker
 */
export function createA2ARequest(
  method: string,
  params: unknown,
  id?: string | number
): Request {
  return new Request("http://localhost/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: id ?? `test-${Date.now()}`,
      method,
      params,
    }),
  });
}

/**
 * Create a message/send request for testing
 *
 * @param text - The message text to send
 * @param options - Additional options
 * @returns A Request object for message/send
 *
 * @example Basic usage
 * ```typescript
 * const request = createMessageSendRequest("Hello!");
 * const response = await app.fetch(request, env);
 * ```
 *
 * @example With context
 * ```typescript
 * const request = createMessageSendRequest("Follow up", {
 *   contextId: "ctx-123",
 *   taskId: "task-456",
 * });
 * ```
 */
export function createMessageSendRequest(
  text: string,
  options: {
    messageId?: string;
    contextId?: string;
    taskId?: string;
    role?: "user" | "agent";
  } = {}
): Request {
  const { messageId = `msg-${Date.now()}`, contextId, taskId, role = "user" } = options;

  return createA2ARequest("message/send", {
    message: {
      messageId,
      role,
      parts: [{ kind: "text", text }],
    },
    ...(contextId && { contextId }),
    ...(taskId && { taskId }),
  });
}

/**
 * Create a tasks/get request for testing
 *
 * @param taskId - The task ID to retrieve
 * @returns A Request object for tasks/get
 */
export function createTasksGetRequest(taskId: string): Request {
  return createA2ARequest("tasks/get", { id: taskId });
}

/**
 * Create a tasks/cancel request for testing
 *
 * @param taskId - The task ID to cancel
 * @returns A Request object for tasks/cancel
 */
export function createTasksCancelRequest(taskId: string): Request {
  return createA2ARequest("tasks/cancel", { id: taskId });
}

/**
 * Create a request for the agent card endpoint
 *
 * @returns A Request object for /.well-known/agent-card.json
 */
export function createAgentCardRequest(): Request {
  return new Request("http://localhost/.well-known/agent-card.json");
}

/**
 * Create a request for the health check endpoint
 *
 * @returns A Request object for /health
 */
export function createHealthCheckRequest(): Request {
  return new Request("http://localhost/health");
}

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Parse a JSON-RPC response from a worker
 *
 * @param response - The Response object from the worker
 * @returns Parsed JSON-RPC response
 */
export async function parseA2AResponse<T = unknown>(
  response: Response
): Promise<{
  jsonrpc: "2.0";
  id: string | number;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
}> {
  return response.json();
}

/**
 * Extract text from an A2A task response
 *
 * @param response - The parsed A2A response
 * @returns The text content from the response
 */
export function extractTextFromResponse(response: {
  result?: {
    status?: string;
    history?: Array<{
      role: string;
      parts: Array<{ kind: string; text?: string }>;
    }>;
  };
}): string | undefined {
  const history = response.result?.history;
  if (!history || history.length === 0) return undefined;

  // Find the last agent message
  const agentMessages = history.filter((m) => m.role === "agent");
  if (agentMessages.length === 0) return undefined;

  const lastMessage = agentMessages[agentMessages.length - 1];
  const textParts = lastMessage.parts.filter((p) => p.kind === "text" && p.text);

  return textParts.map((p) => p.text).join("");
}

// ============================================================================
// Model Injection for E2E Tests
// ============================================================================

/**
 * Global test model that can be injected for E2E tests
 *
 * This allows E2E tests to inject a mock model without modifying production code.
 * Set to null to use the real model from environment.
 */
let injectedTestModel: LanguageModel | null = null;

/**
 * Set a test model to be used instead of the real AI provider
 *
 * Call this in your test setup (beforeAll/beforeEach) to inject a mock model.
 * Call with null to restore normal behavior.
 *
 * @param model - The mock model to use, or null to use real model
 *
 * @example
 * ```typescript
 * beforeAll(() => {
 *   setTestModel(createMockModel({ response: "Test response" }));
 * });
 *
 * afterAll(() => {
 *   setTestModel(null);
 * });
 * ```
 */
export function setTestModel(model: LanguageModel | null): void {
  injectedTestModel = model;
}

/**
 * Get the currently injected test model
 *
 * Used internally by getModel() to check for test model injection.
 *
 * @returns The injected test model, or null if none is set
 */
export function getTestModel(): LanguageModel | null {
  return injectedTestModel;
}

// ============================================================================
// Test Assertions
// ============================================================================

/**
 * Assert that a response is a valid A2A success response
 *
 * @param response - The Response object to check
 * @throws If the response is not a valid success response
 */
export async function assertA2ASuccess(response: Response): Promise<void> {
  if (!response.ok) {
    throw new Error(`Expected success response, got ${response.status}`);
  }

  const json = (await response.clone().json()) as Record<string, unknown>;

  if (json["error"]) {
    throw new Error(`Expected success, got error: ${JSON.stringify(json["error"])}`);
  }

  if (!json["result"]) {
    throw new Error("Expected result in response");
  }
}

/**
 * Assert that a response is a valid A2A error response
 *
 * @param response - The Response object to check
 * @param expectedCode - Optional expected error code
 * @throws If the response is not a valid error response
 */
export async function assertA2AError(
  response: Response,
  expectedCode?: number
): Promise<void> {
  const json = (await response.clone().json()) as Record<string, unknown>;
  const error = json["error"] as Record<string, unknown> | undefined;

  if (!error) {
    throw new Error(`Expected error response, got result: ${JSON.stringify(json["result"])}`);
  }

  if (expectedCode !== undefined && error["code"] !== expectedCode) {
    throw new Error(`Expected error code ${expectedCode}, got ${error["code"]}`);
  }
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export { MockLanguageModelV3 } from "ai/test";
export { simulateReadableStream } from "ai";

