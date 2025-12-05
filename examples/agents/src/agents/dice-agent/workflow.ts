/**
 * Dice Agent - Durable Workflow
 *
 * A workflow version of the dice agent that provides:
 * - Automatic retry on failures
 * - Result caching across restarts
 * - Observability via Workflow DevKit traces
 *
 * This workflow uses the DurableAgent from @drew-foxall/workflow-ai
 * which provides streaming support and proper AI SDK 6 integration.
 *
 * Usage:
 *   import { diceAgentWorkflow } from "a2a-agents/dice-agent/workflow";
 *   import { start } from "workflow/api";
 *
 *   const run = await start(diceAgentWorkflow, [messages]);
 */

import { DurableAgent } from "@drew-foxall/workflow-ai/agent";
import type { ModelMessage, UIMessageChunk } from "ai";
import { getWritable } from "workflow";
import { z } from "zod";
import { getDiceAgentPrompt } from "./prompt";
import { checkPrime, rollDice } from "./steps";

/**
 * Tool Schemas (same as agent.ts)
 */
const rollDiceSchema = z.object({
  sides: z
    .number()
    .int()
    .positive()
    .default(6)
    .describe("Number of sides on the dice (default: 6)"),
});

const checkPrimeSchema = z.object({
  numbers: z.array(z.number().int()).describe("Array of integers to check for primality"),
});

/**
 * Durable Dice Agent Workflow
 *
 * This workflow wraps the dice agent logic with Workflow DevKit durability.
 * Each tool call is a durable step that will be cached and retried as needed.
 *
 * @param messages - The conversation messages to process
 * @returns The updated messages array after agent processing
 */
export async function diceAgentWorkflow(
  messages: ModelMessage[]
): Promise<{ messages: ModelMessage[] }> {
  "use workflow";

  const writable = getWritable<UIMessageChunk>();

  const agent = new DurableAgent({
    model: "openai/gpt-4o-mini",
    system: getDiceAgentPrompt(),
    tools: {
      rollDice: {
        description:
          "Rolls an N-sided dice and returns the result. By default uses a 6-sided dice.",
        inputSchema: rollDiceSchema,
        execute: async (params) => {
          // Call durable step
          const result = await rollDice(params.sides);
          return {
            sides: params.sides,
            result,
            message: `Rolled a ${params.sides}-sided die and got: ${result}`,
          };
        },
      },
      checkPrime: {
        description:
          "Determines which numbers from a list are prime numbers. Returns a human-readable string.",
        inputSchema: checkPrimeSchema,
        execute: async (params) => {
          // Call durable step
          const result = await checkPrime(params.numbers);
          return {
            checked: params.numbers,
            result,
          };
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
export type DiceAgentWorkflowParams = Parameters<typeof diceAgentWorkflow>;
export type DiceAgentWorkflowResult = Awaited<ReturnType<typeof diceAgentWorkflow>>;
