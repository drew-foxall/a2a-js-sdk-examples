/**
 * Image Generator Agent
 *
 * An agent that generates images using AI models.
 * This module exports ONLY the agent logic - no HTTP framework dependencies.
 */

// Non-durable exports (standard ToolLoopAgent)
export { createImageGeneratorAgent } from "./agent.js";
export { getImageGeneratorPrompt } from "./prompt.js";

// Durable exports (Workflow DevKit)
export {
  imageGeneratorWorkflow,
  type ImageGeneratorWorkflowParams,
  type ImageGeneratorWorkflowResult,
} from "./workflow.js";
export { generateImage, type GenerateImageParams, type GenerateImageResult } from "./steps.js";
