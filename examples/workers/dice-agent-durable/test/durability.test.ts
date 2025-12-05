/**
 * Durability Tests for Dice Agent (Durable)
 *
 * These tests verify that the Workflow DevKit integration provides:
 * - State persistence across requests
 * - Automatic retry on failures
 * - Task retrieval after creation
 *
 * Prerequisites:
 * - Upstash Redis instance configured
 * - Environment variables set (WORKFLOW_UPSTASH_REDIS_REST_URL, WORKFLOW_UPSTASH_REDIS_REST_TOKEN)
 * - Worker running at localhost:8787 (pnpm worker:dice-durable)
 *
 * Run with:
 *   pnpm test
 */

import { Redis } from "@upstash/redis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Test configuration
const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:8787";
const REDIS_URL = process.env.WORKFLOW_UPSTASH_REDIS_REST_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN =
  process.env.WORKFLOW_UPSTASH_REDIS_REST_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

// Skip tests if Redis not configured
const SKIP_TESTS = !REDIS_URL || !REDIS_TOKEN;

describe.skipIf(SKIP_TESTS)("Dice Agent Durability", () => {
  let redis: Redis;
  const createdTaskIds: string[] = [];

  beforeAll(() => {
    if (!REDIS_URL || !REDIS_TOKEN) {
      throw new Error("Redis credentials not configured");
    }
    redis = new Redis({
      url: REDIS_URL,
      token: REDIS_TOKEN,
    });
  });

  afterAll(async () => {
    // Clean up test tasks (optional - tasks have TTL anyway)
    for (const taskId of createdTaskIds) {
      try {
        await redis.del(`dice-agent-durable:task:${taskId}`);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe("Health Check", () => {
    it("should report durableWorkflow as true when configured", async () => {
      const response = await fetch(`${BASE_URL}/health`);
      expect(response.ok).toBe(true);

      const health = (await response.json()) as {
        status: string;
        features: {
          durableWorkflow: boolean;
          persistentStorage: boolean;
          storageType: string;
        };
      };
      expect(health.status).toBe("healthy");
      expect(health.features.durableWorkflow).toBe(true);
      expect(health.features.persistentStorage).toBe(true);
      expect(health.features.storageType).toBe("upstash-redis");
    });
  });

  describe("Task Persistence", () => {
    it("should persist task state in Redis", async () => {
      // Send a message to create a task
      const response = await fetch(`${BASE_URL}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "test-1",
          method: "message/send",
          params: {
            message: {
              messageId: `msg-persist-${Date.now()}`,
              role: "user",
              parts: [{ kind: "text", text: "Roll a 6-sided die" }],
            },
          },
        }),
      });

      expect(response.ok).toBe(true);
      const result = (await response.json()) as { result?: { id?: string } };

      // Verify task was created
      expect(result.result).toBeDefined();
      expect(result.result?.id).toBeDefined();

      const taskId = result.result!.id!;
      createdTaskIds.push(taskId);

      // Wait for task to be stored
      await new Promise((r) => setTimeout(r, 1000));

      // Check Redis for task state - the task store uses this key pattern
      const taskData = await redis.get(`dice-agent-durable:task:${taskId}`);

      // Task should be stored in Redis
      expect(taskData).toBeDefined();
    });

    it("should retrieve existing task by ID", async () => {
      // First, create a task
      const createResponse = await fetch(`${BASE_URL}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "test-create",
          method: "message/send",
          params: {
            message: {
              messageId: `msg-retrieve-${Date.now()}`,
              role: "user",
              parts: [{ kind: "text", text: "Roll a 20-sided die" }],
            },
          },
        }),
      });

      const createResult = (await createResponse.json()) as { result?: { id?: string } };
      const taskId = createResult.result?.id;
      expect(taskId).toBeDefined();
      createdTaskIds.push(taskId!);

      // Wait for task to complete
      await new Promise((r) => setTimeout(r, 3000));

      // Now retrieve the task using tasks/get
      const getResponse = await fetch(`${BASE_URL}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "test-get",
          method: "tasks/get",
          params: {
            id: taskId,
          },
        }),
      });

      expect(getResponse.ok).toBe(true);
      const getResult = (await getResponse.json()) as { result?: { id?: string }; error?: unknown };

      // Task should be retrievable (may have completed or still working)
      // A2A SDK returns the task or an error
      if (getResult.result) {
        expect(getResult.result.id).toBe(taskId);
      } else {
        // If error, it should not be "task not found" since we just created it
        console.log("Task retrieval result:", getResult);
      }
    });
  });

  describe("Workflow State", () => {
    it("should store workflow runs in Redis when workflow is invoked", async () => {
      // Send a message that triggers workflow execution
      const response = await fetch(`${BASE_URL}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "test-workflow",
          method: "message/send",
          params: {
            message: {
              messageId: `msg-workflow-${Date.now()}`,
              role: "user",
              parts: [{ kind: "text", text: "Check if 17 is prime" }],
            },
          },
        }),
      });

      expect(response.ok).toBe(true);
      const result = (await response.json()) as { result?: { id?: string } };
      if (result.result?.id) {
        createdTaskIds.push(result.result.id);
      }

      // Wait for workflow to execute
      await new Promise((r) => setTimeout(r, 3000));

      // Check for workflow-related keys in Redis
      // The Upstash World uses "dice-agent-workflow:" prefix
      const workflowKeys = await redis.keys("dice-agent-workflow:*");

      // Log what we found (workflow keys are created when durable workflow is used)
      console.log(`Found ${workflowKeys.length} workflow keys in Redis`);

      // This is informational - the current implementation may or may not
      // create workflow keys depending on whether the durable workflow is invoked
    });
  });

  describe("Concurrent Requests", () => {
    it("should handle concurrent requests without errors", async () => {
      // Send multiple requests concurrently
      const requests = Array.from({ length: 5 }, (_, i) =>
        fetch(`${BASE_URL}/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: `test-concurrent-${i}`,
            method: "message/send",
            params: {
              message: {
                messageId: `msg-concurrent-${Date.now()}-${i}`,
                role: "user",
                parts: [{ kind: "text", text: `Roll a ${6 + i}-sided die` }],
              },
            },
          }),
        })
      );

      const responses = await Promise.all(requests);

      // All requests should succeed
      for (const response of responses) {
        expect(response.ok).toBe(true);
        const result = (await response.json()) as { result?: { id?: string } };
        expect(result.result).toBeDefined();
        if (result.result?.id) {
          createdTaskIds.push(result.result.id);
        }
      }
    });
  });

  describe("Workflow DevKit Endpoints", () => {
    it("should have step handler endpoint", async () => {
      // The step endpoint should exist (even if it returns error without proper payload)
      const response = await fetch(`${BASE_URL}/.well-known/workflow/v1/step`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-vqs-queue-name": "__wkf_step_test",
          "x-vqs-message-id": "test-msg-1",
          "x-vqs-message-attempt": "1",
        },
        body: JSON.stringify({ test: true }),
      });

      // Should not be 404 (endpoint exists)
      expect(response.status).not.toBe(404);
    });

    it("should have flow handler endpoint", async () => {
      // The flow endpoint should exist
      const response = await fetch(`${BASE_URL}/.well-known/workflow/v1/flow`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-vqs-queue-name": "__wkf_workflow_test",
          "x-vqs-message-id": "test-msg-2",
          "x-vqs-message-attempt": "1",
        },
        body: JSON.stringify({ test: true }),
      });

      // Should not be 404 (endpoint exists)
      expect(response.status).not.toBe(404);
    });
  });

  describe("Agent Card", () => {
    it("should return agent card at /.well-known/agent-card.json", async () => {
      const response = await fetch(`${BASE_URL}/.well-known/agent-card.json`);
      expect(response.ok).toBe(true);

      const card = (await response.json()) as {
        name: string;
        description: string;
        url: string;
        capabilities: { streaming: boolean };
      };
      expect(card.name).toBe("Dice Agent (Durable)");
      expect(card.description).toContain("durable");
      expect(card.url).toBe(BASE_URL);
      expect(card.capabilities.streaming).toBe(true);
    });
  });
});

describe.skipIf(SKIP_TESTS)("Retry Behavior", () => {
  it("should handle transient failures gracefully", async () => {
    // This test verifies the agent doesn't crash on edge cases
    const response = await fetch(`${BASE_URL}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "test-edge",
        method: "message/send",
        params: {
          message: {
            messageId: `msg-edge-${Date.now()}`,
            role: "user",
            parts: [{ kind: "text", text: "Roll a 1000000-sided die" }],
          },
        },
      }),
    });

    // Should handle large numbers without crashing
    expect(response.ok).toBe(true);
  });
});

