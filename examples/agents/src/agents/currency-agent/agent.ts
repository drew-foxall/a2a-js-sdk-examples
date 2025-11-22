/**
 * Currency Agent
 *
 * A protocol-agnostic AI agent demonstrating currency conversion and multi-turn conversation.
 *
 * Features:
 * - Currency conversion via Frankfurter API
 * - Multi-turn conversation (can ask for missing info)
 * - Conversation memory (context tracking)
 * - Tool usage with external API
 *
 * This agent can:
 * - Convert amounts between currencies
 * - Provide current exchange rates
 * - Request additional information when needed
 * - Maintain conversation context
 */

import { type LanguageModel, ToolLoopAgent } from "ai";
import { z } from "zod";
import { getCurrencyAgentPrompt } from "./prompt";
import { getExchangeRate, isExchangeRateError } from "./tools";

/**
 * Exchange rate tool parameter schema
 */
const exchangeRateSchema = z.object({
  currencyFrom: z.string().length(3).describe("Source currency code (e.g., USD, EUR, GBP)"),
  currencyTo: z.string().length(3).describe("Target currency code (e.g., USD, EUR, GBP)"),
  currencyDate: z.string().optional().describe('Date for exchange rate (YYYY-MM-DD) or "latest"'),
});

type ExchangeRateParams = z.infer<typeof exchangeRateSchema>;

/**
 * Create a Currency Agent
 *
 * This is a protocol-agnostic AI agent that can be exposed through
 * multiple interfaces (A2A, MCP, REST, CLI, etc.)
 *
 * The agent has one tool: get_exchange_rate, which integrates with
 * the Frankfurter API to fetch real-time currency exchange rates.
 *
 * @param model - The language model to use (from getModel() utility)
 * @returns A configured ToolLoopAgent
 */
export function createCurrencyAgent(model: LanguageModel) {
  return new ToolLoopAgent({
    model,
    instructions: getCurrencyAgentPrompt(),
    tools: {
      get_exchange_rate: {
        description: "Get current exchange rate between two currencies using Frankfurter API",
        inputSchema: exchangeRateSchema,
        execute: async (params: ExchangeRateParams) => {
          const result = await getExchangeRate(
            params.currencyFrom,
            params.currencyTo,
            params.currencyDate || "latest"
          );

          // Return error if API failed
          if (isExchangeRateError(result)) {
            return { error: result.error };
          }

          // Return formatted exchange rate data
          return {
            success: true,
            base: result.base,
            target: params.currencyTo,
            date: result.date,
            rate: result.rates[params.currencyTo],
            amount: result.amount,
            rawData: result,
          };
        },
      },
    },
  });
}
