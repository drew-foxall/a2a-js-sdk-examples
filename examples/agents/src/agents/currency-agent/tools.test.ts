import { beforeEach, describe, expect, it, vi } from "vitest";
import { getExchangeRate, isExchangeRateError } from "./tools";

global.fetch = vi.fn();

const mockResponse = (data: unknown, ok = true, status = 200) => ({
  ok,
  status,
  statusText: ok ? "OK" : "Error",
  json: async () => data,
});

const validResponse = { amount: 1.0, base: "USD", date: "2024-01-15", rates: { EUR: 0.92 } };

describe("getExchangeRate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should fetch exchange rate successfully", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(validResponse) as Response);

    const result = await getExchangeRate("USD", "EUR", "latest");

    expect(isExchangeRateError(result)).toBe(false);
    if (!isExchangeRateError(result)) {
      expect(result).toMatchObject({ amount: 1.0, base: "USD", date: "2024-01-15" });
      expect(result.rates.EUR).toBe(0.92);
    }
  });

  it("should validate currency codes", async () => {
    const invalidSource = await getExchangeRate("US", "EUR", "latest");
    expect(isExchangeRateError(invalidSource) && invalidSource.error).toContain("Invalid source");

    const invalidTarget = await getExchangeRate("USD", "E", "latest");
    expect(isExchangeRateError(invalidTarget) && invalidTarget.error).toContain("Invalid target");
  });

  it("should handle API errors", async () => {
    // 404
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse({}, false, 404) as Response);
    let result = await getExchangeRate("USD", "XYZ", "latest");
    expect(isExchangeRateError(result) && result.error).toContain("Currency pair not found");

    // 500
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse({}, false, 500) as Response);
    result = await getExchangeRate("USD", "EUR", "latest");
    expect(isExchangeRateError(result) && result.error).toContain("API request failed");

    // Network error
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));
    result = await getExchangeRate("USD", "EUR", "latest");
    expect(isExchangeRateError(result) && result.error).toContain("Network error");

    // Invalid response format
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse({ invalid: "data" }) as Response);
    result = await getExchangeRate("USD", "EUR", "latest");
    expect(isExchangeRateError(result) && result.error).toContain("Invalid API response");
  });

  it("should use defaults, uppercase codes, and construct correct URLs", async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse(validResponse) as Response);

    await getExchangeRate();
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/from=USD.*to=EUR/));

    await getExchangeRate("usd", "eur", "latest");
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/from=USD.*to=EUR/));

    await getExchangeRate("GBP", "JPY", "2023-12-25");
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("api.frankfurter.app/2023-12-25"));
  });
});

describe("isExchangeRateError", () => {
  it("should correctly identify errors vs success", () => {
    expect(isExchangeRateError({ error: "Test error" })).toBe(true);
    expect(isExchangeRateError(validResponse)).toBe(false);
  });
});
