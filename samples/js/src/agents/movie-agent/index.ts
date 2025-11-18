/**
 * Movie Info Agent (AI SDK v6 + A2AAgentAdapter)
 * 
 * PHASE 3 MIGRATION: Refactored to use ToolLoopAgent + A2AAgentAdapter
 * 
 * Features:
 * - TMDB API integration (searchMovies, searchPeople)
 * - Conversation history management (contextId-based)
 * - Task state parsing (COMPLETED/AWAITING_USER_INPUT)
 * - Goal metadata support
 * - Multi-turn conversations
 * 
 * Architecture: AI SDK Agent + A2A Adapter Pattern (Advanced)
 * -----------------------------------------------------------
 * This agent demonstrates the full power of the adapter pattern:
 * 
 * 1. AI Agent (ToolLoopAgent):
 *    - callOptionsSchema: Accepts contextId and goal per request
 *    - prepareCall: Customizes prompt based on goal
 *    - Tools: TMDB API integration
 *    - maxSteps: Multi-turn tool calling
 * 
 * 2. A2A Adapter:
 *    - includeHistory: true (uses contextId for conversation tracking)
 *    - parseTaskState: Custom parser for COMPLETED/AWAITING_USER_INPUT
 *    - Extracts goal metadata and passes to agent
 * 
 * 3. Server Setup: Standard Hono + A2A routes
 * 
 * Benefits over old implementation:
 * - ~53% code reduction (381 lines → ~180 lines)
 * - Agent is portable (CLI, tests, REST, MCP, A2A)
 * - Cleaner separation of concerns
 * - Demonstrates AI SDK v6 advanced features
 * 
 * See:
 * - AI_SDK_AGENT_CLASS_ASSESSMENT.md (Architectural rationale)
 * - samples/js/src/shared/README.md (A2AAgentAdapter docs)
 * - AI_SDK_V6_UPGRADE_COMPLETE.md (AI SDK v6 features)
 */

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { TaskState } from "@drew-foxall/a2a-js-sdk";
import { AgentCard } from "@drew-foxall/a2a-js-sdk";
import {
  InMemoryTaskStore,
  TaskStore,
  AgentExecutor,
  DefaultRequestHandler,
} from "@drew-foxall/a2a-js-sdk/server";
import { A2AHonoApp } from "@drew-foxall/a2a-js-sdk/server/hono";

// Import our shared utilities
import { A2AAgentAdapter } from "../../shared/a2a-agent-adapter.js";
// Import the agent definition
import { movieAgent } from "./agent.js";

// Environment validation
if (!process.env.TMDB_API_KEY) {
  console.error("TMDB_API_KEY environment variable is required");
  process.exit(1);
}

// ============================================================================
// 1. AI Agent is defined in agent.ts (Pure, Protocol-Agnostic)
// ============================================================================
// See agent.ts for the ToolLoopAgent with callOptionsSchema and prepareCall

// ============================================================================
// 2. Create A2A Adapter (Bridges Agent to A2A Protocol)
// ============================================================================

/**
 * Custom task state parser for Movie Agent
 * 
 * The Movie Agent ends responses with "COMPLETED" or "AWAITING_USER_INPUT"
 * on the final line. We parse this to determine the A2A task state.
 */
function parseMovieAgentTaskState(text: string): TaskState {
  const lines = text.trim().split("\n");
  const finalLine = lines.at(-1)?.trim().toUpperCase();
  
  if (finalLine === "COMPLETED") {
    return "completed";
  } else if (finalLine === "AWAITING_USER_INPUT") {
    return "input-required";
  }
  
  // Default to unknown if no state marker found
  return "unknown";
}

/**
 * Transform response to remove the state marker line
 * 
 * Since we parse the state from the last line, we should remove it
 * from the response text sent to the user.
 */
function transformMovieAgentResponse(result: any): any {
  if (!result?.text) return result;
  
  const lines = result.text.trim().split("\n");
  const finalLine = lines.at(-1)?.trim().toUpperCase();
  
  // If the last line is a state marker, remove it
  if (finalLine === "COMPLETED" || finalLine === "AWAITING_USER_INPUT") {
    const cleanedText = lines.slice(0, -1).join("\n").trim();
    return { ...result, text: cleanedText };
  }
  
  return result;
}

/**
 * Create the adapter with advanced options
 */
const agentExecutor: AgentExecutor = new A2AAgentAdapter(movieAgent, {
  workingMessage: "Processing your question, hang tight!",
  
  // Enable conversation history management
  includeHistory: true,
  
  // Custom task state parser
  parseTaskState: parseMovieAgentTaskState,
  
  // Transform response to remove state marker
  transformResponse: transformMovieAgentResponse,
  
  debug: false,
});

// ============================================================================
// 3. Define Agent Card (A2A Metadata)
// ============================================================================

const movieAgentCard: AgentCard = {
  name: "Movie Agent (AI SDK v6)",
  description: "An agent that can answer questions about movies and actors using TMDB.",
  url: "http://localhost:41241/",
  provider: {
    organization: "A2A Samples (AI SDK v6 + Adapter)",
    url: "https://github.com/drew-foxall/a2a-js-sdk-examples",
  },
  version: "2.0.0", // Bumped to 2.0.0 for migration
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

// ============================================================================
// 4. Server Setup (Standard A2A + Hono)
// ============================================================================

async function main() {
  const taskStore: TaskStore = new InMemoryTaskStore();

  const requestHandler = new DefaultRequestHandler(
    movieAgentCard,
    taskStore,
    agentExecutor
  );

  const app = new Hono();
  const appBuilder = new A2AHonoApp(requestHandler);
  appBuilder.setupRoutes(app);

  const PORT = Number(process.env.PORT) || 41241;
  console.log(
    `[MovieAgent] ✅ AI SDK v6 + A2AAgentAdapter started on http://localhost:${PORT}`
  );
  console.log(
    `[MovieAgent] 🃏 Agent Card: http://localhost:${PORT}/.well-known/agent-card.json`
  );
  console.log(
    `[MovieAgent] 📦 Architecture: ToolLoopAgent + A2AAgentAdapter Pattern (Advanced)`
  );
  console.log(
    `[MovieAgent] ✨ Features: callOptionsSchema, prepareCall, custom state parsing`
  );
  console.log("[MovieAgent] Press Ctrl+C to stop the server");

  serve({
    fetch: app.fetch,
    port: PORT,
  });
}

main().catch(console.error);

