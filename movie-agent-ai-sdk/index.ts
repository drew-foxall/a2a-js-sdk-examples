/**
 * Movie Info Agent (AI SDK + Hono version)
 * High-fidelity port of the original Genkit implementation
 * 
 * Features:
 * - TMDB API integration for movie and person searches
 * - Conversation history management
 * - Task state parsing (COMPLETED/AWAITING_USER_INPUT)
 * - Goal metadata support
 * - Multi-turn conversations
 */

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { generateText } from "ai";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

import {
  AgentCard,
  Task,
  TaskState,
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
import { getModel } from "../shared/utils.js";
import { searchMovies, searchPeople } from "./tmdb.js";
import { getMovieAgentPrompt } from "./prompt.js";

// Environment validation
if (!process.env.TMDB_API_KEY) {
  console.error("TMDB_API_KEY environment variable is required");
  process.exit(1);
}

// Conversation history store (matches original implementation)
const contexts: Map<string, Message[]> = new Map();

/**
 * AI SDK tools for TMDB integration
 */
const searchMoviesTool = {
  description: "search TMDB for movies by title",
  parameters: z.object({
    query: z.string().describe("The movie title to search for"),
  }),
  execute: async ({ query }: { query: string }) => {
    return await searchMovies(query);
  },
};

const searchPeopleTool = {
  description: "search TMDB for people by name",
  parameters: z.object({
    query: z.string().describe("The person name to search for"),
  }),
  execute: async ({ query }: { query: string }) => {
    return await searchPeople(query);
  },
};

/**
 * MovieAgentExecutor - Implements agent logic with conversation history
 */
class MovieAgentExecutor implements AgentExecutor {
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

    // Determine IDs for the task and context
    const taskId = existingTask?.id || uuidv4();
    const contextId = userMessage.contextId || existingTask?.contextId || uuidv4();

    console.log(
      `[MovieAgentExecutor] Processing message ${userMessage.messageId} for task ${taskId} (context: ${contextId})`
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
        history: [userMessage], // Start history with the current user message
        metadata: userMessage.metadata, // Carry over metadata from message if any
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
          parts: [{ kind: "text", text: "Processing your question, hang tight!" }],
          taskId: taskId,
          contextId: contextId,
        },
        timestamp: new Date().toISOString(),
      },
      final: false,
    };
    eventBus.publish(workingStatusUpdate);

    // 3. Prepare conversation history (matches original implementation)
    const historyForLLM = contexts.get(contextId) || [];
    if (!historyForLLM.find((m) => m.messageId === userMessage.messageId)) {
      historyForLLM.push(userMessage);
    }
    contexts.set(contextId, historyForLLM);

    // Convert A2A messages to AI SDK format
    const messages = historyForLLM
      .map((m) => {
        const textParts = m.parts.filter(
          (p): p is TextPart => p.kind === "text" && !!(p as TextPart).text
        );
        const text = textParts.map((p: TextPart) => p.text).join("\n");
        
        return {
          role: (m.role === "agent" ? "assistant" : "user") as "user" | "assistant",
          content: text,
        };
      })
      .filter((m) => m.content.length > 0);

    if (messages.length === 0) {
      console.warn(
        `[MovieAgentExecutor] No valid text messages found in history for task ${taskId}.`
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

    // Extract goal metadata (matches original)
    const goal = (existingTask?.metadata?.goal as string | undefined) || 
                 (userMessage.metadata?.goal as string | undefined);

    try {
      // 4. Run the AI SDK with tools (equivalent to Genkit prompt)
      const response = await generateText({
        model: getModel(),
        system: getMovieAgentPrompt(goal),
        messages,
        tools: {
          searchMovies: searchMoviesTool,
          searchPeople: searchPeopleTool,
        },
        maxSteps: 10, // Allow multiple tool calls
      });

      // Check if the request has been cancelled
      if (this.cancelledTasks.has(taskId)) {
        console.log(`[MovieAgentExecutor] Request cancelled for task: ${taskId}`);

        const cancelledUpdate: TaskStatusUpdateEvent = {
          kind: "status-update",
          taskId: taskId,
          contextId: contextId,
          status: {
            state: "canceled",
            timestamp: new Date().toISOString(),
          },
          final: true, // Cancellation is a final state
        };
        eventBus.publish(cancelledUpdate);
        return;
      }

      const responseText = response.text;
      console.info(`[MovieAgentExecutor] Prompt response: ${responseText}`);
      
      // 5. Parse the response for final state (matches original)
      const lines = responseText.trim().split("\n");
      const finalStateLine = lines.at(-1)?.trim().toUpperCase();
      const agentReplyText = lines.slice(0, lines.length - 1).join("\n").trim();

      let finalA2AState: TaskState = "unknown";

      if (finalStateLine === "COMPLETED") {
        finalA2AState = "completed";
      } else if (finalStateLine === "AWAITING_USER_INPUT") {
        finalA2AState = "input-required";
      } else {
        console.warn(
          `[MovieAgentExecutor] Unexpected final state line from prompt: ${finalStateLine}. Defaulting to 'completed'.`
        );
        finalA2AState = "completed"; // Default if LLM deviates
      }

      // 6. Publish final task status update
      const agentMessage: Message = {
        kind: "message",
        role: "agent",
        messageId: uuidv4(),
        parts: [{ kind: "text", text: agentReplyText || "Completed." }], // Ensure some text
        taskId: taskId,
        contextId: contextId,
      };
      historyForLLM.push(agentMessage);
      contexts.set(contextId, historyForLLM);

      const finalUpdate: TaskStatusUpdateEvent = {
        kind: "status-update",
        taskId: taskId,
        contextId: contextId,
        status: {
          state: finalA2AState,
          message: agentMessage,
          timestamp: new Date().toISOString(),
        },
        final: true,
      };
      eventBus.publish(finalUpdate);

      console.log(
        `[MovieAgentExecutor] Task ${taskId} finished with state: ${finalA2AState}`
      );
    } catch (error: any) {
      console.error(
        `[MovieAgentExecutor] Error processing task ${taskId}:`,
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

const movieAgentCard: AgentCard = {
  name: "Movie Agent (AI SDK)",
  description: "An agent that can answer questions about movies and actors using TMDB.",
  url: "http://localhost:41241/",
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
      id: "general_movie_chat",
      name: "General Movie Chat",
      description: "Answer general questions or chat about movies, actors, directors.",
      tags: ["movies", "actors", "directors"],
      examples: [
        "Tell me about the plot of Inception.",
        "Recommend a good sci-fi movie.",
        "Who directed The Matrix?",
        "What other movies has Scarlett Johansson been in?",
        "Find action movies starring Keanu Reeves",
        "Which came out first, Jurassic Park or Terminator 2?",
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
  const agentExecutor: AgentExecutor = new MovieAgentExecutor();

  const requestHandler = new DefaultRequestHandler(
    movieAgentCard,
    taskStore,
    agentExecutor
  );

  const app = new Hono();
  const appBuilder = new A2AHonoApp(requestHandler);
  appBuilder.setupRoutes(app);

  const PORT = Number(process.env.PORT) || 41241;
  console.log(`[MovieAgent] Server using AI SDK + Hono started on http://localhost:${PORT}`);
  console.log(`[MovieAgent] Agent Card: http://localhost:${PORT}/.well-known/agent-card.json`);
  console.log("[MovieAgent] Press Ctrl+C to stop the server");

  serve({
    fetch: app.fetch,
    port: PORT,
  });
}

main().catch(console.error);
