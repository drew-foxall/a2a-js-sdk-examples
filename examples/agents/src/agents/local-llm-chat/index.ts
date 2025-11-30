/**
 * Local LLM Chat Agent - Local Server Entry Point
 *
 * This file sets up the local A2A server for the Local LLM Chat agent.
 * It demonstrates how to use the agent with different LLM providers.
 *
 * Usage:
 *   Default (OpenAI): pnpm run dev:local-llm-chat
 *   With Ollama: AI_PROVIDER=ollama AI_MODEL=llama3 pnpm run dev:local-llm-chat
 */

import { A2AAdapter } from "@drew-foxall/a2a-ai-sdk-adapter";
import type { AgentCard, AgentSkill } from "@drew-foxall/a2a-js-sdk";
import { DefaultRequestHandler, InMemoryTaskStore } from "@drew-foxall/a2a-js-sdk/server";
import { A2AHonoApp } from "@drew-foxall/a2a-js-sdk/server/hono";
import { serve } from "@hono/node-server";
import { Hono } from "hono";

import { getModel, getModelInfo } from "../../shared/utils";
import { createLocalLLMChatAgent } from "./agent";

// ============================================================================
// Agent Card Definition
// ============================================================================

const chatSkill: AgentSkill = {
  id: "chat_with_tools",
  name: "Chat with Tools",
  description: "General chat with access to web search and weather information",
  tags: ["chat", "search", "weather", "assistant"],
  examples: [
    "What's the weather in Tokyo?",
    "Search for the latest news about AI",
    "Tell me about yourself",
  ],
};

const agentCard: AgentCard = {
  name: "Local LLM Chat Agent",
  description:
    "A chat agent that works with local or cloud LLMs. Includes web search and weather tools. Demonstrates A2A with self-hosted models.",
  url: "http://localhost:4012",
  protocolVersion: "0.3.0",
  version: "1.0.0",
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
  preferredTransport: "JSONRPC",
  capabilities: {
    streaming: true,
    pushNotifications: false,
    stateTransitionHistory: false,
  },
  skills: [chatSkill],
};

// ============================================================================
// Server Setup
// ============================================================================

const model = getModel();
const modelInfo = getModelInfo();
const agent = createLocalLLMChatAgent(model);

const agentExecutor = new A2AAdapter(agent, {
  mode: "stream",
  workingMessage: "Thinking...",
  debug: false,
});

const taskStore = new InMemoryTaskStore();
const requestHandler = new DefaultRequestHandler(agentCard, taskStore, agentExecutor);

const app = new Hono();
const appBuilder = new A2AHonoApp(requestHandler);
appBuilder.setupRoutes(app);

// ============================================================================
// Start Server
// ============================================================================

console.log(`
🤖 Local LLM Chat Agent - A2A Server Starting...
📍 Port: 4012
🌐 URL: http://localhost:4012
🧠 Model: ${modelInfo.provider}/${modelInfo.model}

Endpoints:
  - Agent Card: http://localhost:4012/.well-known/agent-card.json
  - Send Message: http://localhost:4012/message/send

Skills:
  - ${chatSkill.name}: ${chatSkill.description}

To use with Ollama:
  AI_PROVIDER=ollama AI_MODEL=llama3 pnpm run dev:local-llm-chat
`);

serve({
  fetch: app.fetch,
  port: 4012,
  hostname: "0.0.0.0",
});
