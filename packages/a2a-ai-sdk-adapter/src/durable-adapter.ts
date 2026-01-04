/**
 * Durable A2A Adapter
 *
 * Bridges Workflow DevKit durable workflows with the A2A protocol.
 * Unlike A2AAdapter (which wraps ToolLoopAgent), this adapter wraps
 * a durable workflow function and invokes it through the Workflow DevKit runtime.
 *
 * Architecture:
 * DurableA2AAdapter → start() → Workflow Runtime → World (persistence) → DurableAgent
 *
 * The durability stack consists of three layers working together:
 *
 * 1. **Workflow DevKit** (`workflow` package)
 *    - `"use workflow"` and `"use step"` directives
 *    - `start()` function to invoke workflows through the runtime
 *    - `getWritable()` for streaming output
 *
 * 2. **World** (persistence backend)
 *    - Stores run state, step results, events, hooks
 *    - Handles queue processing for async execution
 *    - Examples: `@workflow/world-vercel`, `@drew-foxall/upstash-workflow-world`
 *
 * 3. **DurableAgent** (`@drew-foxall/workflow-ai/agent`)
 *    - AI SDK integration for workflows
 *    - Uses `"use step"` internally for LLM calls
 *    - Must run inside a workflow context
 *
 * IMPORTANT: Calling a workflow function directly does NOT provide durability!
 * The workflow must be invoked via `start()` which triggers the World's persistence.
 *
 * Usage:
 * ```typescript
 * import { DurableA2AAdapter } from "@drew-foxall/a2a-ai-sdk-adapter/durable";
 * import { diceAgentWorkflow } from "a2a-agents/dice-agent/workflow";
 *
 * const executor = new DurableA2AAdapter(diceAgentWorkflow);
 * ```
 *
 * For workflows with additional parameters:
 * ```typescript
 * import { imageGeneratorWorkflow } from "a2a-agents/image-generator/workflow";
 *
 * const executor = new DurableA2AAdapter(imageGeneratorWorkflow, {
 *   workflowArgs: [env.OPENAI_API_KEY], // Additional args after messages
 * });
 * ```
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
import {
  type Logger,
  ConsoleLogger as SDKConsoleLogger,
  NoopLogger as SDKNoopLogger,
} from "@drew-foxall/a2a-js-sdk/server/hono";
import type { ModelMessage } from "ai";
import { v4 as uuidv4 } from "uuid";
// Import start from workflow/api for proper durable execution
import { start } from "workflow/api";

/**
 * Type for a durable workflow function
 *
 * Workflows must:
 * 1. Accept ModelMessage[] as first parameter
 * 2. Use "use workflow" directive
 * 3. Use DurableAgent from @drew-foxall/workflow-ai/agent internally
 * 4. Return { messages: ModelMessage[] }
 *
 * The workflow function also needs a `workflowId` property added by the SWC plugin.
 */
export type DurableWorkflowFn<TArgs extends unknown[] = []> = ((
  messages: ModelMessage[],
  ...args: TArgs
) => Promise<{ messages: ModelMessage[] }>) & {
  /** Added by the Workflow DevKit SWC plugin */
  workflowId?: string;
};

/**
 * Configuration options for DurableA2AAdapter
 */
export interface DurableA2AAdapterConfig<TArgs extends unknown[] = []> {
  /**
   * Additional arguments to pass to the workflow function (after messages)
   *
   * @example
   * // For imageGeneratorWorkflow(messages, apiKey):
   * workflowArgs: [env.OPENAI_API_KEY]
   *
   * // For travelPlannerWorkflow(messages, config):
   * workflowArgs: [{ agentUrls: [...], fallbacks: {...} }]
   */
  workflowArgs?: TArgs;

  /**
   * Whether to include conversation history in workflow calls.
   * @default false (stateless)
   */
  includeHistory?: boolean;

  /**
   * Parse task state from the final response text
   *
   * @param responseText - The agent's final text response
   * @returns The A2A task state, or undefined to use default ("completed")
   */
  parseTaskState?: (responseText: string) => TaskState | undefined;

  /**
   * Generate artifacts after workflow completion
   *
   * Called once with the complete response text after workflow finishes.
   *
   * @param context - Context with taskId, contextId, and responseText
   * @returns Promise resolving to array of A2A artifacts
   */
  generateArtifacts?: (context: {
    taskId: string;
    contextId: string;
    responseText: string;
  }) => Promise<Artifact[]>;

  /**
   * Whether to enable debug logging
   * @default false
   */
  debug?: boolean;

  /**
   * Custom logger implementation
   */
  logger?: Logger;
}

/**
 * DurableA2AAdapter - Bridges durable workflows with A2A protocol
 *
 * This adapter wraps a Workflow DevKit workflow function and exposes it
 * as an A2A AgentExecutor. The workflow is invoked via `start()` from
 * `workflow/api` to ensure proper durability through the configured World.
 *
 * The durability stack:
 * - `start()` triggers the Workflow DevKit runtime
 * - The runtime uses the configured World for persistence
 * - `DurableAgent` inside the workflow uses `"use step"` for LLM calls
 * - Step results are cached and retried by the World
 *
 * @template TArgs - Additional arguments type for the workflow function
 */
