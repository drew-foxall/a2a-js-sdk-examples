/**
 * A2A Adapter - Automatic Unified Adapter
 * 
 * This adapter automatically adapts its behavior based on configuration:
 * - If `parseArtifacts` is configured → Streaming mode (incremental artifacts)
 * - Otherwise → Simple mode (blocking, single response)
 * 
 * NO manual mode selection required! The adapter detects what's needed.
 * 
 * Architecture:
 * ToolLoopAgent (AI SDK) → A2AAdapter (auto-detects mode) → A2A Server
 * 
 * Usage Examples:
 * 
 * // Content Editor (automatically simple mode)
 * const executor = new A2AAdapter(agent, {
 *   workingMessage: "Editing content...",
 * });
 * 
 * // Movie Agent (automatically simple mode with custom state)
 * const executor = new A2AAdapter(agent, {
 *   parseTaskState: (text) => text.includes('COMPLETED') ? 'completed' : 'input-required',
 *   includeHistory: true,
 * });
 * 
 * // Coder Agent (automatically streaming mode - detected from parseArtifacts)
 * const executor = new A2AAdapter(agent, {
 *   parseArtifacts: extractCodeBlocks,  // ← Triggers streaming automatically!
 *   workingMessage: "Generating code...",
 * });
 */

import { ToolLoopAgent } from 'ai';
import { v4 as uuidv4 } from 'uuid';
import {
  AgentExecutor,
  RequestContext,
  ExecutionEventBus,
  Task,
  TaskStatusUpdateEvent,
  TaskArtifactUpdateEvent,
  Message,
  TextPart,
  TaskState,
} from '@drew-foxall/a2a-js-sdk/server';

/**
 * Parsed artifact from streaming chunks
 */
export interface ParsedArtifact {
  filename?: string;
  language?: string;
  content: string;
  done: boolean;
  preamble?: string;
  metadata?: Record<string, any>;
}

export interface ParsedArtifacts {
  artifacts: ParsedArtifact[];
  preamble?: string;
  postamble?: string;
}

/**
 * Configuration options for A2AAdapter
 * 
 * The adapter automatically detects execution mode based on configuration:
 * - parseArtifacts present → Streaming mode
 * - parseArtifacts absent → Simple mode
 */
export interface A2AAdapterConfig {
  /**
   * STREAMING MODE TRIGGER
   * 
   * Function to parse artifacts from accumulated text.
   * If provided, adapter automatically uses streaming mode.
   * 
   * Called after each chunk to extract completed artifacts.
   * Should return all artifacts found so far (adapter handles deduplication).
   * 
   * @example
   * parseArtifacts: (text) => extractCodeBlocks(text)
   */
  parseArtifacts?: (accumulatedText: string) => ParsedArtifacts;

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
   * 
   * @param result - The raw agent generation result
   * @returns The transformed result with cleaned text
   * 
   * @example
   * transformResponse: (result) => {
   *   const lines = result.text.split('\n');
   *   return { ...result, text: lines.slice(0, -1).join('\n') };
   * }
   */
  transformResponse?: (result: any) => any;

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
   * Whether to log debug information
   * 
   * @default false
   */
  debug?: boolean;
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
 * - Debug logging
 */
export class A2AAdapter implements AgentExecutor {
  private cancelledTasks = new Set<string>();
  private config: Required<Omit<A2AAdapterConfig, 'parseArtifacts' | 'parseTaskState' | 'transformResponse' | 'buildFinalMessage'>> & 
    Pick<A2AAdapterConfig, 'parseArtifacts' | 'parseTaskState' | 'transformResponse' | 'buildFinalMessage'>;

