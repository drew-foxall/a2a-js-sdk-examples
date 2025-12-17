/**
 * MSW (Mock Service Worker) Handlers for AI Providers
 *
 * These handlers intercept HTTP requests to AI provider APIs and return
 * deterministic mock responses. Use these for E2E tests that need to test
 * the full HTTP stack without making real AI API calls.
 *
 * ## Setup
 *
 * ```bash
 * pnpm add -D msw
 * ```
 *
 * ## Usage
 *
 * ```typescript
 * import { setupServer } from "msw/node";
 * import { createOpenAIHandlers } from "a2a-workers-shared/msw-handlers";
 *
 * const server = setupServer(...createOpenAIHandlers());
 *
 * beforeAll(() => server.listen());
 * afterEach(() => server.resetHandlers());
 * afterAll(() => server.close());
 * ```
 *
 * ## Customizing Responses
 *
 * ```typescript
 * import { createOpenAIHandlers } from "a2a-workers-shared/msw-handlers";
 *
 * const handlers = createOpenAIHandlers({
 *   defaultResponse: "Custom response text",
 *   responseMap: {
 *     "roll a die": "I rolled a 6!",
 *     "weather": "It's sunny and 72°F",
 *   },
 * });
 * ```
 */

import { http, HttpResponse, type HttpHandler } from "msw";

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for mock AI handlers
 */
export interface MockHandlerConfig {
  /**
   * Default response text when no specific match is found
   * @default "This is a mock response from the AI model."
   */
  defaultResponse?: string;

  /**
   * Map of input patterns to specific responses
   * Keys are matched against the user message (case-insensitive, partial match)
   */
  responseMap?: Record<string, string>;

  /**
   * Simulated latency in milliseconds
   * @default 0
   */
  latency?: number;

  /**
   * Whether to simulate streaming responses
   * @default false
   */
  streaming?: boolean;

  /**
   * Simulate an error response
   */
  error?: {
    status: number;
    message: string;
  };
}

/**
 * OpenAI Chat Completion request body
 */
interface OpenAIChatRequest {
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  stream?: boolean;
  tools?: unknown[];
}

/**
 * Anthropic Messages request body
 */
