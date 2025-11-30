/**
 * Image Generator Agent
 *
 * A protocol-agnostic AI agent that generates images using DALL-E.
 *
 * Features:
 * - Text-to-image generation
 * - Multiple size options
 * - Quality settings
 * - Style variations
 *
 * This agent demonstrates:
 * - External API integration (OpenAI Images)
 * - Binary artifact handling
 * - Creative prompt enhancement
 */

import { type LanguageModel, ToolLoopAgent } from "ai";
import { z } from "zod";
import { getImageGeneratorPrompt } from "./prompt";

/**
 * Image generation tool schema
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

type GenerateImageParams = z.infer<typeof generateImageSchema>;

/**
 * Create an Image Generator Agent
 *
 * This is a protocol-agnostic AI agent that can be exposed through
 * multiple interfaces (A2A, MCP, REST, CLI, etc.)
 *
 * @param model - The language model to use for conversation
 * @param openaiApiKey - OpenAI API key for DALL-E access
 * @returns A configured ToolLoopAgent for image generation
 */
export function createImageGeneratorAgent(model: LanguageModel, openaiApiKey?: string) {
  // Get API key from parameter or environment
  const apiKey = openaiApiKey || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for image generation");
  }

  return new ToolLoopAgent({
    model,
    instructions: getImageGeneratorPrompt(),
    tools: {
      generate_image: {
        description:
          "Generate an image using DALL-E based on a text description. Returns a URL to the generated image.",
        inputSchema: generateImageSchema,
        execute: async (params: GenerateImageParams) => {
          try {
            // Note: This uses the OpenAI Images API directly
            // In production, you might want to use the AI SDK's image generation
            const response = await fetch("https://api.openai.com/v1/images/generations", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "dall-e-3",
                prompt: params.prompt,
                n: 1,
                size: params.size,
                quality: params.quality,
                style: params.style,
              }),
            });

            if (!response.ok) {
              const error = await response.text();
              return {
                success: false,
                error: `Image generation failed: ${error}`,
              };
            }

            const rawData: unknown = await response.json();

            // Validate response structure
            const responseSchema = z.object({
              data: z.array(
                z.object({
                  url: z.string(),
                  revised_prompt: z.string().optional(),
                })
              ),
            });

            const parseResult = responseSchema.safeParse(rawData);
            if (!parseResult.success) {
              return {
                success: false,
                error: "Invalid response from DALL-E API",
              };
            }

            const firstImage = parseResult.data.data[0];
            if (!firstImage) {
              return {
                success: false,
                error: "No image returned from DALL-E API",
              };
            }

            return {
              success: true,
              imageUrl: firstImage.url,
              revisedPrompt: firstImage.revised_prompt,
              size: params.size,
              quality: params.quality,
              style: params.style,
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            };
          }
        },
      },
    },
  });
}