  constructor(
    private agent: ToolLoopAgent<any, any, any>,
    config?: A2AAdapterConfig
  ) {
    // Set defaults for required options
    this.config = {
      includeHistory: config?.includeHistory ?? false,
      workingMessage: config?.workingMessage || 'Processing your request...',
      debug: config?.debug ?? false,
      // Optional configs
      parseArtifacts: config?.parseArtifacts,
      parseTaskState: config?.parseTaskState,
      transformResponse: config?.transformResponse,
      buildFinalMessage: config?.buildFinalMessage,
    };
  }

  /**
   * Cancel a running task
   */
  public cancelTask = async (
    taskId: string,
    eventBus: ExecutionEventBus
  ): Promise<void> => {
    this.cancelledTasks.add(taskId);
    this.log(`Task ${taskId} marked for cancellation`);
  };

  /**
   * Execute an A2A request using the wrapped ToolLoopAgent
   * 
   * AUTOMATIC MODE SELECTION:
   * Checks configuration to determine execution mode
   */
  async execute(
    requestContext: RequestContext,
    eventBus: ExecutionEventBus
  ): Promise<void> {
    const { userMessage, task: existingTask } = requestContext;

    // Determine IDs for the task and context
    const taskId = existingTask?.id || uuidv4();
    const contextId = userMessage.contextId || existingTask?.contextId || uuidv4();

    this.log(
      `Processing message ${userMessage.messageId} for task ${taskId} (context: ${contextId})`
    );

    // Step 1: Publish initial Task event if it's a new task
    if (!existingTask) {
      const initialTask: Task = {
        kind: 'task',
        id: taskId,
        contextId: contextId,
        status: {
          state: 'submitted',
          timestamp: new Date().toISOString(),
        },
        history: [userMessage],
        metadata: userMessage.metadata,
        artifacts: [], // Initialize artifacts array
      };
      eventBus.publish(initialTask);
      this.log(`Published initial task ${taskId}`);
    }

    // Step 2: Publish "working" status update
    this.publishWorkingStatus(taskId, contextId, eventBus);

    // Step 3: Extract user prompt from A2A message
    const userPrompt = this.extractTextFromMessage(userMessage);

    if (!userPrompt) {
      this.log(`No text found in message ${userMessage.messageId}`);
      this.publishFailure(taskId, contextId, 'No message text to process', eventBus);
      return;
    }

    // Step 4: Prepare message history
    const messages = this.prepareMessages(userMessage, existingTask);

    // Step 5: AUTOMATIC MODE DETECTION AND EXECUTION
    try {
      if (this.isStreamingMode()) {
        this.log(`Executing in STREAMING mode (artifacts configured)`);
        await this.executeStreaming(taskId, contextId, messages, eventBus);
      } else {
        this.log(`Executing in SIMPLE mode (no artifacts)`);
        await this.executeSimple(taskId, contextId, messages, eventBus);
      }
    } catch (error: any) {
      this.log(`Error in task ${taskId}: ${error.message}`, true);
      this.publishFailure(taskId, contextId, error.message, eventBus);
    } finally {
      // Clean up cancelled tasks
      this.cancelledTasks.delete(taskId);
    }
  }

  /**
   * AUTOMATIC MODE DETECTION
   * 
   * Returns true if streaming mode should be used.
   * Streaming mode is triggered by presence of parseArtifacts configuration.
   */
  private isStreamingMode(): boolean {
    return !!this.config.parseArtifacts;
  }

