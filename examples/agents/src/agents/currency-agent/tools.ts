/**
 * Currency Agent Tools
 *
 * Currency conversion using the Frankfurter API (free, no API key required).
 * These tools demonstrate:
 * - External API integration
 * - Error handling
 * - Data validation
 * - Real-time exchange rates
 */

/**
 * Exchange Rate API Response
 */
export interface ExchangeRateResponse {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
}

/**
 * Exchange Rate Error Response
 */
export interface ExchangeRateError {
  error: string;
}

/**
 * Get exchange rate from Frankfurter API
 *
 * @param currencyFrom - Source currency code (e.g., "USD")
 * @param currencyTo - Target currency code (e.g., "EUR")
 * @param currencyDate - Date for exchange rate or "latest" (default)
 * @returns Exchange rate data or error
 */
export async function getExchangeRate(
  currencyFrom: string = "USD",
  currencyTo: string = "EUR",
  currencyDate: string = "latest"
): Promise<ExchangeRateResponse | ExchangeRateError> {
  try {
    // Validate currency codes (basic check)
    if (!currencyFrom || currencyFrom.length !== 3) {
      return { error: `Invalid source currency code: ${currencyFrom}` };
    }
    if (!currencyTo || currencyTo.length !== 3) {
      return { error: `Invalid target currency code: ${currencyTo}` };
    }

    // Build URL with query parameters
    const url = new URL(`https://api.frankfurter.app/${currencyDate}`);
    url.searchParams.set("from", currencyFrom.toUpperCase());
    url.searchParams.set("to", currencyTo.toUpperCase());

    // Fetch exchange rate
    const response = await fetch(url.toString());

    if (!response.ok) {
      if (response.status === 404) {
        return {
          error: `Currency pair not found: ${currencyFrom} -> ${currencyTo}`,
        };
      }
      return {
        error: `API request failed: ${response.status} ${response.statusText}`,
      };
    }

    const data = await response.json();

    // Validate response format
    if (!data.rates || typeof data.rates !== "object") {
      return { error: "Invalid API response format" };
    }

    return data as ExchangeRateResponse;
  } catch (error) {
    if (error instanceof Error) {
      return { error: `API request failed: ${error.message}` };
    }
    return { error: "Unknown error occurred" };
  }
}

/**
 * Check if response is an error
 */
export function isExchangeRateError(
  response: ExchangeRateResponse | ExchangeRateError
): response is ExchangeRateError {
  return "error" in response;
}
