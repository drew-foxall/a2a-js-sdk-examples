import { describe, expect, it } from "vitest";
import { checkPrime, rollDice } from "./tools";

describe("Dice Agent Tools", () => {
  describe("rollDice", () => {
    it("should return a number between 1 and sides", () => {
      const sides = 6;
      const result = rollDice(sides);

      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(sides);
      expect(Number.isInteger(result)).toBe(true);
    });

    it("should use default 6 sides when not specified", () => {
      const result = rollDice();

      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(6);
    });

    it("should work with custom sided dice (d20)", () => {
      const result = rollDice(20);

      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(20);
    });

    it("should work with custom sided dice (d100)", () => {
      const result = rollDice(100);

      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(100);
    });

    it("should produce different results over multiple rolls", () => {
      const results = new Set();
      // Roll 20 times to check randomness
      for (let i = 0; i < 20; i++) {
        results.add(rollDice(6));
      }

      // Should have at least 2 different values (highly likely with 20 rolls)
      expect(results.size).toBeGreaterThan(1);
    });

    it("should handle edge case of 1-sided die", () => {
      const result = rollDice(1);
      expect(result).toBe(1);
    });
  });

  describe("checkPrime", () => {
    it("should identify single prime number", () => {
      const result = checkPrime([7]);
      expect(result).toBe("7 are prime numbers.");
    });

    it("should identify multiple prime numbers", () => {
      const result = checkPrime([2, 3, 5, 7]);
      expect(result).toContain("2");
      expect(result).toContain("3");
      expect(result).toContain("5");
      expect(result).toContain("7");
      expect(result).toContain("prime");
    });

    it("should filter out non-prime numbers", () => {
      const result = checkPrime([2, 3, 4, 5, 6]);
      expect(result).toContain("2");
      expect(result).toContain("3");
      expect(result).toContain("5");
      expect(result).not.toContain("4");
      expect(result).not.toContain("6");
    });

    it("should return message when no primes found", () => {
      const result = checkPrime([4, 6, 8, 9, 10]);
      expect(result).toBe("No prime numbers found.");
    });

    it("should handle empty array", () => {
      const result = checkPrime([]);
      expect(result).toBe("No prime numbers found.");
    });

    it("should handle numbers less than 2", () => {
      const result = checkPrime([0, 1, -5]);
      expect(result).toBe("No prime numbers found.");
    });

    it("should correctly identify 2 as prime", () => {
      const result = checkPrime([2]);
      expect(result).toBe("2 are prime numbers.");
    });

    it("should correctly identify large prime numbers", () => {
      const result = checkPrime([97, 100, 101]);
      expect(result).toContain("97");
      expect(result).toContain("101");
      expect(result).not.toContain("100");
    });

    it("should handle mixed positive and negative numbers", () => {
      const result = checkPrime([-3, 0, 1, 2, 3, 4, 5]);
      expect(result).toContain("2");
      expect(result).toContain("3");
      expect(result).toContain("5");
    });

    it("should format output correctly for single prime", () => {
      const result = checkPrime([11]);
      expect(result).toMatch(/\d+ are prime numbers\./);
    });

    it("should format output correctly for multiple primes", () => {
      const result = checkPrime([2, 3, 5]);
      expect(result).toMatch(/\d+, \d+, \d+ are prime numbers\./);
    });
  });
});
