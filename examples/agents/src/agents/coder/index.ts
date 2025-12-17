/**
 * Coder Agent
 *
 * An agent that generates and explains code.
 * This module exports ONLY the agent logic - no HTTP framework dependencies.
 */

export { createCoderAgent } from "./agent.js";
export {
  CODER_SYSTEM_PROMPT,
  type CodeFile,
  type CodeMessageData,
  extractCodeBlocks,
} from "./code-format.js";
