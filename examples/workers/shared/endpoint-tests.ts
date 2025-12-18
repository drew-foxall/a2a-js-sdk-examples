/**
 * Shared Endpoint Tests for A2A Workers
 *
 * This module provides reusable endpoint tests that work across different test types:
 *
 * ## Test Types
 *
 * | Type        | Target              | AI Calls | Use Case                    |
 * |-------------|---------------------|----------|------------------------------|
 * | Smoke       | Local wrangler dev  | Mocked   | Build & startup validation   |
 * | E2E         | Local Hono app      | Mocked   | Full HTTP stack, CI-friendly |
 * | Integration | Deployed URL        | Real     | Production validation        |
 *
 * ## Usage
 *
 * @example E2E tests (local app with mocked AI)
 * ```typescript
 * import { createEndpointTestSuite } from "a2a-workers-shared/endpoint-tests";
 * import { createMockEnv, setTestModel, createMockModel } from "a2a-workers-shared/test-utils";
 * import app from "../src/index";
 *
 * beforeAll(() => setTestModel(createMockModel({ response: "Hello!" })));
 * afterAll(() => setTestModel(null));
 *
 * createEndpointTestSuite({
 *   name: "Hello World",
 *   target: { type: "app", app, env: createMockEnv() },
 *   expectedAgentName: "Hello World Agent",
 * });
 * ```
 *
 * @example Integration tests (deployed endpoint)
 * ```typescript
 * import { runEndpointTests, formatTestResults } from "a2a-workers-shared/endpoint-tests";
 *
 * const results = await runEndpointTests({
 *   name: "Hello World",
 *   target: { type: "url", baseUrl: "https://hello-world.workers.dev" },
 *   expectedAgentName: "Hello World Agent",
 * });
 * console.log(formatTestResults(results));
 * ```
 */

import type { Hono } from "hono";
import type { BaseWorkerEnv } from "./worker-config.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Target for running tests - either a local Hono app or a remote URL
 */
export type TestTarget<TEnv extends BaseWorkerEnv = BaseWorkerEnv> =
  | { type: "app"; app: Hono<{ Bindings: TEnv }>; env: TEnv }
  | { type: "url"; baseUrl: string; headers?: Record<string, string> };

/**
 * Configuration for endpoint tests
 */
export interface EndpointTestConfig<TEnv extends BaseWorkerEnv = BaseWorkerEnv> {
  /** Name of the worker (for test descriptions) */
  name: string;

  /** Test target - local app or remote URL */
  target: TestTarget<TEnv>;

  /** Expected agent name in responses (optional - if not provided, just checks field exists) */
  expectedAgentName?: string;

  /** Expected number of skills (optional) */
  expectedSkillCount?: number;

  /** Sample message for testing message/send */
  sampleMessage?: string;

  /** Timeout for requests in ms */
  timeout?: number;
}

/**
 * Result of a single endpoint test
 */
export interface EndpointTestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  response?: {
    status: number;
    body?: unknown;
  };
}

/**
 * Results from running all endpoint tests
 */
export interface EndpointTestResults {
  target: string;
  tests: EndpointTestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    duration: number;
  };
}

// ============================================================================
// Request Helpers
// ============================================================================

/**
 * Make a request to the test target
 */
async function makeRequest<TEnv extends BaseWorkerEnv>(
  target: TestTarget<TEnv>,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  if (target.type === "app") {
    const url = `http://localhost${path}`;
    const request = new Request(url, options);
    return target.app.fetch(request, target.env);
  }

  const url = `${target.baseUrl}${path}`;
  const headers = {
    ...options.headers,
    ...target.headers,
  };
  return fetch(url, { ...options, headers });
}

/**
 * Create a JSON-RPC request body
 */
function createJsonRpcBody(
  method: string,
  params: unknown,
  id: string = `test-${Date.now()}`
): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    id,
    method,
    params,
  });
}

// ============================================================================
// Individual Tests
// ============================================================================

/**
 * Test the health check endpoint
 */
