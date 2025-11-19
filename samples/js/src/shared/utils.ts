import { Message } from "@drew-foxall/a2a-js-sdk";
import { openai, createOpenAI } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { createAzure } from "@ai-sdk/azure";
import { cohere } from "@ai-sdk/cohere";
import { mistral } from "@ai-sdk/mistral";

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
 * 
 * Supports major AI SDK providers via environment variables:
 * - AI_PROVIDER: Provider name (openai, anthropic, google, azure, cohere, mistral, groq, ollama)
 * - AI_MODEL: Specific model name (optional, uses defaults)
 * 
 * For providers with custom configurations (Azure, Groq, Ollama, etc.),
 * additional environment variables may be required.
 * 
 * For maximum flexibility with all AI SDK providers, use the agent factory
 * functions directly with custom model instances.
 * 
 * @example
 * // Use OpenAI (default)
 * export AI_PROVIDER=openai
 * export AI_MODEL=gpt-4o
 * 
 * // Use Anthropic
 * export AI_PROVIDER=anthropic
 * export AI_MODEL=claude-3-opus-20240229
 * 
 * // Use Azure OpenAI
 * export AI_PROVIDER=azure
 * export AZURE_RESOURCE_NAME=my-resource
 * export AZURE_OPENAI_API_KEY=xxx
 * export AI_MODEL=gpt-4  # deployment name
 * 
 * // Use Groq
 * export AI_PROVIDER=groq
 * export GROQ_API_KEY=xxx
 * export AI_MODEL=llama-3.1-70b-versatile
 * 
 * // Use Ollama (local)
 * export AI_PROVIDER=ollama
 * export AI_MODEL=llama3.2
 * export OLLAMA_BASE_URL=http://localhost:11434  # optional
 * 
 * @returns AI SDK LanguageModelV1 instance
 * @throws Error if provider is unknown or required config is missing
 */
export function getModel() {
  const provider = process.env.AI_PROVIDER || "openai";
  const modelName = process.env.AI_MODEL;

  switch (provider.toLowerCase()) {
    case "openai":
      return openai(modelName || "gpt-4o-mini");
    
    case "anthropic":
      return anthropic(modelName || "claude-3-5-sonnet-20241022");
    
    case "google":
      return google(modelName || "gemini-2.0-flash-exp");
    
    case "azure": {
      const resourceName = process.env.AZURE_RESOURCE_NAME;
      if (!resourceName) {
        throw new Error(
          "AZURE_RESOURCE_NAME environment variable required for Azure provider\n" +
          "Example: export AZURE_RESOURCE_NAME=my-resource"
        );
      }
      const azure = createAzure({
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        resourceName,
      });
      return azure(modelName || "gpt-4");
    }
    
    case "cohere":
      return cohere(modelName || "command-r-plus");
    
    case "mistral":
      return mistral(modelName || "mistral-large-latest");
    
    case "groq": {
      const groq = createOpenAI({
        baseURL: "https://api.groq.com/openai/v1",
        apiKey: process.env.GROQ_API_KEY,
      });
      return groq(modelName || "llama-3.1-70b-versatile");
    }
    
    case "ollama": {
      const baseURL = process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1";
      const ollama = createOpenAI({
        baseURL,
        apiKey: "ollama", // Required but unused by Ollama
      });
      return ollama(modelName || "llama3.2");
    }
    
    default:
      throw new Error(
        `Unknown AI provider: "${provider}"\n\n` +
        `Supported providers via getModel():\n` +
        `  - openai (default)\n` +
        `  - anthropic\n` +
        `  - google\n` +
        `  - azure (requires AZURE_RESOURCE_NAME)\n` +
        `  - cohere\n` +
        `  - mistral\n` +
        `  - groq (requires GROQ_API_KEY)\n` +
        `  - ollama (requires running Ollama server)\n\n` +
        `For other providers or custom configurations, use agent factory functions:\n` +
        `  import { createContentEditorAgent } from './agent.js';\n` +
        `  import { yourProvider } from '@ai-sdk/your-provider';\n` +
        `  const agent = createContentEditorAgent(yourProvider('model-name'));`
      );
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

