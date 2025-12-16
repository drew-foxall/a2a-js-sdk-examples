/**
 * Image Generator - Durable Workflow
 *
 * A workflow version of the image generator agent that provides:
 * - Automatic retry on DALL-E API failures
 * - Result caching across workflow restarts
 * - Observability via Workflow DevKit traces
 *
 * This workflow uses the DurableAgent from @drew-foxall/workflow-ai
 * which provides streaming support and proper AI SDK 6 integration.
 *
 * Particularly valuable for image generation because:
 * - DALL-E calls take 10-30 seconds
 * - API calls cost money (avoid duplicate calls)
 * - Transient failures are common
 *
 * Usage:
 *   import { imageGeneratorWorkflow } from "a2a-agents/image-generator/workflow";
 *   import { start } from "workflow/api";
 *
 *   const run = await start(imageGeneratorWorkflow, [messages, apiKey]);
 */

import { DurableAgent } from "@drew-foxall/workflow-ai/agent";
import type { ModelMessage, UIMessageChunk } from "ai";
import { getWritable } from "workflow";
import { z } from "zod";
import { getImageGeneratorPrompt } from "./prompt.js";
import { generateImage, type GenerateImageParams, type GenerateImageResult } from "./steps.js";

/**
 * Tool Schemas
 */
const generateImageSchema = z.object({
  prompt: z.string().describe("Detailed description of the image to generate"),
  size: z
    .enum(["1024x1024", "1792x1024", "1024x1792"])
    .default("1024x1024")
    .describe("Image dimensions"),
  quality: z.enum(["standard", "hd"]).default("standard").describe("Image quality level"),
  style: z
    .enum(["vivid", "natural"])
    .default("vivid")
    .describe("Image style - vivid for dramatic, natural for realistic"),
});

/**
 * Durable Image Generator Workflow
 *
 * This workflow wraps the image generator logic with Workflow DevKit durability.
 * The DALL-E API call is a durable step that will be cached and retried as needed.
 *
 * @param messages - The conversation messages to process
 * @param apiKey - OpenAI API key for DALL-E access
 * @returns The updated messages array after agent processing
 */
export async function imageGeneratorWorkflow(
  messages: ModelMessage[],
  apiKey: string
): Promise<{ messages: ModelMessage[] }> {
  "use workflow";

  const writable = getWritable<UIMessageChunk>();

  const agent = new DurableAgent({
    model: "openai/gpt-4o-mini",
    system: getImageGeneratorPrompt(),
    tools: {
      generate_image: {
        description:
          "Generate an image using DALL-E based on a text description. Returns a URL to the generated image.",
        inputSchema: generateImageSchema,
        execute: async (params: GenerateImageParams): Promise<GenerateImageResult> => {
          // Call durable step - this will be cached if workflow restarts
          const result = await generateImage(params, apiKey);
          return result;
        },
      },
    },
  });

  return agent.stream({
    messages,
    writable,
  });
}

/**
 * Export types for workflow consumers
 */
export type ImageGeneratorWorkflowParams = Parameters<typeof imageGeneratorWorkflow>;
export type ImageGeneratorWorkflowResult = Awaited<ReturnType<typeof imageGeneratorWorkflow>>;