export class DurableA2AAdapter<TArgs extends unknown[] = []> implements AgentExecutor {
  private cancelledTasks = new Set<string>();
  private logger: Logger;
  private config: Required<
    Omit<
      DurableA2AAdapterConfig<TArgs>,
      "parseTaskState" | "generateArtifacts" | "logger" | "workflowArgs"
    >
  > &
    Pick<DurableA2AAdapterConfig<TArgs>, "parseTaskState" | "generateArtifacts" | "workflowArgs">;

  constructor(
    private workflow: DurableWorkflowFn<TArgs>,
    config: DurableA2AAdapterConfig<TArgs> = {}
  ) {
    this.config = {
      includeHistory: config.includeHistory ?? false,
      debug: config.debug ?? false,
      // Optional configs
      workflowArgs: config.workflowArgs,
      parseTaskState: config.parseTaskState,
      generateArtifacts: config.generateArtifacts,
    };

    this.logger = config.logger ?? (this.config.debug ? SDKConsoleLogger.create() : SDKNoopLogger);

    // Validate that the workflow has been transformed by the SWC plugin
    if (!this.workflow.workflowId) {
      this.logger.warn(
        "Workflow function does not have workflowId - ensure Workflow DevKit SWC plugin is configured"
      );
    }
  }

  /**
   * Cancel a running task
   */
  public cancelTask = async (taskId: string, _eventBus: ExecutionEventBus): Promise<void> => {
    this.cancelledTasks.add(taskId);
    this.logger.info(`Task ${taskId} marked for cancellation`, { taskId });
  };

  /**
   * Execute an A2A request using the durable workflow
   */
  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    const { userMessage, task: existingTask } = requestContext;

    // Determine IDs for the task and context
    const taskId = existingTask?.id ?? uuidv4();
    const contextId = userMessage.contextId ?? existingTask?.contextId ?? uuidv4();

    this.logger.debug("Processing message with durable workflow", {
      messageId: userMessage.messageId,
      taskId,
      contextId,
      workflowId: this.workflow.workflowId,
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
        artifacts: [],
      };
      eventBus.publish(initialTask);
      this.logger.debug("Published initial task", { taskId });
    }

    // Step 2: Publish "working" status update
    this.publishWorkingStatus(taskId, contextId, eventBus);

    // Step 3: Extract user prompt and build message history
    const userPrompt = this.extractTextFromMessage(userMessage);

    if (!userPrompt) {
      this.logger.warn("No text found in message", { messageId: userMessage.messageId });
      this.publishFailure(taskId, contextId, "No message text to process", eventBus);
      return;
    }

    // Step 4: Prepare messages for workflow
    const messages = this.prepareMessages(userMessage, existingTask);

