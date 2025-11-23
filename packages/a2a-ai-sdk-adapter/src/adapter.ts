/**
 * A2A Adapter - Unified Adapter with Explicit Mode Switching
 *
 * Bridges AI SDK ToolLoopAgent with A2A protocol.
 * Mirrors AI SDK's streamText vs generateText model:
 * - mode: 'stream' → Uses agent.stream() for real-time responses
 * - mode: 'generate' → Uses agent.generate() for awaited responses
 *
 * Architecture:
 * ToolLoopAgent (AI SDK) → A2AAdapter (explicit mode) → A2A Server
 *
 * MODE CAPABILITIES:
 *
 * STREAM MODE (mode: 'stream'):
 * - Real-time text streaming (always enabled)
 * - Incremental artifact parsing (via parseArtifacts)
 * - Post-completion artifacts (via generateArtifacts)
 * - Best for: Long-form content, code generation, chat
 *
 * GENERATE MODE (mode: 'generate'):
 * - Single awaited response
 * - Post-completion artifacts (via generateArtifacts)
 * - Best for: Quick responses, simple agents, API-style interactions
 *
 * Usage Examples:
 *
 * // Content Editor (generate mode - simple awaited response)
 * const executor = new A2AAdapter(agent, {
 *   mode: 'generate',
 *   workingMessage: "Editing content...",
 * });
 *
 * // Movie Agent (generate mode with custom state)
 * const executor = new A2AAdapter(agent, {
 *   mode: 'generate',
 *   parseTaskState: (text) => text.includes('COMPLETED') ? 'completed' : 'input-required',
 *   includeHistory: true,
 * });
 *
 * // Coder Agent (stream mode with text + artifacts)
 * const executor = new A2AAdapter(agent, {
 *   mode: 'stream',
 *   parseArtifacts: extractCodeBlocks,  // Real-time code extraction
 *   workingMessage: "Generating code...",
 * });
 *
 * // Analytics Agent (generate mode with async artifacts)
 * const executor = new A2AAdapter(agent, {
 *   mode: 'generate',
 *   generateArtifacts: async (ctx) => [await generateChart(ctx.responseText)],
 * });
 */

import type {
  Artifact,
  Message,
  Task,
  TaskArtifactUpdateEvent,
  TaskState,
  TaskStatusUpdateEvent,
} from "@drew-foxall/a2a-js-sdk";
import type {
  AgentExecutor,
  ExecutionEventBus,
  RequestContext,
} from "@drew-foxall/a2a-js-sdk/server";
import type { ModelMessage, ToolLoopAgent, ToolSet } from "ai";
import { v4 as uuidv4 } from "uuid";

/**
 * ⚠️ CRITICAL AI SDK TYPE REFERENCE ⚠️
 *
 * DO NOT use deprecated "Core*" types from AI SDK:
 * - ❌ CoreMessage (DEPRECATED)
 * - ❌ CoreUserMessage (DEPRECATED)
 * - ❌ CoreAssistantMessage (DEPRECATED)
 * - ❌ CoreSystemMessage (DEPRECATED)
 * - ❌ CoreToolMessage (DEPRECATED)
 *
 * ✅ USE CURRENT TYPES:
 * - ModelMessage (union of all message types)
 * - UserModelMessage
 * - AssistantModelMessage
 * - SystemModelMessage
 * - ToolModelMessage
 *
 * Source: node_modules/ai/dist/index.d.ts (lines 1020-1061)
 * The Core* types are explicitly marked @deprecated
 *
 * AgentCallParameters structure (AI SDK):
 * ```typescript
 * type AgentCallParameters<CALL_OPTIONS> =
 *   ({ options?: never } | { options: CALL_OPTIONS }) &
 *   ({ prompt: string | Array<ModelMessage>; messages?: never } |
 *    { messages: Array<ModelMessage>; prompt?: never }) &
 *   { abortSignal?: AbortSignal };
 * ```
 *
 * ToolLoopAgent signature:
 * ```typescript
 * class ToolLoopAgent<CALL_OPTIONS = never, TOOLS extends ToolSet = {}, OUTPUT extends Output = never>
 *   generate(params: AgentCallParameters<CALL_OPTIONS>): Promise<GenerateTextResult<TOOLS, OUTPUT>>
 *   stream(params: AgentCallParameters<CALL_OPTIONS>): Promise<StreamTextResult<TOOLS, OUTPUT>>
 * ```
 *
 * Key insights:
 * 1. First generic is CALL_OPTIONS (not MODEL) - use `never` for no options
 * 2. AgentCallParameters accepts EITHER `prompt` OR `messages` (not both)
 * 3. Both accept `Array<ModelMessage>` (NOT CoreMessage[])
 * 4. Default CALL_OPTIONS is `never`, not `unknown`
 */

