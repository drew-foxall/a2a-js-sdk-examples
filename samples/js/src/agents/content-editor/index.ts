/**
 * Content Editor Agent (AI SDK + Hono version)
 * High-fidelity port of the original Genkit implementation
 * 
 * Features:
 * - Content proof-reading and editing
 * - Grammar and style improvements
 * - Maintains user's voice
 */

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { generateText } from "ai";
import { v4 as uuidv4 } from "uuid";

import {
  AgentCard,
  Task,
  TaskStatusUpdateEvent,
  TextPart,
  Message,
} from "@drew-foxall/a2a-js-sdk";
import {
  InMemoryTaskStore,
  TaskStore,
  AgentExecutor,
  RequestContext,
  ExecutionEventBus,
  DefaultRequestHandler,
} from "@drew-foxall/a2a-js-sdk/server";
import { A2AHonoApp } from "@drew-foxall/a2a-js-sdk/server/hono";
import { getModel } from "../../shared/utils.js";
import { CONTENT_EDITOR_PROMPT } from "./prompt.js";

/**
 * ContentEditorAgentExecutor - Implements content editing logic
 */
class ContentEditorAgentExecutor implements AgentExecutor {
  private cancelledTasks = new Set<string>();

  public cancelTask = async (
    taskId: string,
    eventBus: ExecutionEventBus
  ): Promise<void> => {
    this.cancelledTasks.add(taskId);
  };

  async execute(
    requestContext: RequestContext,
    eventBus: ExecutionEventBus
  ): Promise<void> {
    const userMessage = requestContext.userMessage;
    const existingTask = requestContext.task;

    const taskId = existingTask?.id || uuidv4();
    const contextId =
      userMessage.contextId || existingTask?.contextId || uuidv4();

    console.log(
      `[ContentEditorAgentExecutor] Processing message ${userMessage.messageId} for task ${taskId} (context: ${contextId})`
    );

    // 1. Publish initial Task event if it's a new task
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
    }

    // 2. Publish "working" status update
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
          parts: [{ kind: "text", text: "Editing content..." }],
          taskId: taskId,
          contextId: contextId,
        },
        timestamp: new Date().toISOString(),
      },
      final: false,
    };
    eventBus.publish(workingStatusUpdate);

    // 3. Prepare messages for AI SDK
    const historyForLLM = existingTask?.history
      ? [...existingTask.history]
      : [];
    if (!historyForLLM.find((m) => m.messageId === userMessage.messageId)) {
      historyForLLM.push(userMessage);
    }

    const messages = historyForLLM
      .map((m) => {
        const textParts = m.parts.filter(
          (p): p is TextPart => p.kind === "text" && !!(p as TextPart).text
        );
        const text = textParts.map((p) => p.text).join("\n");

        return {
          role: (m.role === "agent" ? "assistant" : "user") as
            | "user"
            | "assistant",
          content: text,
        };
      })
      .filter((m) => m.content.length > 0);

    if (messages.length === 0) {
      console.warn(
        `[ContentEditorAgentExecutor] No valid text messages found in history for task ${taskId}.`
      );
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
            parts: [{ kind: "text", text: "No message found to process." }],
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
      // 4. Run the AI SDK to edit content
      const response = await generateText({
        model: getModel(),
        system: CONTENT_EDITOR_PROMPT,
        messages,
      });

      // Check if cancelled
      if (this.cancelledTasks.has(taskId)) {
        console.log(
          `[ContentEditorAgentExecutor] Request cancelled for task: ${taskId}`
        );

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
        return;
      }

      const responseText = response.text;

      // 5. Publish final status update
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
            parts: [{ kind: "text", text: responseText }],
            taskId: taskId,
            contextId: contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: true,
      };
      eventBus.publish(finalUpdate);

      console.log(
        `[ContentEditorAgentExecutor] Task ${taskId} completed successfully.`
      );
    } catch (error: any) {
      console.error(
        `[ContentEditorAgentExecutor] Error processing task ${taskId}:`,
        error
      );
      const errorUpdate: TaskStatusUpdateEvent = {
        kind: "status-update",
        taskId: taskId,
        contextId: contextId,
        status: {
          state: "failed",
          message: {
            kind: "message",
            role: "agent",
            messageId: uuidv4(),
            parts: [{ kind: "text", text: `Agent error: ${error.message}` }],
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
}

// --- Agent Card ---

const contentEditorAgentCard: AgentCard = {
  name: "Content Editor Agent (AI SDK)",
  description:
    "An agent that can proof-read and polish your content, improving clarity and style.",
  url: "http://localhost:41243/",
  provider: {
    organization: "A2A Samples (AI SDK Port)",
    url: "https://github.com/drew-foxall/a2a-js-sdk",
  },
  version: "1.0.0",
  protocolVersion: "0.3.0",
  capabilities: {
    streaming: true,
    pushNotifications: false,
    stateTransitionHistory: true,
  },
  defaultInputModes: ["text"],
  defaultOutputModes: ["text", "task-status"],
  skills: [
    {
      id: "content_editing",
      name: "Content Editing",
      description:
        "Proof-read and improve content for clarity, grammar, and style.",
      tags: ["editing", "proofreading", "content"],
      examples: [
        "Please review and improve this blog post",
        "Check this email for grammar and clarity",
        "Polish this product description",
        "Edit this article for better readability",
      ],
      inputModes: ["text"],
      outputModes: ["text", "task-status"],
    },
  ],
  supportsAuthenticatedExtendedCard: false,
};

// --- Server Setup ---

async function main() {
  const taskStore: TaskStore = new InMemoryTaskStore();
  const agentExecutor: AgentExecutor = new ContentEditorAgentExecutor();

  const requestHandler = new DefaultRequestHandler(
    contentEditorAgentCard,
    taskStore,
    agentExecutor
  );

  const app = new Hono();
  const appBuilder = new A2AHonoApp(requestHandler);
  appBuilder.setupRoutes(app);

  const PORT = Number(process.env.PORT) || 41243;
  console.log(
    `[ContentEditorAgent] Server using AI SDK + Hono started on http://localhost:${PORT}`
  );
  console.log(
    `[ContentEditorAgent] Agent Card: http://localhost:${PORT}/.well-known/agent-card.json`
  );
  console.log("[ContentEditorAgent] Press Ctrl+C to stop the server");

  serve({
    fetch: app.fetch,
    port: PORT,
  });
}

main().catch(console.error);

