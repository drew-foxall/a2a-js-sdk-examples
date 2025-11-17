/**
 * Coder Agent (AI SDK + Hono version)
 * High-fidelity port of the original Genkit implementation
 * 
 * Features:
 * - Streaming code generation
 * - Multi-file output support
 * - Markdown code block parsing
 * - Artifact generation per file
 * - Preamble/postamble support
 */

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { streamText } from "ai";
import { v4 as uuidv4 } from "uuid";

import {
  AgentCard,
  Task,
  TaskArtifactUpdateEvent,
  TaskState,
  TaskStatusUpdateEvent,
  TextPart,
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
import { getModel } from "../shared/utils.js";
import { extractCodeBlocks, CODER_SYSTEM_PROMPT } from "./code-format.js";

/**
 * CoderAgentExecutor - Implements streaming code generation with artifacts
 */
class CoderAgentExecutor implements AgentExecutor {
  private cancelledTasks = new Set<string>();

  public cancelTask = async (
    taskId: string,
    eventBus: ExecutionEventBus
  ): Promise<void> => {
    this.cancelledTasks.add(taskId);
    // The execute loop is responsible for publishing the final state
  };

  async execute(
    requestContext: RequestContext,
    eventBus: ExecutionEventBus
  ): Promise<void> {
    const userMessage = requestContext.userMessage;
    const existingTask = requestContext.task;

    const taskId = existingTask?.id || uuidv4();
    const contextId = userMessage.contextId || existingTask?.contextId || uuidv4();

    console.log(
      `[CoderAgentExecutor] Processing message ${userMessage.messageId} for task ${taskId} (context: ${contextId})`
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
        artifacts: [], // Initialize artifacts array
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
          parts: [{ kind: "text", text: "Generating code..." }],
          taskId: taskId,
          contextId: contextId,
        },
        timestamp: new Date().toISOString(),
      },
      final: false,
    };
    eventBus.publish(workingStatusUpdate);

    // 3. Prepare messages for AI SDK
    const historyForLLM = existingTask?.history ? [...existingTask.history] : [];
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
          role: (m.role === "agent" ? "assistant" : "user") as "user" | "assistant",
          content: text,
        };
      })
      .filter((m) => m.content.length > 0);

    if (messages.length === 0) {
      console.warn(
        `[CoderAgentExecutor] No valid text messages found in history for task ${taskId}.`
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
            parts: [{ kind: "text", text: "No input message found to process." }],
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
      // 4. Stream the response (matches original generateStream)
      const { textStream, text: responsePromise } = streamText({
        model: getModel(),
        system: CODER_SYSTEM_PROMPT,
        messages,
      });

      const fileContents = new Map<string, string>(); // Stores latest content per file
      const fileOrder: string[] = []; // Store order of file appearance
      let emittedFileCount = 0;
      let accumulatedText = "";

      // 5. Process streaming chunks
      for await (const chunk of textStream) {
        accumulatedText += chunk;

        // Check if cancelled
        if (this.cancelledTasks.has(taskId)) {
          console.log(`[CoderAgentExecutor] Request cancelled for task: ${taskId}`);
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

        // Parse code blocks from accumulated text
        const parsed = extractCodeBlocks(accumulatedText);

        // Process completed files
        for (const file of parsed.files) {
          if (file.done && file.filename) {
            const previousContent = fileContents.get(file.filename);
            const currentContent = file.content.trim();

            // Only emit if content has changed
            if (previousContent !== currentContent) {
              fileContents.set(file.filename, currentContent);

              // Track file order for first appearance
              if (!fileOrder.includes(file.filename)) {
                fileOrder.push(file.filename);
              }

              // Emit artifact update
              const artifactUpdate: TaskArtifactUpdateEvent = {
                kind: "artifact-update",
                taskId: taskId,
                contextId: contextId,
                artifact: {
                  kind: "artifact",
                  index: fileOrder.indexOf(file.filename),
                  id: `${taskId}-${file.filename}`,
                  name: file.filename,
                  mimeType: "text/plain",
                  data: currentContent,
                  metadata: {
                    language: file.language || "plaintext",
                    preamble: file.preamble,
                  },
                },
              };
              eventBus.publish(artifactUpdate);
              emittedFileCount++;

              console.log(
                `[CoderAgentExecutor] Emitted artifact for file: ${file.filename} (${currentContent.length} bytes)`
              );
            }
          }
        }
      }

      // Wait for full response
      const fullResponse = await responsePromise;

      // Check if cancelled one last time
      if (this.cancelledTasks.has(taskId)) {
        console.log(`[CoderAgentExecutor] Request cancelled for task: ${taskId}`);
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

      // 6. Parse final result for any remaining files
      const finalParsed = extractCodeBlocks(fullResponse);
      for (const file of finalParsed.files) {
        if (file.filename) {
          const previousContent = fileContents.get(file.filename);
          const currentContent = file.content.trim();

          if (previousContent !== currentContent) {
            fileContents.set(file.filename, currentContent);

            if (!fileOrder.includes(file.filename)) {
              fileOrder.push(file.filename);
            }

            const artifactUpdate: TaskArtifactUpdateEvent = {
              kind: "artifact-update",
              taskId: taskId,
              contextId: contextId,
              artifact: {
                kind: "artifact",
                index: fileOrder.indexOf(file.filename),
                id: `${taskId}-${file.filename}`,
                name: file.filename,
                mimeType: "text/plain",
                data: currentContent,
                metadata: {
                  language: file.language || "plaintext",
                  preamble: file.preamble,
                },
              },
            };
            eventBus.publish(artifactUpdate);
            emittedFileCount++;

            console.log(
              `[CoderAgentExecutor] Final artifact for file: ${file.filename}`
            );
          }
        }
      }

      // 7. Build final message
      let finalMessageText = "";
      if (finalParsed.files[0]?.preamble) {
        finalMessageText = finalParsed.files[0].preamble + "\n\n";
      }
      if (emittedFileCount > 0) {
        finalMessageText += `Generated ${emittedFileCount} file${emittedFileCount > 1 ? "s" : ""}: ${fileOrder.join(", ")}`;
      } else {
        finalMessageText += fullResponse;
      }
      if (finalParsed.postamble) {
        finalMessageText += "\n\n" + finalParsed.postamble;
      }

      // 8. Publish final status
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

      console.log(
        `[CoderAgentExecutor] Task ${taskId} completed with ${emittedFileCount} files.`
      );
    } catch (error: any) {
      console.error(
        `[CoderAgentExecutor] Error processing task ${taskId}:`,
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

const coderAgentCard: AgentCard = {
  name: "Coder Agent (AI SDK)",
  description: "A code-writing agent that emits full code files as artifacts.",
  url: "http://localhost:41242/",
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
  defaultOutputModes: ["text", "artifact"],
  skills: [
    {
      id: "code_generation",
      name: "Code Generation",
      description: "Generate high-quality code files based on your requirements.",
      tags: ["coding", "programming", "development"],
      examples: [
        "Write a TypeScript function to calculate fibonacci numbers",
        "Create a React component for a todo list",
        "Build a REST API endpoint for user authentication",
        "Generate a Python script to scrape websites",
      ],
      inputModes: ["text"],
      outputModes: ["text", "artifact"],
    },
  ],
  supportsAuthenticatedExtendedCard: false,
};

// --- Server Setup ---

async function main() {
  const taskStore: TaskStore = new InMemoryTaskStore();
  const agentExecutor: AgentExecutor = new CoderAgentExecutor();

  const requestHandler = new DefaultRequestHandler(
    coderAgentCard,
    taskStore,
    agentExecutor
  );

  const app = new Hono();
  const appBuilder = new A2AHonoApp(requestHandler);
  appBuilder.setupRoutes(app);

  const PORT = Number(process.env.PORT) || 41242;
  console.log(`[CoderAgent] Server using AI SDK + Hono started on http://localhost:${PORT}`);
  console.log(`[CoderAgent] Agent Card: http://localhost:${PORT}/.well-known/agent-card.json`);
  console.log("[CoderAgent] Press Ctrl+C to stop the server");

  serve({
    fetch: app.fetch,
    port: PORT,
  });
}

main().catch(console.error);
