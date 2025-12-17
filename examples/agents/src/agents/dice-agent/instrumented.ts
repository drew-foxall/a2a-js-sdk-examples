/**
 * Instrumented Dice Agent
 *
 * Demonstrates how to add pluggable telemetry to an agent.
 * This version of the dice agent includes full observability:
 * - Span tracking for all operations
 * - Tool execution metrics
 * - Error recording
 *
 * The telemetry provider is injected, making it easy to:
 * - Use console logging in development
 * - Switch to OpenTelemetry in production
 * - Disable entirely with NoOp provider
 *
 * @example
 * ```typescript
 * import { createInstrumentedDiceAgent } from "a2a-agents/dice-agent/instrumented";
 * import { createTelemetry } from "a2a-agents";
 *
 * // Development: Console telemetry
 * const telemetry = createTelemetry({
 *   provider: "console",
 *   serviceName: "dice-agent",
 *   format: "pretty",
 * });
 *
 * const agent = createInstrumentedDiceAgent(model, telemetry);
 * ```
 */

import { type LanguageModel, ToolLoopAgent } from "ai";
import { z } from "zod";
import {
  AgentAttributes,
  SpanNames,
  type TelemetryProvider,
} from "../../shared/telemetry/index.js";
import { getDiceAgentPrompt } from "./prompt.js";
import { checkPrime as checkPrimePure, rollDice as rollDicePure } from "./tools.js";

// ============================================================================
// Tool Schemas
// ============================================================================

const rollDiceSchema = z.object({
  sides: z.number().min(2).max(100).default(6).describe("Number of sides on the dice (default: 6)"),
});

const checkPrimeSchema = z.object({
  numbers: z.array(z.number()).describe("List of numbers to check for primality"),
});

type RollDiceParams = z.infer<typeof rollDiceSchema>;
type CheckPrimeParams = z.infer<typeof checkPrimeSchema>;

// ============================================================================
// Instrumented Agent Factory
// ============================================================================

/**
 * Create an instrumented Dice Agent with pluggable telemetry
 *
 * This agent wraps all operations with telemetry spans:
 * - Tool executions are tracked with timing
 * - Errors are recorded with stack traces
 * - Metrics are emitted for monitoring
 *
 * @param model - The language model to use
 * @param telemetry - The telemetry provider (console, otel, noop, etc.)
 * @returns A configured ToolLoopAgent with telemetry
 */
