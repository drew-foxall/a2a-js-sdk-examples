/**
 * Dice Agent - Durable Steps
 *
 * Wrappers around pure tool functions that add durability via Workflow DevKit.
 * These steps:
 * - Automatically retry on failure
 * - Cache results if workflow restarts
 * - Provide observability via traces
 *
 * The pure functions in tools.ts remain unchanged and can be used
 * independently without Workflow DevKit.
 */

import { checkPrime as checkPrimePure, rollDice as rollDicePure } from "./tools";

/**
 * Durable step: Roll an N-sided dice
 *
 * Wraps the pure rollDice function with Workflow DevKit durability.
 * If the workflow is interrupted and restarted, this step will
 * return the cached result instead of re-rolling.
 *
 * @param sides - Number of sides on the dice (default: 6)
 * @returns A random number between 1 and sides (inclusive)
 */
export async function rollDice(sides: number = 6): Promise<number> {
  "use step";

  return rollDicePure(sides);
}

/**
 * Durable step: Check which numbers are prime
 *
 * Wraps the pure checkPrime function with Workflow DevKit durability.
 *
 * @param numbers - Array of numbers to check
 * @returns A human-readable string indicating which numbers are prime
 */
export async function checkPrime(numbers: number[]): Promise<string> {
  "use step";

  return checkPrimePure(numbers);
}