export async function testHealthCheck<TEnv extends BaseWorkerEnv>(
  target: TestTarget<TEnv>,
  expectedAgentName?: string
): Promise<EndpointTestResult> {
  const startTime = Date.now();
  const testName = "Health Check";

  try {
    const response = await makeRequest(target, "/health");
    const duration = Date.now() - startTime;

    if (!response.ok) {
      return {
        name: testName,
        passed: false,
        duration,
        error: `HTTP ${response.status}`,
        response: { status: response.status },
      };
    }

    const body = (await response.json()) as Record<string, unknown>;

    if (body.status !== "healthy") {
      return {
        name: testName,
        passed: false,
        duration,
        error: `Expected status "healthy", got "${body.status}"`,
        response: { status: response.status, body },
      };
    }

    // Only validate agent name if expected name is provided
    if (expectedAgentName && body.agent !== expectedAgentName) {
      return {
        name: testName,
        passed: false,
        duration,
        error: `Expected agent "${expectedAgentName}", got "${body.agent}"`,
        response: { status: response.status, body },
      };
    }

    // If no expected name, just verify agent field exists
    if (!expectedAgentName && !body.agent) {
      return {
        name: testName,
        passed: false,
        duration,
        error: `Missing "agent" field in health response`,
        response: { status: response.status, body },
      };
    }

    return {
      name: testName,
      passed: true,
      duration,
      response: { status: response.status, body },
    };
  } catch (error) {
    return {
      name: testName,
      passed: false,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Test the agent card endpoint
 */
export async function testAgentCard<TEnv extends BaseWorkerEnv>(
  target: TestTarget<TEnv>,
  expectedAgentName?: string,
  expectedSkillCount?: number
): Promise<EndpointTestResult> {
  const startTime = Date.now();
  const testName = "Agent Card";

  try {
    const response = await makeRequest(target, "/.well-known/agent-card.json");
    const duration = Date.now() - startTime;

    if (!response.ok) {
      return {
        name: testName,
        passed: false,
        duration,
        error: `HTTP ${response.status}`,
        response: { status: response.status },
      };
    }

    const body = (await response.json()) as Record<string, unknown>;

    // Validate agent name if expected name is provided
    if (expectedAgentName && body.name !== expectedAgentName) {
      return {
        name: testName,
        passed: false,
        duration,
        error: `Expected name "${expectedAgentName}", got "${body.name}"`,
        response: { status: response.status, body },
      };
    }

    // If no expected name, just verify name field exists
    if (!expectedAgentName && !body.name) {
      return {
        name: testName,
        passed: false,
        duration,
        error: `Missing "name" field in agent card`,
        response: { status: response.status, body },
      };
    }

    if (!body.protocolVersion) {
      return {
        name: testName,
        passed: false,
        duration,
        error: "Missing protocolVersion",
        response: { status: response.status, body },
      };
    }

    if (!body.url) {
      return {
        name: testName,
        passed: false,
        duration,
        error: "Missing url",
        response: { status: response.status, body },
      };
    }

    if (!body.capabilities) {
      return {
        name: testName,
        passed: false,
        duration,
        error: "Missing capabilities",
        response: { status: response.status, body },
      };
    }

    // Check skill count if specified
    if (expectedSkillCount !== undefined) {
      const skills = body.skills as unknown[] | undefined;
      if (!skills || skills.length !== expectedSkillCount) {
        return {
          name: testName,
          passed: false,
          duration,
          error: `Expected ${expectedSkillCount} skills, got ${skills?.length ?? 0}`,
          response: { status: response.status, body },
        };
      }
    }

    return {
      name: testName,
      passed: true,
      duration,
      response: { status: response.status, body },
    };
  } catch (error) {
    return {
      name: testName,
      passed: false,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Test the message/send endpoint
 */
export async function testMessageSend<TEnv extends BaseWorkerEnv>(
  target: TestTarget<TEnv>,
  message: string = "Hello"
): Promise<EndpointTestResult> {
  const startTime = Date.now();
  const testName = "Message Send";

  try {
    const body = createJsonRpcBody("message/send", {
      message: {
        messageId: `msg-${Date.now()}`,
        role: "user",
        parts: [{ kind: "text", text: message }],
      },
    });

    const response = await makeRequest(target, "/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      return {
        name: testName,
        passed: false,
        duration,
        error: `HTTP ${response.status}`,
        response: { status: response.status },
      };
    }

    const result = (await response.json()) as {
      jsonrpc: string;
      result?: { id?: string; status?: string };
      error?: { code: number; message: string };
    };

    if (result.error) {
      return {
        name: testName,
        passed: false,
        duration,
        error: `JSON-RPC error: ${result.error.message}`,
        response: { status: response.status, body: result },
      };
    }

    if (!result.result?.id) {
      return {
        name: testName,
        passed: false,
        duration,
        error: "Missing task ID in response",
        response: { status: response.status, body: result },
      };
    }

    return {
      name: testName,
      passed: true,
      duration,
      response: { status: response.status, body: result },
    };
  } catch (error) {
    return {
      name: testName,
      passed: false,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Test CORS headers
 */
export async function testCors<TEnv extends BaseWorkerEnv>(
  target: TestTarget<TEnv>
): Promise<EndpointTestResult> {
  const startTime = Date.now();
  const testName = "CORS Headers";

  try {
    const response = await makeRequest(target, "/health");
    const duration = Date.now() - startTime;

    const corsHeader = response.headers.get("Access-Control-Allow-Origin");

    if (!corsHeader) {
      return {
        name: testName,
        passed: false,
        duration,
        error: "Missing Access-Control-Allow-Origin header",
        response: { status: response.status },
      };
    }

    return {
      name: testName,
      passed: true,
      duration,
      response: { status: response.status },
    };
  } catch (error) {
    return {
      name: testName,
      passed: false,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Test 404 handling
 */
export async function test404Handling<TEnv extends BaseWorkerEnv>(
  target: TestTarget<TEnv>
): Promise<EndpointTestResult> {
  const startTime = Date.now();
  const testName = "404 Handling";

  try {
    const response = await makeRequest(target, "/unknown-endpoint-12345");
    const duration = Date.now() - startTime;

    if (response.status !== 404) {
      return {
        name: testName,
        passed: false,
        duration,
        error: `Expected 404, got ${response.status}`,
        response: { status: response.status },
      };
    }

    return {
      name: testName,
      passed: true,
      duration,
      response: { status: response.status },
    };
  } catch (error) {
    return {
      name: testName,
      passed: false,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Test internal consistency between health check and agent card
 * 
 * Validates that the agent name in /health matches the name in agent card.
 * This catches configuration mismatches without needing to know expected values.
 */
export async function testInternalConsistency<TEnv extends BaseWorkerEnv>(
  target: TestTarget<TEnv>
): Promise<EndpointTestResult> {
  const startTime = Date.now();
  const testName = "Internal Consistency";

  try {
    // Fetch both endpoints
    const [healthResponse, cardResponse] = await Promise.all([
      makeRequest(target, "/health"),
      makeRequest(target, "/.well-known/agent-card.json"),
    ]);
    const duration = Date.now() - startTime;

    // Check health response
    if (!healthResponse.ok) {
      return {
        name: testName,
        passed: false,
        duration,
        error: `Health endpoint returned ${healthResponse.status}`,
      };
    }

    // Check agent card response
    if (!cardResponse.ok) {
      return {
        name: testName,
        passed: false,
        duration,
        error: `Agent card endpoint returned ${cardResponse.status}`,
      };
    }

    const healthBody = (await healthResponse.json()) as Record<string, unknown>;
    const cardBody = (await cardResponse.json()) as Record<string, unknown>;

    const healthAgentName = healthBody.agent;
    const cardAgentName = cardBody.name;

    // Both should have agent names
    if (!healthAgentName) {
      return {
        name: testName,
        passed: false,
        duration,
        error: `Health response missing "agent" field`,
      };
    }

    if (!cardAgentName) {
      return {
        name: testName,
        passed: false,
        duration,
        error: `Agent card missing "name" field`,
      };
    }

    // Names should match
    if (healthAgentName !== cardAgentName) {
      return {
        name: testName,
        passed: false,
        duration,
        error: `Agent name mismatch: health="${healthAgentName}", card="${cardAgentName}"`,
      };
    }

    return {
      name: testName,
      passed: true,
      duration,
      response: { 
        status: 200, 
        body: { healthAgent: healthAgentName, cardName: cardAgentName } 
      },
    };
  } catch (error) {
    return {
      name: testName,
      passed: false,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// Test Runner
// ============================================================================

/**
 * Run all endpoint tests against a target
 *
 * @param config - Test configuration
 * @returns Test results
 *
 * @example
 * ```typescript
 * const results = await runEndpointTests({
 *   name: "Hello World",
 *   target: { type: "url", baseUrl: "https://hello-world.workers.dev" },
 *   expectedAgentName: "Hello World Agent",
 * });
 *
 * console.log(`Passed: ${results.summary.passed}/${results.summary.total}`);
 * ```
 */
export async function runEndpointTests<TEnv extends BaseWorkerEnv>(
  config: EndpointTestConfig<TEnv>
): Promise<EndpointTestResults> {
  const {
    target,
    expectedAgentName,
    expectedSkillCount,
    sampleMessage = "Hello",
  } = config;

  const targetDescription =
    target.type === "app" ? "local app" : target.baseUrl;

  const startTime = Date.now();
  const tests: EndpointTestResult[] = [];

  // Run tests sequentially
  tests.push(await testHealthCheck(target, expectedAgentName));
  tests.push(await testAgentCard(target, expectedAgentName, expectedSkillCount));
  tests.push(await testCors(target));
  tests.push(await test404Handling(target));
  
  // Internal consistency check - validates health agent name matches card name
  // Only run if we're not already validating against an expected name
  if (!expectedAgentName) {
    tests.push(await testInternalConsistency(target));
  }

  // Only run message/send if explicitly enabled
  // Message tests make real AI API calls, so they're opt-in
  if (process.env.RUN_MESSAGE_TESTS === "true") {
    tests.push(await testMessageSend(target, sampleMessage));
  }

  const totalDuration = Date.now() - startTime;
  const passed = tests.filter((t) => t.passed).length;
  const failed = tests.filter((t) => !t.passed).length;

  return {
    target: targetDescription,
    tests,
    summary: {
      total: tests.length,
      passed,
      failed,
      duration: totalDuration,
    },
  };
}

// ============================================================================
// Vitest Integration
// ============================================================================

/**
 * Create a Vitest test suite for endpoint tests
 *
 * This integrates with Vitest's describe/it/expect for use in test files.
 *
 * @example
 * ```typescript
 * import { createEndpointTestSuite } from "a2a-workers-shared/endpoint-tests";
 * import { createMockEnv } from "a2a-workers-shared/test-utils";
 * import app from "../src/index";
 *
 * createEndpointTestSuite({
 *   name: "Hello World",
 *   target: { type: "app", app, env: createMockEnv() },
 *   expectedAgentName: "Hello World Agent",
 * });
 * ```
 */
export function createEndpointTestSuite<TEnv extends BaseWorkerEnv>(
  config: EndpointTestConfig<TEnv>
): void {
  // Dynamic import to avoid requiring vitest in non-test contexts
  const { describe, it, expect } = require("vitest");

  const { name, target, expectedAgentName, expectedSkillCount, sampleMessage } =
    config;

  describe(`${name} Endpoint Tests`, () => {
    it("should return healthy status from /health", async () => {
      const result = await testHealthCheck(target, expectedAgentName);
      expect(result.passed).toBe(true);
      if (!result.passed) {
        throw new Error(result.error);
      }
    });

    it("should return valid agent card", async () => {
      const result = await testAgentCard(
        target,
        expectedAgentName,
        expectedSkillCount
      );
      expect(result.passed).toBe(true);
      if (!result.passed) {
        throw new Error(result.error);
      }
    });

    it("should include CORS headers", async () => {
      const result = await testCors(target);
      expect(result.passed).toBe(true);
      if (!result.passed) {
        throw new Error(result.error);
      }
    });

    it("should return 404 for unknown endpoints", async () => {
      const result = await test404Handling(target);
      expect(result.passed).toBe(true);
      if (!result.passed) {
        throw new Error(result.error);
      }
    });

    // Conditionally include message test (opt-in only, makes real AI calls)
    const shouldRunMessageTest = process.env.RUN_MESSAGE_TESTS === "true";

    if (shouldRunMessageTest) {
      it("should handle message/send", async () => {
        const result = await testMessageSend(target, sampleMessage);
        expect(result.passed).toBe(true);
        if (!result.passed) {
          throw new Error(result.error);
        }
      });
    }
  });
}

// ============================================================================
// CLI Helpers
// ============================================================================

/**
 * Format test results for console output
 */
export function formatTestResults(results: EndpointTestResults): string {
  const lines: string[] = [];

  lines.push(`\n📋 Endpoint Tests: ${results.target}`);
  lines.push("─".repeat(60));

  for (const test of results.tests) {
    const icon = test.passed ? "✅" : "❌";
    const duration = `${test.duration}ms`;
    const status = test.passed ? "PASS" : "FAIL";

    lines.push(`${icon} ${test.name.padEnd(30)} ${status.padEnd(6)} ${duration}`);

    if (!test.passed && test.error) {
      lines.push(`   └─ ${test.error}`);
    }
  }

  lines.push("─".repeat(60));
  lines.push(
    `Summary: ${results.summary.passed}/${results.summary.total} passed in ${results.summary.duration}ms`
  );

  return lines.join("\n");
}

/**
 * Run endpoint tests from CLI against a URL
 *
 * @example
 * ```typescript
 * // In a script:
 * await runEndpointTestsCLI({
 *   name: "Hello World",
 *   baseUrl: "https://hello-world.workers.dev",
 *   expectedAgentName: "Hello World Agent",
 * });
 * ```
 */
export async function runEndpointTestsCLI(config: {
  name: string;
  baseUrl: string;
  expectedAgentName: string;
  expectedSkillCount?: number;
  sampleMessage?: string;
  headers?: Record<string, string>;
}): Promise<boolean> {
  const results = await runEndpointTests({
    name: config.name,
    target: {
      type: "url",
      baseUrl: config.baseUrl,
      headers: config.headers,
    },
    expectedAgentName: config.expectedAgentName,
    expectedSkillCount: config.expectedSkillCount,
    sampleMessage: config.sampleMessage,
  });

  console.log(formatTestResults(results));

  return results.summary.failed === 0;
}