  /**
   * SIMPLE MODE: Blocking execution with single response
   * 
   * Used when no artifacts are configured.
   * Calls agent.generate() and processes result once.
   */
  private async executeSimple(
    taskId: string,
    contextId: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    eventBus: ExecutionEventBus
  ): Promise<void> {
    // Check for cancellation before calling agent
    if (this.cancelledTasks.has(taskId)) {
      this.publishCancellation(taskId, contextId, eventBus);
      return;
    }

    // Call the ToolLoopAgent (blocking)
    this.log(`Calling agent.generate() for task ${taskId}...`);
    const result = await this.agent.generate({
      prompt: messages[messages.length - 1]?.content || '',
      messages: messages.slice(0, -1),
      contextId, // Pass contextId for agents that support callOptionsSchema
    });

    // Check for cancellation after agent call
    if (this.cancelledTasks.has(taskId)) {
      this.publishCancellation(taskId, contextId, eventBus);
      return;
    }

    // Transform response if configured
    const transformedResult = this.config.transformResponse
      ? this.config.transformResponse(result)
      : result;

    const responseText = transformedResult.text || transformedResult;
    this.log(`Agent responded with ${responseText.length} characters`);

    // Parse task state from response if configured
    const taskState = this.config.parseTaskState
      ? this.config.parseTaskState(responseText) || 'completed'
      : 'completed';
    this.log(`Final task state: ${taskState}`);

    // Publish final status update
    const finalUpdate: TaskStatusUpdateEvent = {
      kind: 'status-update',
      taskId: taskId,
      contextId: contextId,
      status: {
        state: taskState,
        message: {
          kind: 'message',
          role: 'agent',
          messageId: uuidv4(),
          parts: [{ kind: 'text', text: responseText || 'Completed.' }],
          taskId: taskId,
          contextId: contextId,
        },
        timestamp: new Date().toISOString(),
      },
      final: true,
    };
    eventBus.publish(finalUpdate);
    this.log(`Task ${taskId} completed with state: ${taskState}`);
  }

  /**
   * STREAMING MODE: Incremental execution with artifact emission
   * 
   * Used when parseArtifacts is configured.
   * Calls agent.stream() and processes chunks incrementally.
   */
  private async executeStreaming(
    taskId: string,
    contextId: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    eventBus: ExecutionEventBus
  ): Promise<void> {
    // Call the ToolLoopAgent (streaming)
    this.log(`Calling agent.stream() for task ${taskId}...`);
    const { stream, text: responsePromise } = await this.agent.stream({
      prompt: messages[messages.length - 1]?.content || '',
      messages: messages.slice(0, -1),
      contextId,
    });

    let accumulatedText = '';
    const artifactContents = new Map<string, string>();
    const artifactOrder: string[] = [];
    let emittedArtifactCount = 0;

    // Process chunks incrementally
    for await (const chunk of stream) {
      accumulatedText += chunk.text;

      // Check for cancellation
      if (this.cancelledTasks.has(taskId)) {
        this.log(`Request cancelled for task: ${taskId}`);
        this.publishCancellation(taskId, contextId, eventBus);
        return;
      }

      // Parse artifacts from accumulated text
      const parsed = this.config.parseArtifacts!(accumulatedText);

      // Process completed artifacts
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
              kind: 'artifact-update',
              taskId: taskId,
              contextId: contextId,
              artifact: {
                kind: 'artifact',
                index: artifactOrder.indexOf(artifact.filename),
                id: `${taskId}-${artifact.filename}`,
                name: artifact.filename,
                mimeType: 'text/plain',
                data: currentContent,
                metadata: {
                  language: artifact.language || 'plaintext',
                  ...artifact.metadata,
                },
              },
            };
            eventBus.publish(artifactUpdate);
            emittedArtifactCount++;

            this.log(
              `Emitted artifact: ${artifact.filename} (${currentContent.length} bytes)`
            );
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
    const finalParsed = this.config.parseArtifacts!(accumulatedText);

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
            kind: 'artifact-update',
            taskId: taskId,
            contextId: contextId,
            artifact: {
              kind: 'artifact',
              index: artifactOrder.indexOf(artifact.filename),
              id: `${taskId}-${artifact.filename}`,
              name: artifact.filename,
              mimeType: 'text/plain',
              data: currentContent,
              metadata: {
                language: artifact.language || 'plaintext',
                ...artifact.metadata,
              },
            },
          };
          eventBus.publish(artifactUpdate);
          emittedArtifactCount++;

