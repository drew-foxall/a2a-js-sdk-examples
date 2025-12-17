/**
 * Image Generator Agent
 *
 * An agent that generates images using AI models.
 * This module exports ONLY the agent logic - no HTTP framework dependencies.
 */

// Non-durable exports (standard ToolLoopAgent)
export { createImageGeneratorAgent } from "./agent.js";
export { getImageGeneratorPrompt } from "./prompt.js";
export { type GenerateImageParams, type GenerateImageResult, generateImage } from "./steps.js";
// Durable exports (Workflow DevKit)
export {
  type ImageGeneratorWorkflowParams,
  type ImageGeneratorWorkflowResult,
  imageGeneratorWorkflow,
} from "./workflow.js";
