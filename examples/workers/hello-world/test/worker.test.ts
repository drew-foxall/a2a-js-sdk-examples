/**
 * Hello World Worker Tests
 *
 * These tests validate the worker's HTTP endpoints without making real AI API calls.
 * We test the Hono app directly using mock environment variables.
 *
 * Run with: pnpm test
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createMockModel,
  createMockEnv,
  createAgentCardRequest,
  createHealthCheckRequest,
  createMessageSendRequest,
  setTestModel,
  parseA2AResponse,
} from "a2a-workers-shared/test-utils";
import app from "../src/index";

describe("Hello World Worker", () => {
  beforeAll(() => {
    // Inject mock model for all tests
    setTestModel(
      createMockModel({
        response: "Hello! Welcome to the A2A protocol. How can I assist you today?",
        streaming: true,
      })
    );
  });

  afterAll(() => {
    // Restore real model behavior
    setTestModel(null);
  });

  const env = createMockEnv();

  describe("Health Check", () => {
    it("should return healthy status", async () => {
      const response = await app.fetch(createHealthCheckRequest(), env);

      expect(response.status).toBe(200);

      const health = await response.json();
      expect(health.status).toBe("healthy");
      expect(health.agent).toBe("Hello World Agent");
    });

    it("should include provider and model info", async () => {
      const response = await app.fetch(createHealthCheckRequest(), env);
      const health = await response.json();

      expect(health.provider).toBeDefined();
      expect(health.model).toBeDefined();
      expect(health.runtime).toBeDefined();
    });
  });

  describe("CORS", () => {
    it("should include CORS headers on responses", async () => {
      const response = await app.fetch(createHealthCheckRequest(), env);

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });

    it("should handle OPTIONS preflight request", async () => {
      const request = new Request("http://localhost/health", {
        method: "OPTIONS",
      });

      const response = await app.fetch(request, env);

      expect(response.status).toBeLessThan(400);
      expect(response.headers.get("Access-Control-Allow-Methods")).toBeDefined();
    });
  });

  // Note: Agent Card and Message Handling tests require the full A2A SDK
  // which needs proper module resolution. These are better tested in E2E tests
  // with MSW or against a running worker instance.
});
