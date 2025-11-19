/**
 * Content Editor Agent (AI SDK v6 + Unified A2AAdapter)
 * 
 * UNIFIED ADAPTER MIGRATION: Now uses automatic A2AAdapter
 * 
 * Features:
 * - Content proof-reading and editing
 * - Grammar and style improvements
 * - Maintains user's voice
 * 
 * Architecture: AI SDK Agent + Automatic A2A Adapter
 * --------------------------------------------------
 * This agent demonstrates the unified automatic adapter:
 * 
 * 1. AI Agent (ToolLoopAgent): Pure, protocol-agnostic logic for content editing
 * 2. A2A Adapter: Automatically selects simple mode (no artifacts needed)
 * 3. Server Setup: Standard Hono + A2A routes
 * 
 * Benefits:
 * - Single adapter for all use cases
 * - Automatic mode selection (simple vs streaming)
 * - Zero decision overhead
 * - Configuration is self-documenting
 * 
 * See:
 * - AUTOMATIC_ADAPTER_ASSESSMENT.md (Why unified adapter)
 * - samples/js/src/shared/a2a-adapter.ts (Implementation)
 */

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { ToolLoopAgent } from "ai";

import { AgentCard } from "@drew-foxall/a2a-js-sdk";
import {
  InMemoryTaskStore,
  TaskStore,
  AgentExecutor,
  DefaultRequestHandler,
} from "@drew-foxall/a2a-js-sdk/server";
import { A2AHonoApp } from "@drew-foxall/a2a-js-sdk/server/hono";

// Import unified automatic adapter
import { A2AAdapter } from "../../shared/a2a-adapter.js";
// Import the agent definition (kept separate to avoid starting server when importing)
import { contentEditorAgent } from "./agent.js";

// ============================================================================
// 1. AI Agent is defined in agent.ts (Pure, Protocol-Agnostic)
// ============================================================================
// See agent.ts for the ToolLoopAgent definition

// ============================================================================
// 2. Create A2A Adapter (Automatically Uses Simple Mode)
// ============================================================================

const agentExecutor: AgentExecutor = new A2AAdapter(contentEditorAgent, {
  workingMessage: "Editing content...",
  debug: false,
  // No parseArtifacts → Automatically uses SIMPLE mode
});

// ============================================================================
// 3. Define Agent Card (A2A Metadata)
// ============================================================================

const contentEditorAgentCard: AgentCard = {
  name: "Content Editor Agent (AI SDK v6)",
  description:
    "An agent that can proof-read and polish your content, improving clarity and style.",
  url: "http://localhost:41243/",
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

// ============================================================================
// 4. Server Setup (Standard A2A + Hono)
// ============================================================================

async function main() {
  const taskStore: TaskStore = new InMemoryTaskStore();

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
    `[ContentEditorAgent] ✅ AI SDK v6 + Unified A2AAdapter started on http://localhost:${PORT}`
  );
  console.log(
    `[ContentEditorAgent] 🃏 Agent Card: http://localhost:${PORT}/.well-known/agent-card.json`
  );
  console.log(
    `[ContentEditorAgent] 📦 Architecture: ToolLoopAgent + Automatic A2AAdapter (Simple Mode)`
  );
  console.log("[ContentEditorAgent] Press Ctrl+C to stop the server");

  serve({
    fetch: app.fetch,
    port: PORT,
  });
}

main().catch(console.error);

