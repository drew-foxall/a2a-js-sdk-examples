/**
 * Content Editor Agent Export (No Server)
 * 
 * This file exports just the agent for use in tests, CLI, etc.
 * Import this instead of index.ts to avoid starting the server.
 */

import { ToolLoopAgent } from "ai";
import { getModel } from "../../shared/utils.js";
import { CONTENT_EDITOR_PROMPT } from "./prompt.js";

/**
 * Content Editor Agent - Pure AI SDK ToolLoopAgent
 * 
 * This agent can be used anywhere:
 * - Via A2A protocol (using A2AAgentAdapter in index.ts)
 * - Via CLI tools
 * - Via REST API
 * - Via MCP protocol
 * - In automated tests
 * 
 * No A2A-specific code here!
 */
export const contentEditorAgent = new ToolLoopAgent({
  model: getModel(),
  instructions: CONTENT_EDITOR_PROMPT,
  // No tools needed - this is a simple editing agent
  tools: {},
});