/**
 * Logger interface for A2AAdapter
 *
 * Allows consumers to inject custom logging implementations
 * (Winston, Pino, Bunyan, etc.) or create mock loggers for testing.
 */
export interface A2ALogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Default console logger implementation
 */
export class ConsoleLogger implements A2ALogger {
  constructor(private prefix: string = "[A2AAdapter]") {}

  debug(message: string, meta?: Record<string, unknown>): void {
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    console.log(`${this.prefix} [DEBUG] ${message}${metaStr}`);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    console.log(`${this.prefix} [INFO] ${message}${metaStr}`);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    console.warn(`${this.prefix} [WARN] ${message}${metaStr}`);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    console.error(`${this.prefix} [ERROR] ${message}${metaStr}`);
  }
}

/**
 * No-op logger for when debug is disabled
 * Still logs errors to ensure critical issues are visible
 */
export class NoOpLogger implements A2ALogger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(message: string, meta?: Record<string, unknown>): void {
    // Always log errors even in production
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    console.error(`[A2AAdapter] ERROR: ${message}${metaStr}`);
  }
}

/**
 * Context provided to generateArtifacts function
 *
 * Contains the minimal information needed for artifact generation.
 * This is more honest than casting to full RequestContext which has fields we don't populate.
 */
export interface ArtifactGenerationContext {
  taskId: string;
  contextId: string;
  responseText: string;
}

/**
 * Parameters for agent.generate() calls
 *
 * This interface documents the expected input structure for AI SDK agents.
 */
export interface AgentGenerateParams {
  prompt: string;
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
  contextId?: string;
}

/**
 * Parameters for agent.stream() calls
 *
 * This interface documents the expected input structure for streaming AI SDK agents.
 */
export interface AgentStreamParams {
  prompt: string;
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
  contextId?: string;
}

/**
 * AI SDK generate result interface
 * Represents the result from agent.generate()
 *
 * Note: This is a simplified interface. The actual GenerateTextResult
 * has many more properties, but we only need text for basic usage.
 */
export interface AIGenerateResult {
  text: string;
  [key: string]: unknown;
}

/**
 * AI SDK stream result interface
 * Represents the result from agent.stream()
 */
export interface AIStreamResult {
  stream: AsyncIterable<{ text: string; [key: string]: unknown }>;
  text: Promise<string>;
  [key: string]: unknown;
}

/**
 * Parsed artifact from streaming chunks
 */
export interface ParsedArtifact {
  filename?: string;
  language?: string;
  content: string;
  done: boolean;
  preamble?: string;
  metadata?: Record<string, unknown>;
}

export interface ParsedArtifacts {
  artifacts: ParsedArtifact[];
  preamble?: string;
  postamble?: string;
}

/**
 * Configuration options for A2AAdapter
 *
 * Mirrors AI SDK's streamText vs generateText model:
 * - 'stream': Uses agent.stream() - real-time incremental responses
 * - 'generate': Uses agent.generate() - single awaited response
 */
