import { ToolLoopAgent } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, it } from "vitest";
import { createDiceAgent } from "./agent";

/**
 * Dice Agent Tests
 *
 * Purpose: Demonstrates AI SDK tool integration with pure computational functions
 * - Two simple tools: rollDice and checkPrime
 * - Zod validation for parameters
 * - Type-safe tool definitions
 */

describe("Dice Agent", () => {
  it("should create agent with two tools", () => {
    const mockModel = new MockLanguageModelV3();
    const agent = createDiceAgent(mockModel);

    expect(agent).toBeInstanceOf(ToolLoopAgent);
    const toolNames = Object.keys(agent.tools);
    expect(toolNames).toHaveLength(2);
    expect(toolNames).toContain("rollDice");
    expect(toolNames).toContain("checkPrime");
  });

  it("should roll dice with specified sides", async () => {
    const mockModel = new MockLanguageModelV3();
    const agent = createDiceAgent(mockModel);

    const result = await agent.tools.rollDice.execute({ sides: 6 });

    expect(result.sides).toBe(6);
    expect(result.result).toBeGreaterThanOrEqual(1);
    expect(result.result).toBeLessThanOrEqual(6);
  });

  it("should check which numbers are prime", async () => {
    const mockModel = new MockLanguageModelV3();
    const agent = createDiceAgent(mockModel);

    const result = await agent.tools.checkPrime.execute({
      numbers: [2, 3, 4, 5],
    });

    expect(result.result).toContain("2");
    expect(result.result).toContain("3");
    expect(result.result).toContain("5");
    expect(result.result).not.toContain("4");
  });
});
