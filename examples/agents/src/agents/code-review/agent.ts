/**
 * Code Review Agent
 *
 * A protocol-agnostic AI agent that reviews JavaScript/TypeScript code.
 *
 * Features:
 * - Static code analysis
 * - Security vulnerability detection
 * - Best practice suggestions
 * - Performance recommendations
 *
 * This agent demonstrates:
 * - Code analysis tools
 * - Structured feedback
 * - Expert knowledge synthesis
 */

import { type LanguageModel, ToolLoopAgent } from "ai";
import { z } from "zod";
import { getCodeReviewPrompt } from "./prompt";

/**
 * Simple code analysis patterns
 * In a production system, this could call external linting services
 */
function analyzeCodePatterns(code: string, language: string): AnalysisResult {
  const issues: CodeIssue[] = [];

  // Check for common issues based on language
  if (language === "javascript" || language === "typescript") {
    // Check for console.log statements
    const consoleMatches = code.match(/console\.(log|warn|error)\(/g);
    if (consoleMatches) {
      issues.push({
        severity: "warning",
        message: `Found ${consoleMatches.length} console statement(s) - remove before production`,
        line: findLineNumber(code, "console."),
        rule: "no-console",
      });
    }

    // Check for var usage
    if (/\bvar\s+\w+/.test(code)) {
      issues.push({
        severity: "warning",
        message: "Use 'const' or 'let' instead of 'var'",
        line: findLineNumber(code, "var "),
        rule: "no-var",
      });
    }

    // Check for == instead of ===
    if (/[^=!]==[^=]/.test(code)) {
      issues.push({
        severity: "warning",
        message: "Use strict equality (===) instead of loose equality (==)",
        line: findLineNumber(code, "=="),
        rule: "eqeqeq",
      });
    }

    // Check for any type
    if (language === "typescript" && /:\s*any\b/.test(code)) {
      issues.push({
        severity: "warning",
        message: "Avoid using 'any' type - use specific types or 'unknown'",
        line: findLineNumber(code, ": any"),
        rule: "no-explicit-any",
      });
    }

    // Check for TODO comments
    const todoMatches = code.match(/\/\/\s*TODO/gi);
    if (todoMatches) {
      issues.push({
        severity: "info",
        message: `Found ${todoMatches.length} TODO comment(s)`,
        line: findLineNumber(code, "TODO"),
        rule: "no-todo",
      });
    }

    // Check for potential security issues
    if (/eval\(/.test(code)) {
      issues.push({
        severity: "critical",
        message: "Avoid using eval() - it can execute arbitrary code",
        line: findLineNumber(code, "eval("),
        rule: "no-eval",
      });
    }

    if (/innerHTML\s*=/.test(code)) {
      issues.push({
        severity: "critical",
        message: "innerHTML can lead to XSS vulnerabilities - use textContent or sanitize input",
        line: findLineNumber(code, "innerHTML"),
        rule: "no-inner-html",
      });
    }

    // Check for hardcoded secrets
    if (/(?:password|secret|api_?key|token)\s*[:=]\s*['"][^'"]+['"]/i.test(code)) {
      issues.push({
        severity: "critical",
        message: "Potential hardcoded secret detected - use environment variables",
        line: findLineNumber(code, "password"),
        rule: "no-hardcoded-secrets",
      });
    }

    // Check for empty catch blocks
    if (/catch\s*\([^)]*\)\s*{\s*}/.test(code)) {
      issues.push({
        severity: "warning",
        message: "Empty catch block - errors should be handled or logged",
        line: findLineNumber(code, "catch"),
        rule: "no-empty-catch",
      });
    }
  }

  return {
    language,
    issueCount: issues.length,
    issues,
    metrics: {
      lines: code.split("\n").length,
      characters: code.length,
    },
  };
}

/**
 * Find the line number where a pattern first appears
 */
function findLineNumber(code: string, pattern: string): number | undefined {
  const lines = code.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]?.includes(pattern)) {
      return i + 1;
    }
  }
  return undefined;
}

interface CodeIssue {
  severity: "critical" | "warning" | "info";
  message: string;
  line?: number;
  rule: string;
}

interface AnalysisResult {
  language: string;
  issueCount: number;
  issues: CodeIssue[];
  metrics: {
    lines: number;
    characters: number;
  };
}

/**
 * Code analysis tool schema
 */
const analyzeCodeSchema = z.object({
  code: z.string().describe("The code to analyze"),
  language: z
    .enum(["javascript", "typescript", "python", "other"])
    .default("javascript")
    .describe("The programming language of the code"),
});

type AnalyzeCodeParams = z.infer<typeof analyzeCodeSchema>;

/**
 * Create a Code Review Agent
 *
 * This is a protocol-agnostic AI agent that can be exposed through
 * multiple interfaces (A2A, MCP, REST, CLI, etc.)
 *
 * @param model - The language model to use for analysis
 * @returns A configured ToolLoopAgent for code review
 */
export function createCodeReviewAgent(model: LanguageModel) {
  return new ToolLoopAgent({
    model,
    instructions: getCodeReviewPrompt(),
    tools: {
      analyze_code: {
        description:
          "Analyze code for common issues, security vulnerabilities, and best practice violations. Returns a structured report of findings.",
        inputSchema: analyzeCodeSchema,
        execute: async (params: AnalyzeCodeParams) => {
          const result = analyzeCodePatterns(params.code, params.language);

          return {
            success: true,
            analysis: result,
            summary:
              result.issueCount === 0
                ? "No issues found"
                : `Found ${result.issueCount} issue(s): ${result.issues.filter((i) => i.severity === "critical").length} critical, ${result.issues.filter((i) => i.severity === "warning").length} warnings, ${result.issues.filter((i) => i.severity === "info").length} info`,
          };
        },
      },
    },
  });
}
