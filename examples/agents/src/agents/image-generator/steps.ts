/**
 * Image Generator - Durable Steps
 *
 * Wrappers around the DALL-E API calls that add durability via Workflow DevKit.
 * These steps:
 * - Automatically retry on API failures
 * - Cache results if workflow restarts
 * - Provide observability via traces
 *
 * The actual image generation can take 10-30 seconds, making durability
 * particularly valuable for this agent.
 */

import { z } from "zod";

/**
 * DALL-E response schema for validation
 */
const dalleResponseSchema = z.object({
  data: z.array(
    z.object({
      url: z.string(),
      revised_prompt: z.string().optional(),
    })
  ),
});

/**
 * Image generation parameters
 */
export interface GenerateImageParams {
  prompt: string;
  size?: "1024x1024" | "1792x1024" | "1024x1792";
  quality?: "standard" | "hd";
  style?: "vivid" | "natural";
}

/**
 * Image generation result
 */
export interface GenerateImageResult {
  success: boolean;
  imageUrl?: string;
  revisedPrompt?: string;
  size?: string;
  quality?: string;
  style?: string;
  error?: string;
}

/**
 * Durable step: Generate an image using DALL-E
 *
 * Wraps the DALL-E API call with Workflow DevKit durability.
 * If the workflow is interrupted and restarted, this step will
 * return the cached result instead of re-calling the API.
 *
 * This is particularly valuable because DALL-E calls:
 * - Take 10-30 seconds
 * - Cost money per call
 * - May fail transiently
 *
 * @param params - Image generation parameters
 * @param apiKey - OpenAI API key
 * @returns The generated image URL and metadata
 */
export async function generateImage(
  params: GenerateImageParams,
  apiKey: string
): Promise<GenerateImageResult> {
  "use step";

  const { prompt, size = "1024x1024", quality = "standard", style = "vivid" } = params;

  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: 1,
        size,
        quality,
        style,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `DALL-E API error (${response.status}): ${errorText}`,
      };
    }

    const rawData: unknown = await response.json();
    const parseResult = dalleResponseSchema.safeParse(rawData);

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
      size,
      quality,
      style,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error during image generation",
    };
  }
}
