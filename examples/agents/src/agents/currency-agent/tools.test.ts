import { beforeEach, describe, expect, it, vi } from "vitest";
import { getExchangeRate, isExchangeRateError } from "./tools";

// Mock fetch globally
global.fetch = vi.fn();

describe("Currency Agent Tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getExchangeRate", () => {
    it("should fetch and return exchange rate successfully", async () => {
      const mockResponse = {
        amount: 1.0,
        base: "USD",
        date: "2024-01-15",
        rates: {
          EUR: 0.92,
        },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await getExchangeRate("USD", "EUR", "latest");

      expect(isExchangeRateError(result)).toBe(false);
      if (!isExchangeRateError(result)) {
        expect(result.amount).toBe(1.0);
        expect(result.base).toBe("USD");
        expect(result.rates.EUR).toBe(0.92);
        expect(result.date).toBe("2024-01-15");
      }
    });

    it("should handle 404 errors gracefully", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      } as Response);

      const result = await getExchangeRate("USD", "XYZ", "latest");

      expect(isExchangeRateError(result)).toBe(true);
      if (isExchangeRateError(result)) {
        expect(result.error).toContain("Currency pair not found");
      }
    });

    it("should handle invalid source currency code", async () => {
      const result = await getExchangeRate("US", "EUR", "latest");

      expect(isExchangeRateError(result)).toBe(true);
      if (isExchangeRateError(result)) {
        expect(result.error).toContain("Invalid source currency code");
      }
    });

    it("should handle invalid target currency code", async () => {
      const result = await getExchangeRate("USD", "E", "latest");

      expect(isExchangeRateError(result)).toBe(true);
      if (isExchangeRateError(result)) {
        expect(result.error).toContain("Invalid target currency code");
      }
    });

    it("should handle API request errors", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      } as Response);

      const result = await getExchangeRate("USD", "EUR", "latest");

      expect(isExchangeRateError(result)).toBe(true);
      if (isExchangeRateError(result)) {
        expect(result.error).toContain("API request failed");
      }
    });

    it("should handle network errors", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

      const result = await getExchangeRate("USD", "EUR", "latest");

      expect(isExchangeRateError(result)).toBe(true);
      if (isExchangeRateError(result)) {
        expect(result.error).toContain("Network error");
      }
    });

    it("should handle invalid API response format", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          invalid: "response",
        }),
      } as Response);

      const result = await getExchangeRate("USD", "EUR", "latest");

      expect(isExchangeRateError(result)).toBe(true);
      if (isExchangeRateError(result)) {
        expect(result.error).toContain("Invalid API response format");
      }
    });

    it("should use default values when not provided", async () => {
      const mockResponse = {
        amount: 1.0,
        base: "USD",
        date: "2024-01-15",
        rates: {
          EUR: 0.92,
        },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const _result = await getExchangeRate();

      expect(fetch).toHaveBeenCalledWith(expect.stringContaining("from=USD"));
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining("to=EUR"));
    });

    it("should construct correct URL with custom date", async () => {
      const mockResponse = {
        amount: 1.0,
        base: "GBP",
        date: "2023-12-25",
        rates: {
          JPY: 185.5,
        },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await getExchangeRate("GBP", "JPY", "2023-12-25");

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("https://api.frankfurter.app/2023-12-25")
      );
    });

    it("should uppercase currency codes", async () => {
      const mockResponse = {
        amount: 1.0,
        base: "USD",
        date: "2024-01-15",
        rates: {
          EUR: 0.92,
        },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await getExchangeRate("usd", "eur", "latest");

      expect(fetch).toHaveBeenCalledWith(expect.stringContaining("from=USD"));
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining("to=EUR"));
    });

    it("should return multiple exchange rates if API provides them", async () => {
      const mockResponse = {
        amount: 1.0,
        base: "USD",
        date: "2024-01-15",
        rates: {
          EUR: 0.92,
          GBP: 0.79,
          JPY: 148.5,
        },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await getExchangeRate("USD", "EUR", "latest");

      expect(isExchangeRateError(result)).toBe(false);
      if (!isExchangeRateError(result)) {
        expect(Object.keys(result.rates).length).toBeGreaterThan(0);
      }
    });
  });

  describe("isExchangeRateError", () => {
    it("should identify error responses", () => {
      const errorResponse = { error: "Test error" };
      expect(isExchangeRateError(errorResponse)).toBe(true);
    });

    it("should identify successful responses", () => {
      const successResponse = {
        amount: 1.0,
        base: "USD",
        date: "2024-01-15",
        rates: { EUR: 0.92 },
      };
      expect(isExchangeRateError(successResponse)).toBe(false);
    });
  });
});