export interface A2AAdapterConfig {
  /**
   * Execution mode - REQUIRED, mirrors AI SDK's model
   *
   * - 'stream': Uses agent.stream() for real-time streaming (like streamText)
   * - 'generate': Uses agent.generate() for single response (like generateText)
   *
   * This is an explicit choice, not auto-detected. Choose based on your UX needs:
   * - Stream: Better UX for long responses, real-time feedback
   * - Generate: Simpler, single response, good for quick agents
   *
   * @example
   * mode: 'stream'   // Real-time streaming
   * mode: 'generate' // Awaited response
   */
  mode: "stream" | "generate";

  /**
   * Parse artifacts from accumulated text during streaming (STREAM MODE ONLY)
   *
   * Called after each chunk to extract completed artifacts.
   * Should return all artifacts found so far (adapter handles deduplication).
   *
   * Only used in 'stream' mode. Ignored in 'generate' mode.
   *
   * Use this for extracting artifacts from streamed text (e.g., code blocks).
   *
   * @example
   * parseArtifacts: (text) => extractCodeBlocks(text)
   */
  parseArtifacts?: (accumulatedText: string) => ParsedArtifacts;

  /**
   * Generate artifacts after response completion (BOTH MODES)
   *
   * Called once with the complete response text after agent finishes.
   * Works in both 'stream' and 'generate' modes.
   *
   * Use this for async operations like chart generation, API calls, etc.
   *
   * @param context - Context with taskId, contextId, and responseText
   * @returns Promise resolving to array of A2A artifacts
   *
   * @example
   * generateArtifacts: async (context) => {
   *   const chart = await generateChart(context.responseText);
   *   return [{ artifactId: '...', name: 'chart', parts: [...] }];
   * }
   */
  generateArtifacts?: (context: ArtifactGenerationContext) => Promise<Artifact[]>;

  /**
   * Build final message from artifacts and response (streaming mode)
   *
   * @default Shows count of artifacts generated
   */
  buildFinalMessage?: (
    artifacts: ParsedArtifact[],
    fullResponse: string,
    preamble?: string,
    postamble?: string
  ) => string;

  /**
   * Parse task state from agent response text (simple mode)
   *
   * Some agents output special state indicators (e.g., "COMPLETED", "AWAITING_USER_INPUT").
   *
   * @param responseText - The agent's text response
   * @returns The A2A task state, or undefined to use default ("completed")
   *
   * @example
   * parseTaskState: (text) => {
   *   const lastLine = text.trim().split('\n').at(-1);
   *   if (lastLine === 'AWAITING_USER_INPUT') return 'input-required';
   *   if (lastLine === 'COMPLETED') return 'completed';
   *   return 'completed';
   * }
   */
  parseTaskState?: (responseText: string) => TaskState | undefined;

  /**
   * Transform agent response before creating A2A message (simple mode)
   *
   * Useful for extracting final text when agent includes metadata.
   * Can return either a modified result object or just a string.
   *
   * @param result - The raw agent generation result from AI SDK
   * @returns The transformed result with cleaned text, or just the text string
   *
   * @example
   * transformResponse: (result) => {
   *   const lines = result.text.split('\n');
   *   return { ...result, text: lines.slice(0, -1).join('\n') };
   * }
   */
  transformResponse?: (result: { text: string }) => { text: string } | string;

  /**
   * Whether to include conversation history in agent calls.
   *
   * @default false (stateless)
   */
  includeHistory?: boolean;

  /**
   * Working status message to show while agent is processing.
   *
   * @default "Processing your request..."
   */
  workingMessage?: string;

  /**
   * Whether to enable debug logging
   *
   * @default false
   */
  debug?: boolean;

  /**
   * Custom logger implementation
   *
   * If not provided, uses ConsoleLogger (when debug: true) or NoOpLogger.
   * Allows integration with Winston, Pino, Bunyan, or any custom logging system.
   *
   * @example
   * // Using Winston
   * import winston from 'winston';
   * const winstonLogger = winston.createLogger({...});
   *
   * logger: {
   *   debug: (msg, meta) => winstonLogger.debug(msg, meta),
   *   info: (msg, meta) => winstonLogger.info(msg, meta),
   *   warn: (msg, meta) => winstonLogger.warn(msg, meta),
   *   error: (msg, meta) => winstonLogger.error(msg, meta),
   * }
   */
  logger?: A2ALogger;
}

