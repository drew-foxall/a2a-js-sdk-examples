import { Message } from "../../../../types.js";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";

/**
 * Extract text content from a message
 */
export function extractText(message: Message): string {
  return message.parts
    .filter((part) => part.kind === "text")
    .map((part) => part.text)
    .join(" ");
}

/**
 * Get the AI model based on environment variables
 */
export function getModel() {
  const provider = process.env.AI_PROVIDER || "openai";
  const modelName = process.env.AI_MODEL;

  switch (provider.toLowerCase()) {
    case "anthropic":
      return anthropic(modelName || "claude-3-5-sonnet-20241022");
    case "google":
      return google(modelName || "gemini-2.0-flash-exp");
    case "openai":
    default:
      return openai(modelName || "gpt-4o-mini");
  }
}

/**
 * Get provider and model info for logging
 */
export function getModelInfo() {
  return {
    provider: process.env.AI_PROVIDER || "openai",
    model: process.env.AI_MODEL || "gpt-4o-mini",
  };
}

/**
 * Create a message ID
 */
export function createMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a task ID
 */
export function createTaskId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