          this.log(`Final artifact: ${artifact.filename}`);
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
      kind: 'status-update',
      taskId: taskId,
      contextId: contextId,
      status: {
        state: 'completed',
        message: {
          kind: 'message',
          role: 'agent',
          messageId: uuidv4(),
          parts: [{ kind: 'text', text: finalMessageText.trim() }],
          taskId: taskId,
          contextId: contextId,
        },
        timestamp: new Date().toISOString(),
      },
      final: true,
    };
    eventBus.publish(finalUpdate);

    this.log(`Task ${taskId} completed with ${emittedArtifactCount} artifacts.`);
  }

  /**
   * Extract plain text from an A2A Message
   */
  private extractTextFromMessage(message: Message): string {
    const textParts = message.parts.filter(
      (p): p is TextPart => p.kind === 'text' && !!(p as TextPart).text
    );
    return textParts.map((p: TextPart) => p.text).join('\n');
  }

  /**
   * Prepare messages for agent invocation
   */
  private prepareMessages(
    userMessage: Message,
    existingTask?: Task
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    // Build history if configured
    const historyForLLM = this.config.includeHistory && existingTask?.history
      ? [...existingTask.history]
      : [];

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
          role: (m.role === 'agent' ? 'assistant' : 'user') as 'user' | 'assistant',
          content,
        };
      })
      .filter((m): m is { role: 'user' | 'assistant'; content: string } => m !== null);
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
      kind: 'status-update',
      taskId: taskId,
      contextId: contextId,
      status: {
        state: 'working',
        message: {
          kind: 'message',
          role: 'agent',
          messageId: uuidv4(),
          parts: [{ kind: 'text', text: this.config.workingMessage }],
          taskId: taskId,
          contextId: contextId,
        },
        timestamp: new Date().toISOString(),
      },
      final: false,
    };
    eventBus.publish(workingStatusUpdate);
    this.log(`Task ${taskId} status: working`);
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
      kind: 'status-update',
      taskId: taskId,
      contextId: contextId,
      status: {
        state: 'failed',
        message: {
          kind: 'message',
          role: 'agent',
          messageId: uuidv4(),
          parts: [{ kind: 'text', text: `Agent error: ${errorMessage}` }],
          taskId: taskId,
          contextId: contextId,
        },
        timestamp: new Date().toISOString(),
      },
      final: true,
    };
    eventBus.publish(failureUpdate);
  }

  /**
   * Publish a cancellation status update
   */
  private publishCancellation(
    taskId: string,
    contextId: string,
    eventBus: ExecutionEventBus
  ): void {
    this.log(`Task ${taskId} cancelled`);
    const cancelledUpdate: TaskStatusUpdateEvent = {
      kind: 'status-update',
      taskId: taskId,
      contextId: contextId,
      status: {
        state: 'canceled',
        timestamp: new Date().toISOString(),
      },
      final: true,
    };
    eventBus.publish(cancelledUpdate);
  }

  /**
   * Default final message builder for streaming mode
   */
  private buildDefaultFinalMessage(
    artifacts: ParsedArtifact[],
    fullResponse: string,
    artifactOrder: string[],
    emittedCount: number,
    preamble?: string,
    postamble?: string
  ): string {
    let finalMessageText = '';

    if (preamble) {
      finalMessageText = preamble + '\n\n';
    }

    if (emittedCount > 0) {
      finalMessageText += `Generated ${emittedCount} file${emittedCount > 1 ? 's' : ''}: ${artifactOrder.join(', ')}`;
    } else {
      finalMessageText += fullResponse;
    }

    if (postamble) {
      finalMessageText += '\n\n' + postamble;
    }

    return finalMessageText;
  }

  /**
   * Log debug information
   */
  private log(message: string, isError: boolean = false): void {
    if (!this.config.debug) return;

    const prefix = '[A2AAdapter]';
    if (isError) {
      console.error(`${prefix} ${message}`);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }
}
