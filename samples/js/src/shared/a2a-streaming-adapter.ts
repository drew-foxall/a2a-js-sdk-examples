/**
 * A2A Streaming Adapter - Specialized adapter for streaming with artifacts
 * 
 * This adapter extends the base A2AAgentAdapter to support:
 * - Real-time streaming of agent responses
 * - Incremental chunk processing
 * - Dynamic artifact emission (e.g., code files)
 * - File deduplication and ordering
 * 
 * Use this for agents that need to:
 * - Stream responses in real-time
 * - Emit artifacts as they're generated (not just at the end)
 * - Process chunks incrementally
 * 
 * Example: Coder Agent that emits code files as artifacts during streaming
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
 * Interface for parsed artifacts from streaming chunks
 */
export interface ParsedArtifact {
  filename?: string;
  language?: string;
  content: string;
  done: boolean;  // Is this artifact complete?
  metadata?: Record<string, any>;
}

export interface ParsedArtifacts {
  artifacts: ParsedArtifact[];
  preamble?: string;
  postamble?: string;
}

/**
 * Options for A2AStreamingAdapter
 */
export interface A2AStreamingAdapterOptions {
  /**
   * Function that yields text chunks from the agent
   * 
   * This function should:
   * - Accept the agent and messages
   * - Yield text chunks as they're generated
   * - Handle any streaming setup/teardown
   */
  streamFunction: (
    agent: ToolLoopAgent<any, any, any>,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  ) => AsyncGenerator<string>;

  /**
   * Function to parse artifacts from accumulated text
   * 
   * Called after each chunk to extract completed artifacts.
   * Should return all artifacts found so far (adapter handles deduplication).
   */
  parseArtifacts: (accumulatedText: string) => ParsedArtifacts;

  /**
   * Message to show while working
   * @default "Processing..."
   */
  workingMessage?: string;

  /**
   * Build final message from artifacts and response
   * @default Shows count of artifacts generated
   */
  buildFinalMessage?: (
    artifacts: ParsedArtifact[],
    fullResponse: string,
    preamble?: string,
    postamble?: string
  ) => string;

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean;
}

/**
 * A2A Streaming Adapter
 * 
 * Bridges ToolLoopAgent streaming to A2A protocol with artifact support.
 */
export class A2AStreamingAdapter implements AgentExecutor {
  private cancelledTasks = new Set<string>();

  constructor(
    private agent: ToolLoopAgent<any, any, any>,
    private options: A2AStreamingAdapterOptions
  ) {}

  public cancelTask = async (taskId: string, eventBus: ExecutionEventBus): Promise<void> => {
    this.cancelledTasks.add(taskId);
    if (this.options.debug) {
      console.log(`[A2AStreamingAdapter] Task ${taskId} marked for cancellation`);
    }
  };

  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    const { userMessage, task: existingTask } = requestContext;
    const taskId = existingTask?.id || uuidv4();
    const contextId = userMessage.contextId || existingTask?.contextId || uuidv4();

    if (this.options.debug) {
      console.log(
        `[A2AStreamingAdapter] Processing message ${userMessage.messageId} for task ${taskId}`
      );
    }

    // 1. Publish initial Task event if new
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
    }

    // 2. Publish "working" status
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
          parts: [{ kind: 'text', text: this.options.workingMessage || 'Processing...' }],
          taskId: taskId,
          contextId: contextId,
        },
        timestamp: new Date().toISOString(),
      },
      final: false,
    };
    eventBus.publish(workingStatusUpdate);

    // 3. Prepare messages for agent
    const historyForLLM = existingTask?.history ? [...existingTask.history] : [];
    if (!historyForLLM.find((m) => m.messageId === userMessage.messageId)) {
      historyForLLM.push(userMessage);
    }

    const messages = historyForLLM
      .map((m) => {
        const textParts = m.parts.filter(
          (p): p is TextPart => p.kind === 'text' && !!(p as TextPart).text
        );
        const text = textParts.map((p) => p.text).join('\n');
        return {
          role: (m.role === 'agent' ? 'assistant' : 'user') as 'user' | 'assistant',
          content: text,
        };
      })
      .filter((m) => m.content.length > 0);

    if (messages.length === 0) {
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
            parts: [{ kind: 'text', text: 'No input message found to process.' }],
            taskId: taskId,
            contextId: contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: true,
      };
      eventBus.publish(failureUpdate);
      return;
    }

    try {
      // 4. Stream response and process chunks
      const artifactContents = new Map<string, string>(); // Deduplicate by filename
      const artifactOrder: string[] = []; // Track order
      let accumulatedText = '';
      let emittedArtifactCount = 0;

      // Stream chunks
      for await (const chunk of this.options.streamFunction(this.agent, messages)) {
        accumulatedText += chunk;

        // Check if cancelled
        if (this.cancelledTasks.has(taskId)) {
          if (this.options.debug) {
            console.log(`[A2AStreamingAdapter] Request cancelled for task: ${taskId}`);
          }
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
          return;
        }

        // Parse artifacts from accumulated text
        const parsed = this.options.parseArtifacts(accumulatedText);

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

              if (this.options.debug) {
                console.log(
                  `[A2AStreamingAdapter] Emitted artifact: ${artifact.filename} (${currentContent.length} bytes)`
                );
              }
            }
          }
        }
      }

      // Check cancellation one last time
      if (this.cancelledTasks.has(taskId)) {
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
        return;
      }

      // 5. Parse final result for any remaining artifacts
      const finalParsed = this.options.parseArtifacts(accumulatedText);
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

            if (this.options.debug) {
              console.log(`[A2AStreamingAdapter] Final artifact: ${artifact.filename}`);
            }
          }
        }
      }

      // 6. Build final message
      const finalMessageText = this.options.buildFinalMessage
        ? this.options.buildFinalMessage(
            finalParsed.artifacts,
            accumulatedText,
            finalParsed.preamble,
            finalParsed.postamble
          )
        : this.defaultFinalMessage(
            finalParsed.artifacts,
            accumulatedText,
            artifactOrder,
            emittedArtifactCount,
            finalParsed.preamble,
            finalParsed.postamble
          );

      // 7. Publish final status
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

      if (this.options.debug) {
        console.log(
          `[A2AStreamingAdapter] Task ${taskId} completed with ${emittedArtifactCount} artifacts.`
        );
      }
    } catch (error: any) {
      console.error(`[A2AStreamingAdapter] Error processing task ${taskId}:`, error);
      const errorUpdate: TaskStatusUpdateEvent = {
        kind: 'status-update',
        taskId: taskId,
        contextId: contextId,
        status: {
          state: 'failed',
          message: {
            kind: 'message',
            role: 'agent',
            messageId: uuidv4(),
            parts: [{ kind: 'text', text: `Agent error: ${error.message}` }],
            taskId: taskId,
            contextId: contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: true,
      };
      eventBus.publish(errorUpdate);
    }
  }

  /**
   * Default final message builder
   */
  private defaultFinalMessage(
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
}

