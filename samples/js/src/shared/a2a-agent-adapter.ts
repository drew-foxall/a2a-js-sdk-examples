/**
 * A2A Agent Adapter
 * 
 * Adapts AI SDK ToolLoopAgent instances to work with the A2A protocol.
 * 
 * This enables:
 * - Protocol-agnostic agents (same agent, multiple protocols)
 * - Reusable agent logic (use in A2A, MCP, REST, CLI, tests)
 * - Separation of concerns (agent logic vs protocol integration)
 * 
 * Architecture:
 * ToolLoopAgent (AI SDK) → A2AAgentAdapter → A2A Server
 * 
 * Usage:
 * ```typescript
 * import { ToolLoopAgent } from 'ai';
 * import { A2AAgentAdapter } from './shared/a2a-agent-adapter.js';
 * 
 * const myAgent = new ToolLoopAgent({
 *   model: 'openai/gpt-4o',
 *   instructions: 'You are a helpful assistant',
 * });
 * 
 * const executor = new A2AAgentAdapter(myAgent);
 * 
 * const requestHandler = new DefaultRequestHandler(
 *   agentCard,
 *   taskStore,
 *   executor
 * );
 * ```
 */

import { v4 as uuidv4 } from "uuid";
import {
  AgentExecutor,
  RequestContext,
  ExecutionEventBus,
} from "@drew-foxall/a2a-js-sdk/server";
import {
  Task,
  TaskState,
  TaskStatusUpdateEvent,
  TextPart,
  Message,
} from "@drew-foxall/a2a-js-sdk";

/**
 * AI SDK ToolLoopAgent interface (minimal, for typing)
 * TODO: Import from 'ai' package when we upgrade to v6
 */
export interface ToolLoopAgentLike {
  generate(params: {
    prompt: string;
    messages?: Array<{ role: "user" | "assistant"; content: string }>;
    options?: any;
  }): Promise<{
    text: string;
    steps?: any[];
    [key: string]: any;
  }>;

  stream?(params: {
    prompt: string;
    messages?: Array<{ role: "user" | "assistant"; content: string }>;
    options?: any;
  }): Promise<{
    textStream: AsyncIterable<string>;
    text: Promise<string>;
    [key: string]: any;
  }>;
}

/**
 * Configuration options for A2AAgentAdapter
 */
export interface A2AAgentAdapterOptions {
  /**
   * Optional function to parse task state from agent response text.
   * Some agents may output special state indicators (e.g., "COMPLETED", "AWAITING_USER_INPUT").
   * 
   * @param responseText - The agent's text response
   * @returns The A2A task state, or undefined to use default ("completed")
   * 
   * @example
   * parseTaskState: (text) => {
   *   const lastLine = text.trim().split('\n').at(-1);
   *   if (lastLine === 'AWAITING_USER_INPUT') return 'input-required';
   *   if (lastLine === 'COMPLETED') return 'completed';
   *   return 'completed'; // default
   * }
   */
  parseTaskState?: (responseText: string) => TaskState | undefined;

  /**
   * Optional function to transform agent response before creating A2A message.
   * Useful for extracting final text when agent includes metadata.
   * 
   * @param result - The raw agent generation result
   * @returns The text to include in the A2A message
   * 
   * @example
   * transformResponse: (result) => {
   *   // Remove last line if it's a state indicator
   *   const lines = result.text.split('\n');
   *   return lines.slice(0, -1).join('\n');
   * }
   */
  transformResponse?: (result: any) => string;

  /**
   * Whether to include conversation history in agent calls.
   * If true, adapter will extract and pass message history.
   * Default: false (stateless)
   */
  includeHistory?: boolean;

  /**
   * Working status message to show while agent is processing.
   * Default: "Processing your request..."
   */
  workingMessage?: string;

  /**
   * Whether to log debug information
   * Default: true
   */
  debug?: boolean;
}

/**
 * A2AAgentAdapter
 * 
 * Generic adapter that bridges AI SDK ToolLoopAgent with A2A protocol.
 * Handles the complete A2A task lifecycle:
 * 1. Task creation (if new)
 * 2. Working status update
 * 3. Agent invocation
 * 4. Result transformation
 * 5. Final status update (completed/failed)
 * 
 * This adapter allows ToolLoopAgent instances to be exposed via A2A protocol
 * while keeping agent logic completely protocol-agnostic.
 */
export class A2AAgentAdapter implements AgentExecutor {
  private cancelledTasks = new Set<string>();
  private options: Required<A2AAgentAdapterOptions>;