    // Step 5: Execute the durable workflow via start()
    try {
      await this.executeWorkflow(taskId, contextId, messages, eventBus);
    } catch (error: unknown) {
      const errorMessage = this.getErrorMessage(error);
      this.logger.error("Error in durable workflow", {
        taskId,
        error: this.toLogContextError(error),
      });
      this.publishFailure(taskId, contextId, errorMessage, eventBus);
    } finally {
      this.cancelledTasks.delete(taskId);
    }
  }

  /**
   * Execute the durable workflow using start() from workflow/api
   *
   * This is critical for durability - using start() ensures the workflow
   * runs through the Workflow DevKit runtime, which:
   * 1. Creates a run record in the World
   * 2. Queues the workflow for execution
   * 3. Persists step results for caching/retry
   * 4. Provides observability via traces
   */
  private async executeWorkflow(
    taskId: string,
    contextId: string,
    messages: ModelMessage[],
    eventBus: ExecutionEventBus
  ): Promise<void> {
    // Check for cancellation before starting
    if (this.cancelledTasks.has(taskId)) {
      this.publishCancellation(taskId, contextId, eventBus);
      return;
    }

    this.logger.debug("Starting durable workflow via start()", {
      taskId,
      workflowId: this.workflow.workflowId,
    });

    // Build the arguments array for the workflow
    // First argument is always messages, followed by any additional args
    const args = this.config.workflowArgs ?? ([] as unknown as TArgs);

    // Start the workflow through the Workflow DevKit runtime
    // This is what triggers the World's persistence mechanisms
    const run = await start(this.workflow, [messages, ...args] as [ModelMessage[], ...TArgs]);

    this.logger.debug("Workflow run started", {
      taskId,
      runId: run.runId,
      workflowId: this.workflow.workflowId,
    });

    // Wait for the workflow to complete and get the result
    // The Run class uses `returnValue` to poll until the workflow completes
    const result = await run.returnValue;

    // Check for cancellation after workflow completion
    if (this.cancelledTasks.has(taskId)) {
      this.publishCancellation(taskId, contextId, eventBus);
      return;
    }

    // Extract the response text from the workflow result
    const responseText = this.extractResponseText(result.messages);

    this.logger.debug("Workflow completed", {
      taskId,
      runId: run.runId,
      responseLength: responseText.length,
    });

    // Parse task state from response if configured
    const taskState = this.config.parseTaskState
      ? (this.config.parseTaskState(responseText) ?? "completed")
      : "completed";

    // Generate artifacts if configured
    if (this.config.generateArtifacts) {
      this.logger.debug("Generating artifacts", { taskId });
      try {
        const artifacts = await this.config.generateArtifacts({
          taskId,
          contextId,
          responseText,
        });

        for (const artifact of artifacts) {
          const artifactEvent: TaskArtifactUpdateEvent = {
            kind: "artifact-update",
            taskId,
            contextId,
            artifact,
          };
          eventBus.publish(artifactEvent);
        }

        this.logger.debug("Artifacts generated", {
          taskId,
          count: artifacts.length,
        });
      } catch (error: unknown) {
        this.logger.error("Error generating artifacts", {
          taskId,
          error: this.toLogContextError(error),
        });
        // Don't fail the task - just log the error
      }
    }

    // Publish final status update
    const finalUpdate: TaskStatusUpdateEvent = {
      kind: "status-update",
      taskId,
      contextId,
      status: {
        state: taskState,
        message: {
          kind: "message",
          role: "agent",
          messageId: uuidv4(),
          parts: [{ kind: "text", text: responseText || "Completed." }],
          taskId,
          contextId,
        },
        timestamp: new Date().toISOString(),
      },
      final: true,
    };
    eventBus.publish(finalUpdate);
    this.logger.info("Durable workflow completed", {
      taskId,
      runId: run.runId,
      state: taskState,
    });
  }

  /**
   * Extract response text from the workflow's output messages
   */
  private extractResponseText(messages: ModelMessage[]): string {
    // Find the last assistant message
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg && msg.role === "assistant") {
        // Handle different content types
        const content = msg.content;
        if (typeof content === "string") {
          return content;
        }
        if (Array.isArray(content)) {
          // Extract text from content parts
          const textParts = content
            .filter((part): part is { type: "text"; text: string } => {
              return (
                typeof part === "object" &&
                part !== null &&
                "type" in part &&
                part.type === "text" &&
                "text" in part
              );
            })
            .map((part) => part.text);
          return textParts.join("\n");
        }
      }
    }
    return "";
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
   * Prepare messages for workflow invocation
   */
  private prepareMessages(userMessage: Message, existingTask?: Task): ModelMessage[] {
    // Build history if configured
    const historyForLLM =
      this.config.includeHistory && existingTask?.history ? [...existingTask.history] : [];

    // Add current message if not already in history
    if (!historyForLLM.find((m) => m.messageId === userMessage.messageId)) {
      historyForLLM.push(userMessage);
    }

    // Convert to AI SDK ModelMessage format
    return historyForLLM
      .map((m): ModelMessage | null => {
        const content = this.extractTextFromMessage(m);
        if (!content) return null;

        return {
          role: m.role === "agent" ? "assistant" : "user",
          content,
        };
      })
      .filter((m): m is ModelMessage => m !== null);
  }

  /**
   * Publish "working" status update
   *
   * IMPORTANT: A2A Protocol Semantics
   * ---------------------------------
   * The "working" status indicates the agent is processing. Per A2A protocol:
   * - The `message` field in status updates is for conveying information
   * - However, when state is "working", any message content is a STATUS INDICATOR
   *   (e.g., "Processing your request..."), NOT part of the actual response
   * - Clients should display this differently (loading indicator, status bar)
   *
   * We intentionally DO NOT include a TextPart message here because:
   * 1. AI SDK accumulates all text-delta events - status messages would be
   *    concatenated with actual response content
   * 2. The "completed" state contains the authoritative response text
   * 3. Status indicators should be ephemeral, not part of conversation history
   *
   * See: docs/A2A_PROTOCOL_UNDERSTANDING.md for detailed explanation
   */
  private publishWorkingStatus(
    taskId: string,
    contextId: string,
    eventBus: ExecutionEventBus
  ): void {
    const workingStatusUpdate: TaskStatusUpdateEvent = {
      kind: "status-update",
      taskId,
      contextId,
      status: {
        state: "working",
        // NOTE: No message included - status text should not be accumulated
        // with response content. Clients show generic "working" indicator.
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
      taskId,
      contextId,
      status: {
        state: "failed",
        message: {
          kind: "message",
          role: "agent",
          messageId: uuidv4(),
          parts: [{ kind: "text", text: `Workflow error: ${errorMessage}` }],
          taskId,
          contextId,
        },
        timestamp: new Date().toISOString(),
      },
      final: true,
    };
    eventBus.publish(failureUpdate);
    this.logger.error("Task failed", {
      taskId,
      error: { name: "WorkflowError", message: errorMessage },
    });
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
      taskId,
      contextId,
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
   * Convert an unknown error to LogContextError format
   */
  private toLogContextError(error: unknown): { name: string; message: string; stack?: string } {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }
    return {
      name: "UnknownError",
      message: this.getErrorMessage(error),
    };
  }
}