interface AnthropicMessagesRequest {
  model: string;
  messages: Array<{
    role: "user" | "assistant";
    content: string | Array<{ type: "text"; text: string }>;
  }>;
  stream?: boolean;
  max_tokens?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract user message from request
 */
function extractUserMessage(messages: Array<{ role: string; content: unknown }>): string {
  const userMessages = messages.filter((m) => m.role === "user");
  if (userMessages.length === 0) return "";

  const lastMessage = userMessages[userMessages.length - 1];
  if (typeof lastMessage.content === "string") {
    return lastMessage.content;
  }
  if (Array.isArray(lastMessage.content)) {
    return lastMessage.content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join(" ");
  }
  return "";
}

/**
 * Get response based on user message and config
 */
function getResponse(userMessage: string, config: MockHandlerConfig): string {
  const { defaultResponse = "This is a mock response from the AI model.", responseMap = {} } =
    config;

  const lowerMessage = userMessage.toLowerCase();

  for (const [pattern, response] of Object.entries(responseMap)) {
    if (lowerMessage.includes(pattern.toLowerCase())) {
      return response;
    }
  }

  return defaultResponse;
}

/**
 * Apply simulated latency
 */
async function applyLatency(config: MockHandlerConfig): Promise<void> {
  if (config.latency && config.latency > 0) {
    await new Promise((resolve) => setTimeout(resolve, config.latency));
  }
}

// ============================================================================
// OpenAI Handlers
// ============================================================================

/**
 * Create MSW handlers for OpenAI API
 *
 * @param config - Handler configuration
 * @returns Array of MSW handlers
 *
 * @example Basic usage
 * ```typescript
 * const handlers = createOpenAIHandlers();
 * const server = setupServer(...handlers);
 * ```
 *
 * @example With custom responses
 * ```typescript
 * const handlers = createOpenAIHandlers({
 *   responseMap: {
 *     "hello": "Hello! How can I help you?",
 *     "dice": "I rolled a 6!",
 *   },
 * });
 * ```
 */
export function createOpenAIHandlers(config: MockHandlerConfig = {}): HttpHandler[] {
  return [
    // Chat Completions (non-streaming)
    http.post("https://api.openai.com/v1/chat/completions", async ({ request }) => {
      await applyLatency(config);

      if (config.error) {
        return HttpResponse.json(
          { error: { message: config.error.message, type: "api_error" } },
          { status: config.error.status }
        );
      }

      const body = (await request.json()) as OpenAIChatRequest;
      const userMessage = extractUserMessage(body.messages);
      const responseText = getResponse(userMessage, config);

      // Handle streaming
      if (body.stream) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            // Split response into words for realistic streaming
            const words = responseText.split(" ");
            let index = 0;

            const sendChunk = () => {
              if (index < words.length) {
                const word = index === 0 ? words[index] : ` ${words[index]}`;
                const chunk = {
                  id: `chatcmpl-${Date.now()}`,
                  object: "chat.completion.chunk",
                  created: Math.floor(Date.now() / 1000),
                  model: body.model,
                  choices: [
                    {
                      index: 0,
                      delta: { content: word },
                      finish_reason: null,
                    },
                  ],
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                index++;
                setTimeout(sendChunk, 10); // Small delay between chunks
              } else {
                // Final chunk
                const finalChunk = {
                  id: `chatcmpl-${Date.now()}`,
                  object: "chat.completion.chunk",
                  created: Math.floor(Date.now() / 1000),
                  model: body.model,
                  choices: [
                    {
                      index: 0,
                      delta: {},
                      finish_reason: "stop",
                    },
                  ],
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`));
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
              }
            };

            sendChunk();
          },
        });

        return new HttpResponse(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }

      // Non-streaming response
      return HttpResponse.json({
        id: `chatcmpl-${Date.now()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: body.model,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: responseText,
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 50,
          completion_tokens: responseText.split(" ").length * 2,
          total_tokens: 50 + responseText.split(" ").length * 2,
        },
      });
    }),
  ];
}

// ============================================================================
// Anthropic Handlers
// ============================================================================

/**
 * Create MSW handlers for Anthropic API
 *
 * @param config - Handler configuration
 * @returns Array of MSW handlers
 *
 * @example
 * ```typescript
 * const handlers = createAnthropicHandlers({
 *   defaultResponse: "Hello from Claude!",
 * });
 * ```
 */
export function createAnthropicHandlers(config: MockHandlerConfig = {}): HttpHandler[] {
  return [
    http.post("https://api.anthropic.com/v1/messages", async ({ request }) => {
      await applyLatency(config);

      if (config.error) {
        return HttpResponse.json(
          { type: "error", error: { type: "api_error", message: config.error.message } },
          { status: config.error.status }
        );
      }

      const body = (await request.json()) as AnthropicMessagesRequest;
      const userMessage = extractUserMessage(body.messages);
      const responseText = getResponse(userMessage, config);

      // Handle streaming
      if (body.stream) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            // Message start event
            controller.enqueue(
              encoder.encode(
                `event: message_start\ndata: ${JSON.stringify({
                  type: "message_start",
                  message: {
                    id: `msg_${Date.now()}`,
                    type: "message",
                    role: "assistant",
                    content: [],
                    model: body.model,
                    stop_reason: null,
                    usage: { input_tokens: 50, output_tokens: 0 },
                  },
                })}\n\n`
              )
            );

            // Content block start
            controller.enqueue(
              encoder.encode(
                `event: content_block_start\ndata: ${JSON.stringify({
                  type: "content_block_start",
                  index: 0,
                  content_block: { type: "text", text: "" },
                })}\n\n`
              )
            );

            // Stream text deltas
            const words = responseText.split(" ");
            words.forEach((word, i) => {
              const text = i === 0 ? word : ` ${word}`;
              controller.enqueue(
                encoder.encode(
                  `event: content_block_delta\ndata: ${JSON.stringify({
                    type: "content_block_delta",
                    index: 0,
                    delta: { type: "text_delta", text },
                  })}\n\n`
                )
              );
            });

            // Content block stop
            controller.enqueue(
              encoder.encode(
                `event: content_block_stop\ndata: ${JSON.stringify({
                  type: "content_block_stop",
                  index: 0,
                })}\n\n`
              )
            );

            // Message delta (stop reason)
            controller.enqueue(
              encoder.encode(
                `event: message_delta\ndata: ${JSON.stringify({
                  type: "message_delta",
                  delta: { stop_reason: "end_turn" },
                  usage: { output_tokens: words.length * 2 },
                })}\n\n`
              )
            );

            // Message stop
            controller.enqueue(
              encoder.encode(
                `event: message_stop\ndata: ${JSON.stringify({
                  type: "message_stop",
                })}\n\n`
              )
            );

            controller.close();
          },
        });

        return new HttpResponse(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
          },
        });
      }

      // Non-streaming response
      return HttpResponse.json({
        id: `msg_${Date.now()}`,
        type: "message",
        role: "assistant",
        content: [{ type: "text", text: responseText }],
        model: body.model,
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: {
          input_tokens: 50,
          output_tokens: responseText.split(" ").length * 2,
        },
      });
    }),
  ];
}

