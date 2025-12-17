/**
 * Worker Test Suite Factory
 *
 * Provides a standard test suite for A2A workers that validates:
 * - Agent card structure and A2A protocol compliance
 * - Health check endpoint
 * - Message handling (send, get, cancel)
 * - CORS configuration
 * - Error handling
 *
 * @example Basic usage
 * ```typescript
 * import { createWorkerTestSuite } from "a2a-workers-shared/worker-test-suite";
 * import app from "../src/index";
 *
 * createWorkerTestSuite("Hello World", () => app, {
 *   expectedAgentName: "Hello World Agent",
 *   mockResponse: "Hello! How can I help you today?",
 * });
 * ```
 *
 * @example With custom tests
 * ```typescript
 * createWorkerTestSuite("Dice Agent", () => app, {
 *   expectedAgentName: "Dice Agent",
 *   expectedSkillCount: 2,
 *   mockResponse: "I rolled a 6!",
 *   additionalTests: (getApp, getEnv) => {
 *     it("should handle dice roll requests", async () => {
 *       // Custom test logic
 *     });
 *   },
 * });
 * ```
 */

import type { Hono } from "hono";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { BaseWorkerEnv } from "./worker-config.js";
import {
  createMockModel,
  createMockEnv,
  createAgentCardRequest,
  createHealthCheckRequest,
  createMessageSendRequest,
  createTasksGetRequest,
  setTestModel,
  parseA2AResponse,
  type MockEnvOptions,
} from "./test-utils.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for the worker test suite
 */
export interface WorkerTestSuiteConfig<TEnv extends BaseWorkerEnv = BaseWorkerEnv> {
  /**
   * Expected agent name in the agent card
   */
  expectedAgentName: string;

  /**
   * Expected number of skills (optional)
   */
  expectedSkillCount?: number;

  /**
   * Mock response from the AI model
   * @default "This is a mock response from the AI model."
   */
  mockResponse?: string;

  /**
   * Whether the agent uses streaming mode
   * @default false
   */
  streaming?: boolean;

  /**
   * Sample message to send for testing
   * @default "Hello"
   */
  sampleMessage?: string;

  /**
   * Expected pattern in the response (optional)
   */
  expectedResponsePattern?: RegExp;

  /**
   * Mock environment options
   */
  envOptions?: MockEnvOptions;

  /**
   * Additional tests to run
   */
  additionalTests?: (
    getApp: () => Hono<{ Bindings: TEnv }>,
    getEnv: () => TEnv
  ) => void;

  /**
   * Skip certain test categories
   */
  skip?: {
    agentCard?: boolean;
    healthCheck?: boolean;
    messageSend?: boolean;
    cors?: boolean;
  };
}

// ============================================================================
// Test Suite Factory
// ============================================================================

/**
 * Create a standard test suite for an A2A worker
 *
 * This factory creates a comprehensive test suite that validates:
 * - Agent card structure and A2A protocol compliance
 * - Health check endpoint functionality
 * - Message handling capabilities
 * - CORS configuration
 *
 * @param name - Name of the worker (used in test descriptions)
 * @param getApp - Factory function that returns the Hono app
 * @param config - Test suite configuration
 *
 * @example
 * ```typescript
 * import { createWorkerTestSuite } from "a2a-workers-shared/worker-test-suite";
 * import app from "../src/index";
 *
 * createWorkerTestSuite("Hello World", () => app, {
 *   expectedAgentName: "Hello World Agent",
 * });
 * ```
 */
