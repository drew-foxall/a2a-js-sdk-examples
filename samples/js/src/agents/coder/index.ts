/**
 * Coder Agent (AI SDK v6 + Unified A2AAdapter)
 * 
 * UNIFIED ADAPTER MIGRATION: Now uses automatic A2AAdapter
 * 
 * Features:
 * - Streaming code generation
 * - Real-time artifact emission (code files)
 * - Markdown code block parsing during streaming
 * - Multi-file output support
 * - File deduplication and ordering
 * 
 * Architecture: AI SDK Agent + Automatic A2A Adapter (Streaming)
 * --------------------------------------------------------------
 * This agent demonstrates automatic streaming mode detection:
 * 
 * 1. AI Agent (ToolLoopAgent):
 *    - Pure code generation logic
 *    - Protocol-agnostic
 * 
 * 2. A2A Adapter:
 *    - Automatically uses STREAMING mode (parseArtifacts provided)
 *    - Calls agent.stream() automatically
 *    - Parses code blocks incrementally
 *    - Emits artifacts as files complete
 * 
 * 3. Server Setup: Standard Hono + A2A routes
 * 
 * Benefits:
 * - Single adapter for all use cases
 * - Automatic streaming detection (parseArtifacts triggers it)
 * - No manual streamFunction needed
 * - Configuration is self-documenting
 * 
 * See:
 * - AUTOMATIC_ADAPTER_ASSESSMENT.md (Why unified adapter)
 * - samples/js/src/shared/a2a-adapter.ts (Implementation)
 */

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { AgentCard } from '@drew-foxall/a2a-js-sdk';
import {
  InMemoryTaskStore,
  TaskStore,
  AgentExecutor,
  DefaultRequestHandler,
} from '@drew-foxall/a2a-js-sdk/server';
import { A2AHonoApp } from '@drew-foxall/a2a-js-sdk/server/hono';

// Import unified automatic adapter
import { A2AAdapter, ParsedArtifacts } from '../../shared/a2a-adapter.js';
// Import the agent definition
import { coderAgent } from './agent.js';
// Import code parsing utilities
import { extractCodeBlocks } from './code-format.js';

// ============================================================================
// 1. AI Agent is defined in agent.ts (Pure, Protocol-Agnostic)
// ============================================================================
// See agent.ts for the ToolLoopAgent and streamCoderGeneration function

// ============================================================================
// 2. Create A2A Streaming Adapter (Bridges Agent to A2A Protocol)
// ============================================================================

/**
 * Parse artifacts from accumulated text
 * 
 * This function is called after each chunk to extract completed code blocks.
 * It uses the existing extractCodeBlocks() utility from code-format.ts.
 */
function parseCodeArtifacts(accumulatedText: string): ParsedArtifacts {
  const parsed = extractCodeBlocks(accumulatedText);
  
  return {
    artifacts: parsed.files.map(file => ({
      filename: file.filename,
      language: file.language,
      content: file.content,
      done: file.done,
      metadata: {
        preamble: file.preamble,
      },
    })),
    preamble: parsed.files[0]?.preamble,
    postamble: parsed.postamble,
  };
}

/**
 * Build final message from artifacts
 * 
 * Shows what files were generated and includes preamble/postamble.
 */
function buildCoderFinalMessage(
  artifacts: any[],
  fullResponse: string,
  preamble?: string,
  postamble?: string
): string {
  // Filter to only artifacts with filenames
  const namedArtifacts = artifacts.filter(a => a.filename);
  const fileCount = namedArtifacts.length;
  
  let finalMessage = '';
  
  // Add preamble
  if (preamble) {
    finalMessage += preamble + '\n\n';
  }
  
  // Add file summary
  if (fileCount > 0) {
    const fileNames = namedArtifacts.map(a => a.filename).filter(Boolean);
    finalMessage += `Generated ${fileCount} file${fileCount > 1 ? 's' : ''}: ${fileNames.join(', ')}`;
  } else {
    // No files generated, return full response
    finalMessage += fullResponse;
  }
  
  // Add postamble
  if (postamble) {
    finalMessage += '\n\n' + postamble;
  }
  
  return finalMessage;
}

/**
 * Create the adapter with artifact parsing
 * 
 * The presence of parseArtifacts automatically triggers STREAMING mode!
 * No need to manually specify streaming or provide streamFunction.
 */
const agentExecutor: AgentExecutor = new A2AAdapter(coderAgent, {
  parseArtifacts: parseCodeArtifacts,  // ← Triggers STREAMING mode automatically!
  buildFinalMessage: buildCoderFinalMessage,
  workingMessage: 'Generating code...',
  debug: false,
});

// ============================================================================
// 3. Define Agent Card (A2A Metadata)
// ============================================================================

const coderAgentCard: AgentCard = {
  name: 'Coder Agent (AI SDK v6)',
  description: 'A code-writing agent that emits full code files as artifacts.',
  url: 'http://localhost:41242/',
  provider: {
    organization: 'A2A Samples (AI SDK v6 + Streaming Adapter)',
    url: 'https://github.com/drew-foxall/a2a-js-sdk-examples',
  },
  version: '2.0.0', // Bumped to 2.0.0 for migration
  protocolVersion: '0.3.0',
  capabilities: {
    streaming: true,
    pushNotifications: false,
    stateTransitionHistory: true,
  },
  defaultInputModes: ['text'],
  defaultOutputModes: ['text', 'artifact'],
  skills: [
    {
      id: 'code_generation',
      name: 'Code Generation',
      description: 'Generate high-quality code files based on your requirements.',
      tags: ['coding', 'programming', 'development'],
      examples: [
        'Write a TypeScript function to calculate fibonacci numbers',
        'Create a React component for a todo list',
        'Build a REST API endpoint for user authentication',
        'Generate a Python script to scrape websites',
      ],
      inputModes: ['text'],
      outputModes: ['text', 'artifact'],
    },
  ],
  supportsAuthenticatedExtendedCard: false,
};

// ============================================================================
// 4. Server Setup (Standard A2A + Hono)
// ============================================================================

async function main() {
  const taskStore: TaskStore = new InMemoryTaskStore();

  const requestHandler = new DefaultRequestHandler(
    coderAgentCard,
    taskStore,
    agentExecutor
  );

  const app = new Hono();
  const appBuilder = new A2AHonoApp(requestHandler);
  appBuilder.setupRoutes(app);

  const PORT = Number(process.env.PORT) || 41242;
  console.log(
    `[CoderAgent] ✅ AI SDK v6 + Unified A2AAdapter started on http://localhost:${PORT}`
  );
  console.log(
    `[CoderAgent] 🃏 Agent Card: http://localhost:${PORT}/.well-known/agent-card.json`
  );
  console.log(
    `[CoderAgent] 📦 Architecture: ToolLoopAgent + Automatic A2AAdapter (Streaming Mode)`
  );
  console.log(
    `[CoderAgent] ✨ Features: Auto-streaming, incremental artifacts, code parsing`
  );
  console.log('[CoderAgent] Press Ctrl+C to stop the server');

  serve({
    fetch: app.fetch,
    port: PORT,
  });
}

main().catch(console.error);