// ============================================================================
// Google AI Handlers
// ============================================================================

/**
 * Create MSW handlers for Google AI (Gemini) API
 *
 * @param config - Handler configuration
 * @returns Array of MSW handlers
 */
export function createGoogleAIHandlers(config: MockHandlerConfig = {}): HttpHandler[] {
  return [
    // Gemini generateContent endpoint
    http.post(
      "https://generativelanguage.googleapis.com/v1beta/models/:model:generateContent",
      async ({ request }) => {
        await applyLatency(config);

        if (config.error) {
          return HttpResponse.json(
            { error: { code: config.error.status, message: config.error.message } },
            { status: config.error.status }
          );
        }

        const body = (await request.json()) as {
          contents: Array<{ role: string; parts: Array<{ text: string }> }>;
        };

        const userMessage = body.contents
          .filter((c) => c.role === "user")
          .flatMap((c) => c.parts)
          .map((p) => p.text)
          .join(" ");

        const responseText = getResponse(userMessage, config);

        return HttpResponse.json({
          candidates: [
            {
              content: {
                parts: [{ text: responseText }],
                role: "model",
              },
              finishReason: "STOP",
              index: 0,
            },
          ],
          usageMetadata: {
            promptTokenCount: 50,
            candidatesTokenCount: responseText.split(" ").length * 2,
            totalTokenCount: 50 + responseText.split(" ").length * 2,
          },
        });
      }
    ),

    // Gemini streamGenerateContent endpoint
    http.post(
      "https://generativelanguage.googleapis.com/v1beta/models/:model:streamGenerateContent",
      async ({ request }) => {
        await applyLatency(config);

        if (config.error) {
          return HttpResponse.json(
            { error: { code: config.error.status, message: config.error.message } },
            { status: config.error.status }
          );
        }

        const body = (await request.json()) as {
          contents: Array<{ role: string; parts: Array<{ text: string }> }>;
        };

        const userMessage = body.contents
          .filter((c) => c.role === "user")
          .flatMap((c) => c.parts)
          .map((p) => p.text)
          .join(" ");

        const responseText = getResponse(userMessage, config);
        const encoder = new TextEncoder();

        const stream = new ReadableStream({
          start(controller) {
            const words = responseText.split(" ");
            words.forEach((word, i) => {
              const text = i === 0 ? word : ` ${word}`;
              const chunk = {
                candidates: [
                  {
                    content: {
                      parts: [{ text }],
                      role: "model",
                    },
                    finishReason: i === words.length - 1 ? "STOP" : null,
                    index: 0,
                  },
                ],
              };
              controller.enqueue(encoder.encode(JSON.stringify(chunk) + "\n"));
            });
            controller.close();
          },
        });

        return new HttpResponse(stream, {
          headers: { "Content-Type": "application/x-ndjson" },
        });
      }
    ),
  ];
}

// ============================================================================
// Combined Handlers
// ============================================================================

/**
 * Create MSW handlers for all supported AI providers
 *
 * @param config - Handler configuration (applied to all providers)
 * @returns Array of MSW handlers for OpenAI, Anthropic, and Google AI
 *
 * @example
 * ```typescript
 * import { setupServer } from "msw/node";
 * import { createAllAIHandlers } from "a2a-workers-shared/msw-handlers";
 *
 * const server = setupServer(...createAllAIHandlers({
 *   defaultResponse: "Hello from any AI!",
 * }));
 * ```
 */
export function createAllAIHandlers(config: MockHandlerConfig = {}): HttpHandler[] {
  return [
    ...createOpenAIHandlers(config),
    ...createAnthropicHandlers(config),
    ...createGoogleAIHandlers(config),
  ];
}

// ============================================================================
// Scenario-Based Handlers
// ============================================================================

/**
 * Create handlers that simulate specific scenarios
 */
export const scenarioHandlers = {
  /**
   * Handlers that always return an error
   */
  error: (status: number, message: string) =>
    createAllAIHandlers({ error: { status, message } }),

  /**
   * Handlers with high latency (for timeout testing)
   */
  slowResponse: (latencyMs: number) => createAllAIHandlers({ latency: latencyMs }),

  /**
   * Handlers for rate limiting scenarios
   */
  rateLimited: () =>
    createAllAIHandlers({
      error: { status: 429, message: "Rate limit exceeded" },
    }),

  /**
   * Handlers for authentication errors
   */
  unauthorized: () =>
    createAllAIHandlers({
      error: { status: 401, message: "Invalid API key" },
    }),
};