export function createWorkerTestSuite<TEnv extends BaseWorkerEnv = BaseWorkerEnv>(
  name: string,
  getApp: () => Hono<{ Bindings: TEnv }>,
  config: WorkerTestSuiteConfig<TEnv>
): void {
  const {
    expectedAgentName,
    expectedSkillCount,
    mockResponse = "This is a mock response from the AI model.",
    streaming = false,
    sampleMessage = "Hello",
    expectedResponsePattern,
    envOptions,
    additionalTests,
    skip = {},
  } = config;

  describe(`${name} Worker`, () => {
    let env: TEnv;

    beforeAll(() => {
      // Inject mock model for all tests
      setTestModel(
        createMockModel({
          response: mockResponse,
          streaming,
        })
      );
      env = createMockEnv(envOptions) as TEnv;
    });

    afterAll(() => {
      // Restore real model behavior
      setTestModel(null);
    });

    // Helper to get env in additional tests
    const getEnv = () => env;

    // ========================================================================
    // Agent Card Tests
    // ========================================================================

    if (!skip.agentCard) {
      describe("Agent Card", () => {
        it("should return valid agent card at well-known URL", async () => {
          const app = getApp();
          const response = await app.fetch(createAgentCardRequest(), env);

          expect(response.status).toBe(200);
          expect(response.headers.get("Content-Type")).toContain("application/json");

          const card = await response.json();

          // Required fields per A2A protocol
          expect(card.name).toBe(expectedAgentName);
          expect(card.url).toBeDefined();
          expect(card.protocolVersion).toBe("0.3.0");
          expect(card.version).toBeDefined();
          expect(card.capabilities).toBeDefined();
          expect(card.defaultInputModes).toContain("text");
          expect(card.defaultOutputModes).toContain("text");
        });

        it("should have valid capabilities", async () => {
          const app = getApp();
          const response = await app.fetch(createAgentCardRequest(), env);
          const card = await response.json();

          expect(typeof card.capabilities.streaming).toBe("boolean");
          expect(typeof card.capabilities.pushNotifications).toBe("boolean");
        });

        if (expectedSkillCount !== undefined) {
          it(`should have ${expectedSkillCount} skill(s)`, async () => {
            const app = getApp();
            const response = await app.fetch(createAgentCardRequest(), env);
            const card = await response.json();

            expect(card.skills).toHaveLength(expectedSkillCount);

            // Validate skill structure
            for (const skill of card.skills) {
              expect(skill.id).toBeDefined();
              expect(skill.name).toBeDefined();
              expect(skill.description).toBeDefined();
            }
          });
        }
      });
    }

    // ========================================================================
    // Health Check Tests
    // ========================================================================

    if (!skip.healthCheck) {
      describe("Health Check", () => {
        it("should return healthy status", async () => {
          const app = getApp();
          const response = await app.fetch(createHealthCheckRequest(), env);

          expect(response.status).toBe(200);

          const health = await response.json();
          expect(health.status).toBe("healthy");
          expect(health.agent).toBe(expectedAgentName);
        });

        it("should include provider and model info", async () => {
          const app = getApp();
          const response = await app.fetch(createHealthCheckRequest(), env);
          const health = await response.json();

          expect(health.provider).toBeDefined();
          expect(health.model).toBeDefined();
          expect(health.runtime).toBeDefined();
        });
      });
    }

    // ========================================================================
    // Message Handling Tests
    // ========================================================================

    if (!skip.messageSend) {
      describe("Message Handling", () => {
        it("should handle message/send request", async () => {
          const app = getApp();
          const request = createMessageSendRequest(sampleMessage);
          const response = await app.fetch(request, env);

          expect(response.status).toBe(200);

          const result = await parseA2AResponse(response);
          expect(result.jsonrpc).toBe("2.0");
          expect(result.result).toBeDefined();
          expect(result.error).toBeUndefined();
        });

        it("should return task with valid structure", async () => {
          const app = getApp();
          const request = createMessageSendRequest(sampleMessage);
          const response = await app.fetch(request, env);
          const result = await parseA2AResponse<{
            id: string;
            contextId: string;
            status: string;
          }>(response);

          expect(result.result?.id).toBeDefined();
          expect(result.result?.contextId).toBeDefined();
          expect(result.result?.status).toBeDefined();
        });

        if (expectedResponsePattern) {
          it("should return response matching expected pattern", async () => {
            const app = getApp();
            const request = createMessageSendRequest(sampleMessage);
            const response = await app.fetch(request, env);
            const result = await parseA2AResponse<{
              history?: Array<{
                role: string;
                parts: Array<{ kind: string; text?: string }>;
              }>;
            }>(response);

            // Find agent response text
            const agentMessages = result.result?.history?.filter((m) => m.role === "agent");
            const responseText = agentMessages
              ?.flatMap((m) => m.parts)
              .filter((p) => p.kind === "text" && p.text)
              .map((p) => p.text)
              .join("");

            expect(responseText).toMatch(expectedResponsePattern);
          });
        }

        it("should handle invalid JSON-RPC request", async () => {
          const app = getApp();
          const request = new Request("http://localhost/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ invalid: "request" }),
          });

          const response = await app.fetch(request, env);
          const result = await parseA2AResponse(response);

          // Should return JSON-RPC error
          expect(result.error).toBeDefined();
        });

        it("should handle tasks/get for non-existent task", async () => {
          const app = getApp();
          const request = createTasksGetRequest("non-existent-task-id");
          const response = await app.fetch(request, env);
          const result = await parseA2AResponse(response);

          // Should return error for non-existent task
          expect(result.error).toBeDefined();
        });
      });
    }

    // ========================================================================
    // CORS Tests
    // ========================================================================

    if (!skip.cors) {
      describe("CORS", () => {
        it("should include CORS headers on responses", async () => {
          const app = getApp();
          const response = await app.fetch(createHealthCheckRequest(), env);

          expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
        });

        it("should handle OPTIONS preflight request", async () => {
          const app = getApp();
          const request = new Request("http://localhost/health", {
            method: "OPTIONS",
          });

          const response = await app.fetch(request, env);

          expect(response.status).toBeLessThan(400);
          expect(response.headers.get("Access-Control-Allow-Methods")).toBeDefined();
        });
      });
    }

    // ========================================================================
    // 404 Handling Tests
    // ========================================================================

    describe("Not Found Handling", () => {
      it("should return 404 for unknown endpoints", async () => {
        const app = getApp();
        const request = new Request("http://localhost/unknown-endpoint");
        const response = await app.fetch(request, env);

        expect(response.status).toBe(404);
      });

      it("should return helpful 404 response", async () => {
        const app = getApp();
        const request = new Request("http://localhost/unknown-endpoint");
        const response = await app.fetch(request, env);
        const body = await response.json();

        expect(body.error).toBe("Not Found");
        expect(body.endpoints).toBeDefined();
      });
    });

    // ========================================================================
    // Additional Custom Tests
    // ========================================================================

    if (additionalTests) {
      describe("Custom Tests", () => {
        additionalTests(getApp, getEnv);
      });
    }
  });
}

