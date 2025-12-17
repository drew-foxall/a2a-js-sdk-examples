import { describe, expect, it } from "vitest";
import { checkPrime, rollDice } from "./tools";

describe("rollDice", () => {
  it("should return valid results for various dice sizes", () => {
    // Default d6
    expect(rollDice()).toBeGreaterThanOrEqual(1);
    expect(rollDice()).toBeLessThanOrEqual(6);

    // d20
    expect(rollDice(20)).toBeLessThanOrEqual(20);

    // d1 edge case
    expect(rollDice(1)).toBe(1);
  });

  it("should produce varied results over multiple rolls", () => {
    const results = new Set(Array.from({ length: 20 }, () => rollDice(6)));
    expect(results.size).toBeGreaterThan(1);
  });
});

describe("checkPrime", () => {
  it("should identify prime numbers correctly", () => {
    expect(checkPrime([2, 3, 5, 7])).toMatch(/2.*3.*5.*7.*prime/);
    expect(checkPrime([97, 100, 101])).toContain("97");
    expect(checkPrime([97, 100, 101])).toContain("101");
    expect(checkPrime([97, 100, 101])).not.toContain("100");
  });

  it("should filter out non-primes", () => {
    const result = checkPrime([2, 3, 4, 5, 6]);
    expect(result).toContain("2");
    expect(result).toContain("3");
    expect(result).toContain("5");
    expect(result).not.toContain("4");
    expect(result).not.toContain("6");
  });

  it("should handle edge cases", () => {
    expect(checkPrime([])).toBe("No prime numbers found.");
    expect(checkPrime([4, 6, 8])).toBe("No prime numbers found.");
    expect(checkPrime([0, 1, -5])).toBe("No prime numbers found.");
    expect(checkPrime([-3, 0, 1, 2, 3])).toContain("2");
  });
});