/**
 * A2AAdapter - Automatic Unified Adapter
 *
 * Bridges AI SDK ToolLoopAgent with A2A protocol, automatically adapting
 * behavior based on configuration.
 *
 * AUTOMATIC MODE DETECTION:
 * - If parseArtifacts configured → Streaming mode (agent.stream())
 * - Otherwise → Simple mode (agent.generate())
 *
 * SHARED FEATURES:
 * - Task lifecycle management (create, update, complete)
 * - Cancellation support
 * - Message conversion (A2A ↔ AI SDK)
 * - Status updates (working, completed, failed, canceled)
 * - Error handling
 * - Flexible logging
 *
 * GENERICS:
 * @template TModel - The AI model type (e.g., specific OpenAI model)
 * @template TTools - The tools schema type
 * @template TCallOptions - The call options schema type
 *
 * The generics match ToolLoopAgent to maintain type safety throughout.
 */
export class A2AAdapter<TTools extends ToolSet = ToolSet> implements AgentExecutor {
  private cancelledTasks = new Set<string>();
  private logger: A2ALogger;
  private config: Required<
    Omit<
      A2AAdapterConfig,
      | "parseArtifacts"
      | "generateArtifacts"
      | "parseTaskState"
      | "transformResponse"
      | "buildFinalMessage"
      | "logger"
    >
  > &
    Pick<
      A2AAdapterConfig,
      | "parseArtifacts"
      | "generateArtifacts"
      | "parseTaskState"
      | "transformResponse"
      | "buildFinalMessage"
    >;

  constructor(
    private agent: ToolLoopAgent<never, TTools, never>,
    config: A2AAdapterConfig
  ) {
    // Validate required config
    if (!config.mode) {
      throw new Error(
        "A2AAdapter requires 'mode' to be specified. Use 'stream' for real-time responses or 'generate' for awaited responses."
      );
    }

    // Set defaults for required options
    this.config = {
      mode: config.mode,
      includeHistory: config?.includeHistory ?? false,
      workingMessage: config?.workingMessage || "Processing your request...",
      debug: config?.debug ?? false,
      // Optional configs
      parseArtifacts: config?.parseArtifacts,
      generateArtifacts: config?.generateArtifacts,
      parseTaskState: config?.parseTaskState,
      transformResponse: config?.transformResponse,
      buildFinalMessage: config?.buildFinalMessage,
    };

    // Validate mode-specific config
    if (config.mode === "generate" && config.parseArtifacts) {
      this.logger = config?.logger || new ConsoleLogger();
      this.logger.warn(
        "parseArtifacts is ignored in 'generate' mode. Use 'stream' mode for incremental artifact parsing."
      );
    }

    // Initialize logger
    this.logger = config?.logger || (this.config.debug ? new ConsoleLogger() : new NoOpLogger());
  }

  /**
   * Cancel a running task
   */
  public cancelTask = async (taskId: string, _eventBus: ExecutionEventBus): Promise<void> => {
    this.cancelledTasks.add(taskId);
    this.logger.info(`Task ${taskId} marked for cancellation`, { taskId });
  };

  /**
   * Execute an A2A request using the wrapped ToolLoopAgent
   *
   * EXPLICIT MODE EXECUTION:
   * - mode: 'stream' → Uses agent.stream() for real-time responses
   * - mode: 'generate' → Uses agent.generate() for awaited responses
   */
  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    const { userMessage, task: existingTask } = requestContext;

    // Determine IDs for the task and context
    const taskId = existingTask?.id || uuidv4();
    const contextId = userMessage.contextId || existingTask?.contextId || uuidv4();

