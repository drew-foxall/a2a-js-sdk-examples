/**
 * Hello World Worker E2E Tests (Network Mocked)
 *
 * These tests use MSW to intercept HTTP requests to OpenAI and return
 * deterministic responses. This tests the full HTTP stack including
 * the actual AI SDK provider code, but without real API calls.
 *
 * Run with: pnpm test:e2e
 */

import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createOpenAIHandlers } from "a2a-workers-shared/msw-handlers";
import {
  createAgentCardRequest,
  createHealthCheckRequest,
  createMessageSendRequest,
  createMockEnv,
  parseA2AResponse,
} from "a2a-workers-shared/test-utils";
import app from "../src/index";

// ============================================================================
// MSW Server Setup
// ============================================================================

const server = setupServer(
  ...createOpenAIHandlers({
    defaultResponse: "Hello! I'm the Hello World agent. How can I help you today?",
    responseMap: {
      hello: "Hello there! Welcome to the A2A protocol demonstration.",
      "how are you": "I'm doing great, thanks for asking! I'm here to help.",
      goodbye: "Goodbye! It was nice chatting with you.",
    },
  })
);

beforeAll(() => {
  server.listen({ onUnhandledRequest: "bypass" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

// ============================================================================
// Tests
// ============================================================================

describe("Hello World Worker E2E", () => {
  const env = createMockEnv();

  describe("Agent Card", () => {
    it("should return valid agent card", async () => {
      const response = await app.fetch(createAgentCardRequest(), env);

      expect(response.status).toBe(200);

      const card = await response.json();
      expect(card.name).toBe("Hello World Agent");
      expect(card.protocolVersion).toBe("0.3.0");
      expect(card.capabilities.streaming).toBe(true);
    });
  });

  describe("Health Check", () => {
    it("should return healthy status", async () => {
      const response = await app.fetch(createHealthCheckRequest(), env);

      expect(response.status).toBe(200);

      const health = await response.json();
      expect(health.status).toBe("healthy");
      expect(health.agent).toBe("Hello World Agent");
      expect(health.provider).toBe("openai");
    });
  });

  describe("Message Handling", () => {
    it("should handle hello message", async () => {
      const request = createMessageSendRequest("Hello!");
      const response = await app.fetch(request, env);

      expect(response.status).toBe(200);

      const result = await parseA2AResponse<{
        id: string;
        status: string;
        history?: Array<{
          role: string;
          parts: Array<{ kind: string; text?: string }>;
        }>;
      }>(response);

      expect(result.result).toBeDefined();
      expect(result.result?.id).toBeDefined();
      expect(result.result?.status).toBeDefined();
    });

    it("should handle follow-up messages with context", async () => {
      // First message
      const firstRequest = createMessageSendRequest("Hello!");
      const firstResponse = await app.fetch(firstRequest, env);
      const firstResult = await parseA2AResponse<{ contextId: string }>(firstResponse);

      expect(firstResult.result?.contextId).toBeDefined();

      // Follow-up message - note: with InMemoryTaskStore, context is per-request
      // In production with Redis, context would persist across requests
      const followUpRequest = createMessageSendRequest("How are you?");
      const followUpResponse = await app.fetch(followUpRequest, env);

      expect(followUpResponse.status).toBe(200);

      const followUpResult = await parseA2AResponse<{ contextId: string }>(followUpResponse);
      // Each request gets its own context with InMemoryTaskStore
      expect(followUpResult.result?.contextId).toBeDefined();
    });

    it("should handle goodbye message", async () => {
      const request = createMessageSendRequest("Goodbye!");
      const response = await app.fetch(request, env);

      expect(response.status).toBe(200);

      const result = await parseA2AResponse(response);
      expect(result.result).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should return error for invalid JSON-RPC", async () => {
      const request = new Request("http://localhost/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ not: "valid" }),
      });

      const response = await app.fetch(request, env);
      const result = await parseA2AResponse(response);

      expect(result.error).toBeDefined();
    });

    it("should return error for unknown method", async () => {
      const request = new Request("http://localhost/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "test-1",
          method: "unknown/method",
          params: {},
        }),
      });

      const response = await app.fetch(request, env);
      const result = await parseA2AResponse(response);

      expect(result.error).toBeDefined();
    });
  });
});

