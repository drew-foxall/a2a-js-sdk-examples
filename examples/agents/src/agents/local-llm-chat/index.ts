/**
 * Local LLM Chat Agent
 *
 * An agent that uses local LLM models for chat.
 * This module exports ONLY the agent logic - no HTTP framework dependencies.
 */

export { createLocalLLMChatAgent } from "./agent.js";
export { getLocalLLMChatPrompt } from "./prompt.js";
