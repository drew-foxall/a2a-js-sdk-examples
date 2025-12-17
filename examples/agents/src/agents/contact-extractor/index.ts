/**
 * Contact Extractor Agent
 *
 * An agent that extracts contact information from text.
 * This module exports ONLY the agent logic - no HTTP framework dependencies.
 */

export { createContactExtractorAgent } from "./agent.js";
export { getContactExtractorPrompt } from "./prompt.js";
