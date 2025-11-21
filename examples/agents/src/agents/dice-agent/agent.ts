/**
 * Dice Agent
 *
 * A protocol-agnostic AI agent that demonstrates tool usage.
 *
 * Features:
 * - Two simple computational tools (rollDice, checkPrime)
 * - No external APIs or dependencies
 * - Demonstrates AI SDK tool integration patterns
 * - Foundation for understanding tool-based agents
 *
 * This agent can:
 * - Roll N-sided dice
 * - Check if numbers are prime
 * - Discuss dice roll outcomes
 */

import { type LanguageModel, ToolLoopAgent } from "ai";
import { z } from "zod";
import { getDiceAgentPrompt } from "./prompt.js";
import { checkPrime, rollDice } from "./tools.js";

/**
 * Tool Schemas
 *
 * Define input validation using Zod schemas
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
 * Type-safe parameter types
 */
type RollDiceParams = z.infer<typeof rollDiceSchema>;
type CheckPrimeParams = z.infer<typeof checkPrimeSchema>;

/**
 * Create a Dice Agent
 *
 * This is a protocol-agnostic AI agent that can be exposed through
 * multiple interfaces (A2A, MCP, REST, CLI, etc.)
 *
 * @param model - The language model to use (from getModel() utility)
 * @returns A configured ToolLoopAgent with dice and prime tools
 */
export function createDiceAgent(model: LanguageModel) {
  return new ToolLoopAgent({
    model,
    instructions: getDiceAgentPrompt(),

    // Tool definitions using inputSchema for AI SDK v6 compatibility
    tools: {
      rollDice: {
        description:
          "Rolls an N-sided dice and returns the result. By default uses a 6-sided dice.",
        inputSchema: rollDiceSchema,
        execute: async (params: RollDiceParams) => {
          const result = rollDice(params.sides);
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
        execute: async (params: CheckPrimeParams) => {
          const result = checkPrime(params.numbers);
          return {
            checked: params.numbers,
            result,
          };
        },
      },
    },
  });
}