    this.logger.debug("Processing message", {
      messageId: userMessage.messageId,
      taskId,
      contextId,
    });

    // Step 1: Publish initial Task event if it's a new task
    if (!existingTask) {
      const initialTask: Task = {
        kind: "task",
        id: taskId,
        contextId: contextId,
        status: {
          state: "submitted",
          timestamp: new Date().toISOString(),
        },
        history: [userMessage],
        metadata: userMessage.metadata,
        artifacts: [], // Initialize artifacts array
      };
      eventBus.publish(initialTask);
      this.logger.debug("Published initial task", { taskId });
    }

    // Step 2: Publish "working" status update
    this.publishWorkingStatus(taskId, contextId, eventBus);

    // Step 3: Extract user prompt from A2A message
    const userPrompt = this.extractTextFromMessage(userMessage);

    if (!userPrompt) {
      this.logger.warn("No text found in message", { messageId: userMessage.messageId });
      this.publishFailure(taskId, contextId, "No message text to process", eventBus);
      return;
    }

    // Step 4: Prepare message history
    const messages = this.prepareMessages(userMessage, existingTask);

    // Step 5: EXECUTE BASED ON EXPLICIT MODE
    try {
      if (this.config.mode === "stream") {
        this.logger.debug("Executing in STREAM mode", { taskId });
        await this.executeStreaming(taskId, contextId, messages, eventBus);
      } else {
        this.logger.debug("Executing in GENERATE mode", { taskId });
        await this.executeSimple(taskId, contextId, messages, eventBus);
      }
    } catch (error: unknown) {
      const errorMessage = this.getErrorMessage(error);
      this.logger.error("Error in task", { taskId, error: errorMessage });
      this.publishFailure(taskId, contextId, errorMessage, eventBus);
    } finally {
      // Clean up cancelled tasks
      this.cancelledTasks.delete(taskId);
    }
  }

  /**
   * GENERATE MODE: Blocking execution with single response (agent.generate())
   *
   * Mirrors AI SDK's generateText() function.
   * Calls agent.generate() and processes result once.
   * Can use generateArtifacts for post-completion artifact generation.
   */
  private async executeSimple(
    taskId: string,
    contextId: string,
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    eventBus: ExecutionEventBus
  ): Promise<void> {
    // Check for cancellation before calling agent
    if (this.cancelledTasks.has(taskId)) {
      this.publishCancellation(taskId, contextId, eventBus);
      return;
    }

    // Call the ToolLoopAgent (blocking)
    this.logger.debug("Calling agent.generate()", { taskId });

    // Convert A2A messages to AI SDK ModelMessage format
    // AI SDK's AgentCallParameters: when CALL_OPTIONS is `never`, don't include options property
    const aiMessages: ModelMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const result = await this.agent.generate({
      prompt: aiMessages,
    });

    // Check for cancellation after agent call
    if (this.cancelledTasks.has(taskId)) {
      this.publishCancellation(taskId, contextId, eventBus);
      return;
    }

    // Transform response if configured
    const transformed = this.config.transformResponse
      ? this.config.transformResponse(result)
      : result;

    // Extract text from transformed result
    const responseText = typeof transformed === "string" ? transformed : transformed.text;

    this.logger.debug("Agent responded", {
      taskId,
      responseLength: responseText.length,
    });

    // Parse task state from response if configured
    const taskState = this.config.parseTaskState
      ? this.config.parseTaskState(responseText) || "completed"
      : "completed";

    this.logger.debug("Final task state", { taskId, state: taskState });

    // Generate artifacts if configured (async artifact generation)
    if (this.config.generateArtifacts) {
      this.logger.debug("Generating artifacts asynchronously", { taskId });
      try {
        const artifacts = await this.config.generateArtifacts({
          taskId,
          contextId,
          responseText,
        });

        // Emit each generated artifact
        for (const artifact of artifacts) {
          this.logger.debug("Emitting generated artifact", {
            taskId,
            artifactId: artifact.artifactId,
            name: artifact.name,
          });

          const artifactEvent: TaskArtifactUpdateEvent = {
            kind: "artifact-update",
            taskId,
            contextId,
            artifact,
          };

          eventBus.publish(artifactEvent);
        }

        this.logger.debug("Artifacts generated successfully", {
          taskId,
          count: artifacts.length,
        });
      } catch (error: unknown) {
        const errorMessage = this.getErrorMessage(error);
        this.logger.error("Error generating artifacts", { taskId, error: errorMessage });
        // Don't fail the task - just log the error and continue
      }
    }

    // Publish final status update
    const finalUpdate: TaskStatusUpdateEvent = {
      kind: "status-update",
      taskId: taskId,
      contextId: contextId,
      status: {
        state: taskState,
        message: {
          kind: "message",
          role: "agent",
          messageId: uuidv4(),
          parts: [{ kind: "text", text: responseText || "Completed." }],
          taskId: taskId,
          contextId: contextId,
        },
        timestamp: new Date().toISOString(),
      },
      final: true,
    };
    eventBus.publish(finalUpdate);
    this.logger.info("Task completed", { taskId, state: taskState });
  }

  /**
   * STREAM MODE: Incremental execution with real-time updates (agent.stream())
   *
   * Mirrors AI SDK's streamText() function.
   * Calls agent.stream() and processes chunks incrementally.
   *
   * Features:
   * - Text streaming (always enabled in stream mode)
   * - Incremental artifact parsing (if parseArtifacts configured)
   * - Post-completion artifacts (if generateArtifacts configured)
   */
  private async executeStreaming(
    taskId: string,
    contextId: string,
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    eventBus: ExecutionEventBus
  ): Promise<void> {
    // Call the ToolLoopAgent (streaming)
    this.logger.debug("Calling agent.stream()", { taskId });

    // Convert A2A messages to AI SDK ModelMessage format
    // AI SDK's AgentCallParameters: when CALL_OPTIONS is `never`, don't include options property
    const aiMessages: ModelMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const streamResult = await this.agent.stream({
      prompt: aiMessages,
    });

    const { textStream, text: responsePromise } = streamResult;

    let accumulatedText = "";
    const artifactContents = new Map<string, string>();
    const artifactOrder: string[] = [];
    let emittedArtifactCount = 0;

    // Process chunks incrementally
    for await (const chunk of textStream) {
      accumulatedText += chunk;

      // Check for cancellation
      if (this.cancelledTasks.has(taskId)) {
        this.logger.info("Request cancelled", { taskId });
        this.publishCancellation(taskId, contextId, eventBus);
        return;
      }

      // Stream text chunk to client (always enabled in stream mode)
      if (chunk.trim()) {
        const textUpdate: TaskStatusUpdateEvent = {
          kind: "status-update",
          taskId: taskId,
          contextId: contextId,
          status: {
            state: "working",
            message: {
              kind: "message",
              role: "agent",
              messageId: uuidv4(),
              parts: [{ kind: "text", text: chunk }],
              taskId: taskId,
              contextId: contextId,
            },
            timestamp: new Date().toISOString(),
          },
          final: false, // Non-final: more chunks coming
        };
        eventBus.publish(textUpdate);

        this.logger.debug("Streamed text chunk", {
          taskId,
          chunkLength: chunk.length,
        });
      }

      // Parse artifacts from accumulated text
      const parsed = this.config.parseArtifacts?.(accumulatedText);

      // Process completed artifacts
      if (!parsed) continue;

      for (const artifact of parsed.artifacts) {
        if (artifact.done && artifact.filename) {
          const previousContent = artifactContents.get(artifact.filename);
          const currentContent = artifact.content.trim();

          // Only emit if content changed
          if (previousContent !== currentContent) {
            artifactContents.set(artifact.filename, currentContent);

            // Track order
            if (!artifactOrder.includes(artifact.filename)) {
              artifactOrder.push(artifact.filename);
            }

            // Emit artifact update
            const artifactUpdate: TaskArtifactUpdateEvent = {
              kind: "artifact-update",
              taskId: taskId,
              contextId: contextId,
              artifact: {
                artifactId: `${taskId}-${artifact.filename}`,
                name: artifact.filename,
                parts: [
                  {
                    kind: "text" as const,
                    text: currentContent,
                  },
                ],
              },
            };
            eventBus.publish(artifactUpdate);
            emittedArtifactCount++;

            this.logger.debug("Emitted artifact", {
              taskId,
              filename: artifact.filename,
              size: currentContent.length,
            });
          }
        }
      }
    }

    // Check cancellation one last time
    if (this.cancelledTasks.has(taskId)) {
      this.publishCancellation(taskId, contextId, eventBus);
      return;
    }

    // Parse final result for any remaining artifacts
    const fullResponse = await responsePromise;
    const finalParsed = this.config.parseArtifacts?.(accumulatedText);

    if (!finalParsed) {
      // No artifacts to process, publish simple completion
      const finalUpdate: TaskStatusUpdateEvent = {
        kind: "status-update",
        taskId: taskId,
        contextId: contextId,
        status: {
          state: "completed",
          message: {
            kind: "message",
            role: "agent",
            messageId: uuidv4(),
            parts: [{ kind: "text", text: fullResponse }],
            taskId: taskId,
            contextId: contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: true,
      };
      eventBus.publish(finalUpdate);
      this.logger.info("Task completed (no artifacts)", { taskId });
      return;
    }

    for (const artifact of finalParsed.artifacts) {
      if (artifact.filename) {
        const previousContent = artifactContents.get(artifact.filename);
        const currentContent = artifact.content.trim();

        if (previousContent !== currentContent) {
          artifactContents.set(artifact.filename, currentContent);

          if (!artifactOrder.includes(artifact.filename)) {
            artifactOrder.push(artifact.filename);
          }

          const artifactUpdate: TaskArtifactUpdateEvent = {
            kind: "artifact-update",
            taskId: taskId,
            contextId: contextId,
            artifact: {
              artifactId: `${taskId}-${artifact.filename}`,
              name: artifact.filename,
              parts: [
                {
                  kind: "text" as const,
                  text: currentContent,
                },
              ],
            },
          };
          eventBus.publish(artifactUpdate);
          emittedArtifactCount++;

          this.logger.debug("Final artifact", {
            taskId,
            filename: artifact.filename,
          });
        }
      }
    }

    // Build final message
    const finalMessageText = this.config.buildFinalMessage
      ? this.config.buildFinalMessage(
          finalParsed.artifacts,
          fullResponse,
          finalParsed.preamble,
          finalParsed.postamble
        )
      : this.buildDefaultFinalMessage(
          finalParsed.artifacts,
          accumulatedText,
          artifactOrder,
          emittedArtifactCount,
          finalParsed.preamble,
          finalParsed.postamble
        );

    // Publish final status
    const finalUpdate: TaskStatusUpdateEvent = {
      kind: "status-update",
      taskId: taskId,
      contextId: contextId,
      status: {
        state: "completed",
        message: {
          kind: "message",
          role: "agent",
          messageId: uuidv4(),
          parts: [{ kind: "text", text: finalMessageText.trim() }],
          taskId: taskId,
          contextId: contextId,
        },
        timestamp: new Date().toISOString(),
      },
      final: true,
    };
    eventBus.publish(finalUpdate);

    this.logger.info("Task completed with artifacts", {
      taskId,
      artifactCount: emittedArtifactCount,
    });
  }

  /**
   * Extract plain text from an A2A Message
   */
  private extractTextFromMessage(message: Message): string {
    const textParts = message.parts.filter(
      (part): part is Extract<typeof part, { kind: "text" }> => part.kind === "text"
    );
    return textParts.map((part) => ("text" in part ? part.text : "")).join("\n");
  }

  /**
   * Prepare messages for agent invocation
   */
  private prepareMessages(
    userMessage: Message,
    existingTask?: Task
  ): Array<{ role: "user" | "assistant"; content: string }> {
    // Build history if configured
    const historyForLLM =
      this.config.includeHistory && existingTask?.history ? [...existingTask.history] : [];

    // Add current message if not already in history
    if (!historyForLLM.find((m) => m.messageId === userMessage.messageId)) {
      historyForLLM.push(userMessage);
    }

    // Convert to AI SDK format
    return historyForLLM
      .map((m) => {
        const content = this.extractTextFromMessage(m);
        if (!content) return null;

        return {
          role: (m.role === "agent" ? "assistant" : "user") as "user" | "assistant",
          content,
        };
      })
      .filter((m): m is { role: "user" | "assistant"; content: string } => m !== null);
  }

  /**
   * Publish "working" status update
   */
  private publishWorkingStatus(
    taskId: string,
    contextId: string,
    eventBus: ExecutionEventBus
  ): void {
    const workingStatusUpdate: TaskStatusUpdateEvent = {
      kind: "status-update",
      taskId: taskId,
      contextId: contextId,
      status: {
        state: "working",
        message: {
          kind: "message",
          role: "agent",
          messageId: uuidv4(),
          parts: [{ kind: "text", text: this.config.workingMessage }],
          taskId: taskId,
          contextId: contextId,
        },
        timestamp: new Date().toISOString(),
      },
      final: false,
    };
    eventBus.publish(workingStatusUpdate);
    this.logger.debug("Task status: working", { taskId });
  }

  /**
   * Publish a failure status update
   */
  private publishFailure(
    taskId: string,
    contextId: string,
    errorMessage: string,
    eventBus: ExecutionEventBus
  ): void {
    const failureUpdate: TaskStatusUpdateEvent = {
      kind: "status-update",
      taskId: taskId,
      contextId: contextId,
      status: {
        state: "failed",
        message: {
          kind: "message",
          role: "agent",
          messageId: uuidv4(),
          parts: [{ kind: "text", text: `Agent error: ${errorMessage}` }],
          taskId: taskId,
          contextId: contextId,
        },
        timestamp: new Date().toISOString(),
      },
      final: true,
    };
    eventBus.publish(failureUpdate);
    this.logger.error("Task failed", { taskId, error: errorMessage });
  }

  /**
   * Publish a cancellation status update
   */
  private publishCancellation(
    taskId: string,
    contextId: string,
    eventBus: ExecutionEventBus
  ): void {
    this.logger.info("Task cancelled", { taskId });
    const cancelledUpdate: TaskStatusUpdateEvent = {
      kind: "status-update",
      taskId: taskId,
      contextId: contextId,
      status: {
        state: "canceled",
        timestamp: new Date().toISOString(),
      },
      final: true,
    };
    eventBus.publish(cancelledUpdate);
  }

  /**
   * Extract error message from unknown error type
   *
   * Safely extracts error message without using 'any'.
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === "string") {
      return error;
    }
    if (error && typeof error === "object" && "message" in error) {
      return String(error.message);
    }
    return "Unknown error occurred";
  }

  /**
   * Default final message builder for streaming mode
   */
  private buildDefaultFinalMessage(
    _artifacts: ParsedArtifact[],
    fullResponse: string,
    artifactOrder: string[],
    emittedCount: number,
    preamble?: string,
    postamble?: string
  ): string {
    let finalMessageText = "";

    if (preamble) {
      finalMessageText = `${preamble}\n\n`;
    }

    if (emittedCount > 0) {
      finalMessageText += `Generated ${emittedCount} file${emittedCount > 1 ? "s" : ""}: ${artifactOrder.join(", ")}`;
    } else {
      finalMessageText += fullResponse;
    }

    if (postamble) {
      finalMessageText += `\n\n${postamble}`;
    }

    return finalMessageText;
  }
}