  constructor(
    private agent: ToolLoopAgentLike,
    options?: A2AAgentAdapterOptions
  ) {
    // Set defaults
    this.options = {
      parseTaskState: options?.parseTaskState || (() => "completed"),
      transformResponse: options?.transformResponse || ((result) => result.text),
      includeHistory: options?.includeHistory ?? false,
      workingMessage: options?.workingMessage || "Processing your request...",
      debug: options?.debug ?? true,
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
    // The execute loop is responsible for publishing the final state
  };

  /**
   * Execute an A2A request using the wrapped ToolLoopAgent
   */
  async execute(
    requestContext: RequestContext,
    eventBus: ExecutionEventBus
  ): Promise<void> {
    const userMessage = requestContext.userMessage;
    const existingTask = requestContext.task;

    // Determine IDs for the task and context
    const taskId = existingTask?.id || uuidv4();
    const contextId = userMessage.contextId || existingTask?.contextId || uuidv4();

    this.log(
      `Processing message ${userMessage.messageId} for task ${taskId} (context: ${contextId})`
    );

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
      };
      eventBus.publish(initialTask);
      this.log(`Published initial task ${taskId}`);
    }

    // Step 2: Publish "working" status update
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
          parts: [{ kind: "text", text: this.options.workingMessage }],
          taskId: taskId,
          contextId: contextId,
        },
        timestamp: new Date().toISOString(),
      },
      final: false,
    };
    eventBus.publish(workingStatusUpdate);
    this.log(`Task ${taskId} status: working`);

    // Step 3: Extract user prompt from A2A message
    const userPrompt = this.extractTextFromMessage(userMessage);
    
    if (!userPrompt) {
      this.log(`No text found in message ${userMessage.messageId}`);
      this.publishFailure(taskId, contextId, "No message text to process", eventBus);
      return;
    }

    // Step 4: Prepare message history if configured
    let messages: Array<{ role: "user" | "assistant"; content: string }> | undefined;
    
    if (this.options.includeHistory && existingTask?.history) {
      messages = this.convertHistoryToMessages(existingTask.history);
      this.log(`Including ${messages.length} history messages`);
    }

    try {
      // Step 5: Check for cancellation before calling agent
      if (this.cancelledTasks.has(taskId)) {
        this.publishCancellation(taskId, contextId, eventBus);
        return;
      }

      // Step 6: Prepare call options (for agents with callOptionsSchema)
      // Merge contextId with any metadata from task or message
      const callOptions = {
        contextId,
        ...(existingTask?.metadata || {}),
        ...(userMessage.metadata || {}),
      };
      this.log(`Call options: ${JSON.stringify(callOptions)}`);

      // Step 7: Call the ToolLoopAgent
      this.log(`Calling agent for task ${taskId}...`);
      const result = await this.agent.generate({
        prompt: userPrompt,
        messages,
        ...callOptions, // Spread call options at top level for AI SDK v6
      });

      // Step 8: Check for cancellation after agent call
      if (this.cancelledTasks.has(taskId)) {
        this.publishCancellation(taskId, contextId, eventBus);
        return;
      }

      // Step 9: Transform response text
      const responseText = this.options.transformResponse(result);
      this.log(`Agent responded with ${responseText.length} characters`);

      // Step 10: Parse task state from response (if custom parser provided)
      const taskState = this.options.parseTaskState(responseText) || "completed";
      this.log(`Final task state: ${taskState}`);

      // Step 11: Publish final status update
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
      this.log(`Task ${taskId} completed with state: ${taskState}`);

    } catch (error: any) {
      this.log(`Error in task ${taskId}: ${error.message}`, true);
      this.publishFailure(taskId, contextId, error.message, eventBus);
    } finally {
      // Clean up cancelled tasks
      this.cancelledTasks.delete(taskId);
    }
  }

  /**
   * Extract plain text from an A2A Message
   */
  private extractTextFromMessage(message: Message): string {
    const textParts = message.parts.filter(
      (p): p is TextPart => p.kind === "text" && !!(p as TextPart).text
    );
    return textParts.map((p: TextPart) => p.text).join("\n");
  }

  /**
   * Convert A2A message history to AI SDK message format
   */
  private convertHistoryToMessages(
    history: Message[]
  ): Array<{ role: "user" | "assistant"; content: string }> {
    return history
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
   * Log debug information
   */
  private log(message: string, isError: boolean = false): void {
    if (!this.options.debug) return;
    
    const prefix = "[A2AAgentAdapter]";
    if (isError) {
      console.error(`${prefix} ${message}`);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }
}