export function createInstrumentedDiceAgent(model: LanguageModel, telemetry: TelemetryProvider) {
  return new ToolLoopAgent({
    model,
    instructions: getDiceAgentPrompt(),
    tools: {
      /**
       * Roll an N-sided dice with telemetry
       */
      rollDice: {
        description:
          "Rolls an N-sided dice and returns the result. By default uses a 6-sided dice.",
        inputSchema: rollDiceSchema,
        execute: async (params: RollDiceParams) => {
          const span = telemetry.startSpan(SpanNames.AGENT_EXECUTE_TOOL, {
            attributes: {
              [AgentAttributes.TOOL_NAME]: "rollDice",
              "dice.sides": params.sides,
            },
          });

          const startTime = Date.now();

          try {
            const result = rollDicePure(params.sides);

            span.setAttributes({
              "dice.result": result,
              [AgentAttributes.TOOL_SUCCESS]: true,
              [AgentAttributes.TOOL_DURATION_MS]: Date.now() - startTime,
            });
            span.setStatus("ok");

            // Record metric
            telemetry.recordMetric("dice.rolls", 1, {
              sides: params.sides,
            });

            telemetry.log("info", `Rolled d${params.sides}: ${result}`, {
              sides: params.sides,
              result,
            });

            return {
              sides: params.sides,
              result,
              message: `Rolled a ${params.sides}-sided die and got: ${result}`,
            };
          } catch (error) {
            span.recordException(error);
            span.setAttributes({
              [AgentAttributes.TOOL_SUCCESS]: false,
              [AgentAttributes.TOOL_DURATION_MS]: Date.now() - startTime,
            });
            span.setStatus("error", error instanceof Error ? error.message : "Unknown error");

            telemetry.log("error", "Failed to roll dice", {
              error: error instanceof Error ? error.message : String(error),
            });

            throw error;
          } finally {
            span.end();
          }
        },
      },

      /**
       * Check if numbers are prime with telemetry
       */
      checkPrime: {
        description:
          "Determines which numbers from a list are prime numbers. Returns a human-readable string.",
        inputSchema: checkPrimeSchema,
        execute: async (params: CheckPrimeParams) => {
          const span = telemetry.startSpan(SpanNames.AGENT_EXECUTE_TOOL, {
            attributes: {
              [AgentAttributes.TOOL_NAME]: "checkPrime",
              "numbers.count": params.numbers.length,
            },
          });

          const startTime = Date.now();

          try {
            const result = checkPrimePure(params.numbers);

            span.setAttributes({
              [AgentAttributes.TOOL_SUCCESS]: true,
              [AgentAttributes.TOOL_DURATION_MS]: Date.now() - startTime,
            });
            span.setStatus("ok");

            // Record metric
            telemetry.recordMetric("prime.checks", params.numbers.length);

            telemetry.log("info", "Checked prime numbers", {
              count: params.numbers.length,
              numbers: params.numbers.slice(0, 5), // Log first 5 for brevity
            });

            return {
              checked: params.numbers,
              result,
            };
          } catch (error) {
            span.recordException(error);
            span.setAttributes({
              [AgentAttributes.TOOL_SUCCESS]: false,
              [AgentAttributes.TOOL_DURATION_MS]: Date.now() - startTime,
            });
            span.setStatus("error", error instanceof Error ? error.message : "Unknown error");

            telemetry.log("error", "Failed to check primes", {
              error: error instanceof Error ? error.message : String(error),
            });

            throw error;
          } finally {
            span.end();
          }
        },
      },
    },
  });
}

/**
 * Higher-level helper to wrap message processing with telemetry
 *
 * @example
 * ```typescript
 * const processWithTelemetry = createInstrumentedMessageProcessor(
 *   agent,
 *   telemetry,
 *   "dice-agent"
 * );
 *
 * const result = await processWithTelemetry(message, contextId);
 * ```
 */
export function createInstrumentedMessageProcessor(
  agent: ReturnType<typeof createInstrumentedDiceAgent>,
  telemetry: TelemetryProvider,
  agentName: string
) {
  return async (message: string, options?: { messageId?: string; contextId?: string }) => {
    const span = telemetry.startSpan(SpanNames.PROCESS_MESSAGE, {
      attributes: {
        [AgentAttributes.AGENT_NAME]: agentName,
        [AgentAttributes.MESSAGE_ID]: options?.messageId ?? "unknown",
        [AgentAttributes.CONTEXT_ID]: options?.contextId ?? "unknown",
      },
    });

    const startTime = Date.now();

    try {
      telemetry.log("info", "Processing message", {
        agentName,
        messageLength: message.length,
      });

      // Call the agent (using stream for the example)
      const stream = await agent.stream({
        prompt: message,
      });

      // Collect the response
      let responseText = "";
      for await (const chunk of stream.textStream) {
        responseText += chunk;
      }

      span.setAttributes({
        "response.length": responseText.length,
        [AgentAttributes.TOOL_DURATION_MS]: Date.now() - startTime,
      });
      span.setStatus("ok");

      telemetry.log("info", "Message processed successfully", {
        agentName,
        duration: Date.now() - startTime,
      });

      return { text: responseText };
    } catch (error) {
      span.recordException(error);
      span.setStatus("error", error instanceof Error ? error.message : "Unknown error");

      telemetry.log("error", "Message processing failed", {
        agentName,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    } finally {
      span.end();
    }
  };
}
