/**
 * Expense Agent
 *
 * A protocol-agnostic AI agent that processes expense reimbursement requests.
 *
 * Features:
 * - Expense detail extraction from natural language
 * - Multi-turn conversation for missing fields
 * - Expense type categorization
 * - Reference number generation
 *
 * This agent demonstrates:
 * - Form-like data collection via conversation
 * - Validation and confirmation patterns
 * - Business workflow automation
 */

import { type LanguageModel, ToolLoopAgent } from "ai";
import { z } from "zod";
import { getExpenseAgentPrompt } from "./prompt";

/**
 * Expense submission tool schema
 */
const submitExpenseSchema = z.object({
  expenseType: z
    .enum(["travel", "meals", "supplies", "equipment", "other"])
    .describe("Type of expense"),
  amount: z.number().positive().describe("Amount in USD"),
  date: z.string().describe("Date of expense (YYYY-MM-DD)"),
  description: z.string().optional().describe("Brief description"),
  receiptAttached: z.boolean().default(false).describe("Whether receipt is attached"),
});

type SubmitExpenseParams = z.infer<typeof submitExpenseSchema>;

/**
 * Generate a reference number for the expense
 */
function generateReferenceNumber(date: string): string {
  const dateStr = date.replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `EXP-${dateStr}-${random}`;
}

/**
 * Create an Expense Agent
 *
 * This is a protocol-agnostic AI agent that can be exposed through
 * multiple interfaces (A2A, MCP, REST, CLI, etc.)
 *
 * @param model - The language model to use (from getModel() utility)
 * @returns A configured ToolLoopAgent for expense processing
 */
export function createExpenseAgent(model: LanguageModel) {
  return new ToolLoopAgent({
    model,
    instructions: getExpenseAgentPrompt(),
    tools: {
      submit_expense: {
        description:
          "Submit an expense for reimbursement. Only call when all required fields are available.",
        inputSchema: submitExpenseSchema,
        execute: async (params: SubmitExpenseParams) => {
          // Validate date
          const expenseDate = new Date(params.date);
          const today = new Date();

          if (Number.isNaN(expenseDate.getTime())) {
            return { success: false, error: "Invalid date format. Use YYYY-MM-DD." };
          }

          if (expenseDate > today) {
            return { success: false, error: "Expense date cannot be in the future." };
          }

          // Generate reference number
          const reference = generateReferenceNumber(params.date);

          // Return success response
          return {
            success: true,
            reference,
            expense: {
              type: params.expenseType,
              amount: params.amount,
              date: params.date,
              description: params.description || "Not provided",
              receiptAttached: params.receiptAttached,
            },
            message: `Expense ${reference} submitted successfully. Review expected within 3-5 business days.`,
          };
        },
      },
    },
  });
}