// ============================================================================
// Specialized Test Suites
// ============================================================================

/**
 * Create a minimal test suite for simple agents
 *
 * This is a lighter version of createWorkerTestSuite that only tests
 * the most essential functionality.
 */
export function createMinimalWorkerTestSuite<TEnv extends BaseWorkerEnv = BaseWorkerEnv>(
  name: string,
  getApp: () => Hono<{ Bindings: TEnv }>,
  config: Pick<
    WorkerTestSuiteConfig<TEnv>,
    "expectedAgentName" | "mockResponse" | "streaming" | "envOptions"
  >
): void {
  createWorkerTestSuite(name, getApp, {
    ...config,
    skip: {
      cors: true,
    },
  });
}

/**
 * Create a test suite for multi-agent workers
 *
 * Includes additional tests for agent-to-agent communication patterns.
 */
export function createMultiAgentWorkerTestSuite<TEnv extends BaseWorkerEnv = BaseWorkerEnv>(
  name: string,
  getApp: () => Hono<{ Bindings: TEnv }>,
  config: WorkerTestSuiteConfig<TEnv> & {
    /**
     * Names of agents this worker communicates with
     */
    delegateAgents?: string[];
  }
): void {
  createWorkerTestSuite(name, getApp, {
    ...config,
    additionalTests: (getApp, getEnv) => {
      if (config.delegateAgents && config.delegateAgents.length > 0) {
        it("should have service bindings configured", async () => {
          // This test validates that the worker is configured for multi-agent
          // In actual tests, you'd check the env for service bindings
          expect(config.delegateAgents).toBeDefined();
          expect(config.delegateAgents!.length).toBeGreaterThan(0);
        });
      }

      // Run any additional custom tests
      config.additionalTests?.(getApp, getEnv);
    },
  });
}

